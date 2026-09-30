import { describe, expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { worlds } from "./worlds";

const SECRET = "hunter2-super-secret";

const harness = () => {
	const properties: Record<string, string> = {
		"level-name": "world",
	};
	const removed: string[] = [];
	const reports: Bridge.Activity[] = [];
	const context = {
		server: {
			running: false,
			publicAddress: null,
		},
		variable: () => SECRET,
		exec: async () => ({
			code: 0,
			stdout: "worlds/world/level.dat\nworlds/skyblock/level.dat",
			stderr: "",
		}),
		codec: {
			properties: {
				read: async () => ({
					...properties,
				}),
				merge: async (_path: string, values: Record<string, string>) => {
					Object.assign(properties, values);
				},
			},
		},
		files: {
			remove: async (path: string) => {
				removed.push(path);
			},
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
		properties,
		removed,
		reports,
	};
};

const SKYBLOCK: Bridge.Row = {
	id: "skyblock",
	name: "Skyblock",
	folder: "skyblock",
};

describe("reporting world changes", () => {
	test("activating a world reports it and the world it replaced", async () => {
		const run = harness();
		await worlds.actions?.activate?.(run.context, SKYBLOCK, {});
		expect(run.properties["level-name"]).toBe("skyblock");
		expect(run.reports).toEqual([
			{
				name: BridgeEventName.WorldActivated,
				text: {
					ar: "تم تفعيل ماب skyblock بدل world",
					en: "Activated world skyblock in place of world",
				},
				subject: "skyblock",
				details: {
					folder: "skyblock",
					previous: "world",
				},
			},
		]);
		expect(JSON.stringify(run.reports)).not.toContain(SECRET);
	});

	test("deleting a world reports the folder it removed", async () => {
		const run = harness();
		await worlds.actions?.delete?.(run.context, SKYBLOCK, {});
		expect(run.removed).toEqual([
			"worlds/skyblock",
		]);
		expect(run.reports.at(0)).toMatchObject({
			name: BridgeEventName.WorldDeleted,
			subject: "skyblock",
		});
	});

	test("a refused activation reports nothing", async () => {
		const run = harness();
		await expect(
			worlds.actions?.activate?.(
				run.context,
				{
					id: "world",
					name: "world",
				},
				{},
			),
		).rejects.toThrow();
		expect(run.reports).toEqual([]);
	});
});
