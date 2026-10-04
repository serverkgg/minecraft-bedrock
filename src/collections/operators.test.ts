import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { roster } from "../shared";
import { normalizePermissions, operators, PermissionLevel, withoutPermission, withPermission } from "./operators";

const SECRET = "hunter2-super-secret";

const harness = (running: boolean, online = true) => {
	roster.clear();
	if (online) {
		roster.connect("2535", "Meslzy");
	}
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

describe("reading permissions.json, which bedrock keys by xuid and never by name", () => {
	it("keeps each level bedrock understands", () => {
		expect(
			normalizePermissions([
				{
					permission: "operator",
					xuid: "1",
				},
				{
					permission: "visitor",
					xuid: "2",
				},
			]),
		).toEqual([
			{
				permission: PermissionLevel.Operator,
				xuid: "1",
			},
			{
				permission: PermissionLevel.Visitor,
				xuid: "2",
			},
		]);
	});

	it("falls back to member for a level bedrock does not know", () => {
		expect(
			normalizePermissions([
				{
					permission: "admin",
					xuid: "1",
				},
			])[0]?.permission,
		).toBe(PermissionLevel.Member);
	});

	it("drops an entry with no xuid, because there is nothing to key it by", () => {
		expect(
			normalizePermissions([
				{
					permission: "operator",
				},
			]),
		).toEqual([]);
	});
});

describe("changing permissions", () => {
	const entries = [
		{
			permission: PermissionLevel.Operator,
			xuid: "1",
		},
	];

	it("replaces a level rather than adding a second row for the same account", () => {
		const changed = withPermission(entries, "1", PermissionLevel.Visitor);

		expect(changed).toHaveLength(1);
		expect(changed[0]?.permission).toBe(PermissionLevel.Visitor);
	});

	it("adds an account that was not listed", () => {
		expect(withPermission(entries, "2", PermissionLevel.Operator)).toHaveLength(2);
	});

	it("removes by xuid", () => {
		expect(withoutPermission(entries, "1")).toEqual([]);
	});
});

describe("reporting operator changes", () => {
	it("adding a known player while the server is off reports the operator level", async () => {
		const run = harness(false);
		await operators.add?.(run.context, "Meslzy");
		expect(run.reports).toEqual([
			{
				name: BridgeEventName.AccessGranted,
				text: {
					ar: "تمت إضافة Meslzy إلى قائمة الأوبريتر",
					en: "Added Meslzy to the operator list",
				},
				subject: "Meslzy",
				details: {
					list: "operators",
					level: "operator",
					xuid: "2535",
				},
			},
		]);
		expect(JSON.stringify(run.reports)).not.toContain(SECRET);
	});

	it("changing a permission reports the new level by its label", async () => {
		const run = harness(false);
		await operators.actions?.setPermission?.(
			run.context,
			{
				id: "2535",
				name: "Meslzy",
				xuid: "2535",
				permission: "operator",
			},
			{
				level: "visitor",
			},
		);
		expect(run.reports.at(0)).toMatchObject({
			name: BridgeEventName.PlayerChanged,
			text: {
				ar: "تم تغيير صلاحية Meslzy إلى زائر",
				en: "Set Meslzy's permission to Visitor",
			},
			subject: "Meslzy",
			details: {
				level: "visitor",
			},
		});
	});

	it("removing an operator reports the level they had", async () => {
		const run = harness(true);
		await operators.actions?.remove?.(
			run.context,
			{
				id: "2535",
				name: "Meslzy",
				xuid: "2535",
				permission: "operator",
			},
			{},
		);
		expect(run.commands).toEqual([
			"deop Meslzy",
		]);
		expect(run.reports.at(0)).toMatchObject({
			name: BridgeEventName.AccessRevoked,
			subject: "Meslzy",
			details: {
				list: "operators",
				level: "operator",
			},
		});
	});
});

describe("reporting only what the game could apply", () => {
	it("op on a running server reports the player the roster holds, with their xuid", async () => {
		const run = harness(true);
		await operators.add?.(run.context, "meslzy");
		expect(run.commands).toEqual([
			"op meslzy",
		]);
		expect(run.reports.at(0)).toMatchObject({
			name: BridgeEventName.AccessGranted,
			subject: "Meslzy",
			details: {
				list: "operators",
				xuid: "2535",
			},
		});
	});

	it("op on a gamertag that is not online is still sent but reports nothing", async () => {
		const run = harness(true, false);
		await operators.add?.(run.context, "Noura");
		expect(run.commands).toEqual([
			"op Noura",
		]);
		expect(run.reports).toEqual([]);
	});

	it("deop on a running server reports nothing when the player is not online", async () => {
		const run = harness(true, false);
		await operators.actions?.remove?.(
			run.context,
			{
				id: "2535",
				name: "Meslzy",
				xuid: "2535",
				permission: "operator",
			},
			{},
		);
		expect(run.commands).toEqual([
			"deop Meslzy",
		]);
		expect(run.reports).toEqual([]);
	});

	it("changing a permission writes the file and reports whoever is online", async () => {
		const run = harness(true, false);
		await operators.actions?.setPermission?.(
			run.context,
			{
				id: "2535",
				name: "Meslzy",
				xuid: "2535",
				permission: "operator",
			},
			{
				level: "member",
			},
		);
		expect(run.reports.at(0)?.name).toBe(BridgeEventName.PlayerChanged);
	});
});
