import { describe, expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { gameplay } from "./gameplay";

const SECRET = "hunter2-super-secret";

const harness = () => {
	const commands: string[] = [];
	const reports: Bridge.Activity[] = [];
	const context = {
		server: {
			running: true,
			publicAddress: null,
		},
		variable: () => SECRET,
		command: async (input: string) => {
			commands.push(input);
			return {
				line: "",
				groups: {},
			};
		},
		log: Object.assign(() => {}, {
			warn: () => {},
			error: () => {},
		}),
		activity: {
			report: (entry: Bridge.Activity) => {
				reports.push(entry);
			},
		},
	} as unknown as Bridge.Context;
	return {
		context,
		commands,
		reports,
	};
};

describe("reporting live gameplay changes", () => {
	test("every action reports what it changed and to what", async () => {
		const run = harness();
		for (const action of [
			"timeDay",
			"timeNight",
			"weatherClear",
			"weatherRain",
			"weatherThunder",
			"allowlistOn",
			"allowlistOff",
			"reloadPermissions",
		]) {
			await gameplay.actions[action]?.(run.context, {});
		}
		expect(
			run.reports.map((entry) => [
				entry.name,
				entry.details?.what,
				entry.details?.value,
			]),
		).toEqual([
			[
				BridgeEventName.GameplayChanged,
				"time",
				"day",
			],
			[
				BridgeEventName.GameplayChanged,
				"time",
				"night",
			],
			[
				BridgeEventName.GameplayChanged,
				"weather",
				"clear",
			],
			[
				BridgeEventName.GameplayChanged,
				"weather",
				"rain",
			],
			[
				BridgeEventName.GameplayChanged,
				"weather",
				"thunder",
			],
			[
				BridgeEventName.GameplayChanged,
				"allowlist",
				"on",
			],
			[
				BridgeEventName.GameplayChanged,
				"allowlist",
				"off",
			],
			[
				BridgeEventName.GameplayChanged,
				"permissions",
				"reload",
			],
		]);
		expect(run.reports.every((entry) => entry.subject === undefined)).toBe(true);
		expect(JSON.stringify(run.reports)).not.toContain(SECRET);
	});

	test("a difficulty change reports the difficulty by its label", async () => {
		const run = harness();
		await gameplay.actions.difficulty?.(run.context, {
			difficulty: "hard",
		});
		expect(run.commands).toEqual([
			"changesetting difficulty hard",
		]);
		expect(run.reports).toEqual([
			{
				name: BridgeEventName.GameplayChanged,
				text: {
					ar: "تم تغيير الصعوبة إلى صعب",
					en: "Set the difficulty to Hard",
				},
				details: {
					what: "difficulty",
					value: "hard",
				},
			},
		]);
	});

	test("a refused difficulty sends nothing and reports nothing", async () => {
		const run = harness();
		await expect(
			gameplay.actions.difficulty?.(run.context, {
				difficulty: "brutal",
			}),
		).rejects.toThrow();
		expect(run.commands).toEqual([]);
		expect(run.reports).toEqual([]);
	});
});
