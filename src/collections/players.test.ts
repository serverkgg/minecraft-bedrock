import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { roster } from "../shared";
import { players } from "./players";

const SECRET = "hunter2-super-secret";

const harness = (online = true) => {
	roster.clear();
	if (online) {
		roster.connect("2535", "Meslzy");
	}
	const commands: string[] = [];
	const emitted: string[] = [];
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
		emit: (event: string) => {
			emitted.push(event);
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
		emitted,
		reports,
	};
};

const ROW: Bridge.Row = {
	id: "2535",
	name: "Meslzy",
	xuid: "2535",
};

describe("reporting what the owner did to an online player", () => {
	it("a kick keeps its event and reports the player and the reason given", async () => {
		const run = harness();
		await players.actions?.kick?.(run.context, ROW, {
			reason: "griefing the spawn",
		});
		expect(run.emitted).toEqual([
			BridgeEventName.PlayerKicked,
		]);
		expect(run.reports).toEqual([
			{
				name: BridgeEventName.PlayerKicked,
				text: {
					ar: "تم طرد Meslzy، السبب: «griefing the spawn»",
					en: 'Kicked Meslzy, reason: "griefing the spawn"',
				},
				subject: "Meslzy",
				details: {
					player: "Meslzy",
					xuid: "2535",
					reason: "griefing the spawn",
				},
			},
		]);
		expect(JSON.stringify(run.reports)).not.toContain(SECRET);
	});

	it("a kick with no reason reports no reason", async () => {
		const run = harness();
		await players.actions?.kick?.(run.context, ROW, {});
		expect(run.reports.at(0)?.text.en).toBe("Kicked Meslzy");
		expect(run.reports.at(0)?.details?.reason).toBeUndefined();
	});

	it("op and deop report access to the operators list", async () => {
		const run = harness();
		await players.actions?.op?.(run.context, ROW, {});
		await players.actions?.deop?.(run.context, ROW, {});
		expect(
			run.reports.map((entry) => [
				entry.name,
				entry.subject,
				entry.details?.list,
			]),
		).toEqual([
			[
				BridgeEventName.AccessGranted,
				"Meslzy",
				"operators",
			],
			[
				BridgeEventName.AccessRevoked,
				"Meslzy",
				"operators",
			],
		]);
	});

	it("a game mode change keeps its event and reports the mode by its label", async () => {
		const run = harness();
		await players.actions?.gamemode?.(run.context, ROW, {
			mode: "creative",
		});
		expect(run.emitted).toEqual([
			BridgeEventName.GameModeChanged,
		]);
		expect(run.reports.at(0)).toMatchObject({
			name: BridgeEventName.PlayerChanged,
			text: {
				ar: "تم تغيير وضع اللعب لـ Meslzy إلى الإبداع",
				en: "Set Meslzy's game mode to Creative",
			},
			subject: "Meslzy",
		});
	});

	it("a kill reports the player it changed", async () => {
		const run = harness();
		await players.actions?.kill?.(run.context, ROW, {});
		expect(run.commands).toEqual([
			"kill Meslzy",
		]);
		expect(run.reports.at(0)).toMatchObject({
			name: BridgeEventName.PlayerChanged,
			subject: "Meslzy",
		});
	});
});

describe("reporting only what the game could apply", () => {
	it("a selector command on a player the roster does not hold is still sent but reports nothing", async () => {
		for (const action of [
			"op",
			"deop",
			"kill",
			"gamemode",
			"kick",
		]) {
			const run = harness(false);
			await players.actions?.[action]?.(run.context, ROW, {});
			expect(run.commands).toHaveLength(1);
			expect(run.reports).toEqual([]);
		}
	});

	it("a kick keeps its event even when it reports nothing", async () => {
		const run = harness(false);
		await players.actions?.kick?.(run.context, ROW, {});
		expect(run.emitted).toEqual([
			BridgeEventName.PlayerKicked,
		]);
	});
});
