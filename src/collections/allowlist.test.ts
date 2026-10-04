import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { allowlist, normalizeAllowlist, withAllowed, withoutAllowed } from "./allowlist";

const SECRET = "hunter2-super-secret";

const harness = (running: boolean) => {
	const files = new Map<string, string>([
		[
			".serverk-players.json",
			JSON.stringify([
				{
					xuid: "2535",
					name: "Meslzy",
					lastSeen: "2026-09-28T10:00:00.000Z",
				},
			]),
		],
	]);
	const commands: string[] = [];
	const reports: Bridge.Activity[] = [];
	const context = {
		server: {
			running,
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
		files: {
			exists: async (path: string) => files.has(path),
			read: async (path: string) => files.get(path) ?? "",
			write: async (path: string, value: string) => {
				files.set(path, value);
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
		files,
		commands,
		reports,
	};
};

describe("reading allowlist.json, which is a top-level array the json codec cannot read", () => {
	it("keeps the entries bedrock writes, including the xuid it fills in on first connect", () => {
		expect(
			normalizeAllowlist([
				{
					ignoresPlayerLimit: false,
					name: "Meslzy",
					xuid: "2535",
				},
			]),
		).toEqual([
			{
				ignoresPlayerLimit: false,
				name: "Meslzy",
				xuid: "2535",
			},
		]);
	});

	it("keeps an entry that has no xuid yet, because that is how a new one starts", () => {
		expect(
			normalizeAllowlist([
				{
					name: "Meslzy",
				},
			]),
		).toEqual([
			{
				ignoresPlayerLimit: false,
				name: "Meslzy",
			},
		]);
	});

	it("drops an entry with no name, which bedrock would refuse anyway", () => {
		expect(
			normalizeAllowlist([
				{
					xuid: "2535",
				},
				{
					name: "Meslzy",
				},
			]),
		).toHaveLength(1);
	});
});

describe("changing the allowlist", () => {
	const listed = [
		{
			ignoresPlayerLimit: false,
			name: "Meslzy",
		},
	];

	it("adds a player", () => {
		expect(
			withAllowed(listed, {
				ignoresPlayerLimit: false,
				name: "Noura",
			}),
		).toHaveLength(2);
	});

	it("never adds the same gamertag twice, whatever the case", () => {
		expect(
			withAllowed(listed, {
				ignoresPlayerLimit: false,
				name: "meslzy",
			}),
		).toHaveLength(1);
	});

	it("removes by gamertag, whatever the case", () => {
		expect(withoutAllowed(listed, "MESLZY")).toHaveLength(0);
	});
});

describe("reporting allowlist changes", () => {
	it("adding a known player while the server is off reports the gamertag and xuid", async () => {
		const run = harness(false);
		await allowlist.add?.(run.context, "Meslzy");
		expect(JSON.parse(run.files.get("allowlist.json") ?? "[]")).toEqual([
			{
				ignoresPlayerLimit: false,
				name: "Meslzy",
				xuid: "2535",
			},
		]);
		expect(run.reports).toEqual([
			{
				name: BridgeEventName.AccessGranted,
				text: {
					ar: "تمت إضافة Meslzy إلى القائمة البيضاء",
					en: "Added Meslzy to the allowlist",
				},
				subject: "Meslzy",
				details: {
					list: "allowlist",
					player: "Meslzy",
					xuid: "2535",
				},
			},
		]);
		expect(JSON.stringify(run.reports)).not.toContain(SECRET);
	});

	it("adding an unknown player on a running server reports the gamertag alone", async () => {
		const run = harness(true);
		await allowlist.add?.(run.context, "Noura");
		expect(run.commands).toEqual([
			"allowlist add Noura",
		]);
		expect(run.reports.at(0)?.details).toEqual({
			list: "allowlist",
			player: "Noura",
		});
	});

	it("removing a player reports the revoked access", async () => {
		const run = harness(true);
		await allowlist.actions?.remove?.(
			run.context,
			{
				id: "2535",
				name: "Meslzy",
				xuid: "2535",
			},
			{},
		);
		expect(run.reports.at(0)).toMatchObject({
			name: BridgeEventName.AccessRevoked,
			subject: "Meslzy",
			details: {
				list: "allowlist",
				xuid: "2535",
			},
		});
	});
});

describe("building an allowlist report never fails the change", () => {
	it("an unreadable player ledger does not fail an add on a running server", async () => {
		const run = harness(true);
		const failing = {
			...run.context,
			files: {
				exists: async () => true,
				read: async () => {
					throw new Error("disk read failed");
				},
			},
		} as unknown as Bridge.Context;
		await allowlist.add?.(failing, "Meslzy");
		expect(run.commands).toEqual([
			"allowlist add Meslzy",
		]);
		expect(run.reports.at(0)?.details).toEqual({
			list: "allowlist",
			player: "Meslzy",
		});
	});
});
