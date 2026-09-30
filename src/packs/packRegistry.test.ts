import { describe, expect, test } from "bun:test";
import { PackKind } from "./packManifest";
import {
	movePackEntry,
	normalizeWorldPacks,
	withPackActivated,
	withPackDeactivated,
	worldPackFile,
} from "./packRegistry";

const entry = (id: string) => ({
	pack_id: id,
	version: [
		1,
		0,
		0,
	] as [
		number,
		number,
		number,
	],
});

describe("the per-world pack registry", () => {
	test("writes behavior and resource packs to the two files bedrock reads", () => {
		expect(worldPackFile("world", PackKind.Behavior)).toBe("worlds/world/world_behavior_packs.json");
		expect(worldPackFile("world", PackKind.Resource)).toBe("worlds/world/world_resource_packs.json");
	});

	test("keeps the entries bedrock wrote", () => {
		expect(
			normalizeWorldPacks([
				{
					pack_id: "a",
					version: [
						1,
						2,
						3,
					],
				},
			]),
		).toEqual([
			{
				pack_id: "a",
				version: [
					1,
					2,
					3,
				],
			},
		]);
	});

	test("drops an entry with no uuid, which bedrock would refuse to match", () => {
		expect(
			normalizeWorldPacks([
				{
					version: [
						1,
						0,
						0,
					],
				},
			]),
		).toEqual([]);
	});
});

describe("activating and ordering packs", () => {
	const entries = [
		entry("a"),
		entry("b"),
		entry("c"),
	];

	test("appends a new pack, so it cannot silently override packs already tuned", () => {
		expect(withPackActivated(entries, entry("d")).at(-1)?.pack_id).toBe("d");
	});

	test("never lists the same uuid twice, even when the version changed", () => {
		const upgraded = withPackActivated(entries, {
			pack_id: "b",
			version: [
				2,
				0,
				0,
			],
		});

		expect(upgraded).toHaveLength(3);
		expect(upgraded.find((listed) => listed.pack_id === "b")?.version).toEqual([
			2,
			0,
			0,
		]);
	});

	test("puts an upgrade back at the index it held, so order survives", () => {
		const upgraded = withPackActivated(
			entries,
			{
				pack_id: "b",
				version: [
					2,
					0,
					0,
				],
			},
			1,
		);

		expect(upgraded.map((listed) => listed.pack_id)).toEqual([
			"a",
			"b",
			"c",
		]);
	});

	test("deactivates by uuid", () => {
		expect(withPackDeactivated(entries, "b").map((listed) => listed.pack_id)).toEqual([
			"a",
			"c",
		]);
	});

	test("moves a pack up and down the priority list", () => {
		expect(movePackEntry(entries, "b", -1).map((listed) => listed.pack_id)).toEqual([
			"b",
			"a",
			"c",
		]);
		expect(movePackEntry(entries, "b", 1).map((listed) => listed.pack_id)).toEqual([
			"a",
			"c",
			"b",
		]);
	});

	test("leaves the list alone at either end, rather than wrapping around", () => {
		expect(movePackEntry(entries, "a", -1)).toEqual(entries);
		expect(movePackEntry(entries, "c", 1)).toEqual(entries);
	});
});

test("a corrupt activation registry cannot be silently replaced with an empty list", async () => {
	const { readWorldPacks } = await import("./packRegistry");
	type Context = import("@serverkgg/bridge").Bridge.Context;
	const context = {
		files: {
			exists: async () => true,
			read: async () => "{broken",
		},
		activity: {
			report: () => {},
		},
	} as unknown as Context;
	await expect(readWorldPacks(context, "world", PackKind.Behavior)).rejects.toThrow();
});
