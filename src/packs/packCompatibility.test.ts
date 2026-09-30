import { describe, expect, test } from "bun:test";
import { activationOrder, compareVersion, linkedPacks, packProblems, safePackFolder } from "./packCompatibility";
import { parsePackManifest, parsePackVersion } from "./packManifest";
import { parsePackSidecar } from "./packSidecar";

const uuid = "aaaaaaaa-0000-0000-0000-000000000001";
const dependency = "bbbbbbbb-0000-0000-0000-000000000001";
const fixture = () =>
	parsePackManifest(
		JSON.stringify({
			header: {
				uuid,
				version: [
					1,
					0,
					0,
				],
				min_engine_version: [
					1,
					21,
					100,
				],
			},
			modules: [
				{
					type: "script",
				},
			],
			dependencies: [
				{
					uuid: dependency,
					version: [
						2,
						0,
						0,
					],
				},
				{
					module_name: "@minecraft/server",
					version: "2.0.0",
				},
			],
		}),
	);

describe("pack compatibility", () => {
	test("retains minimum engine, dependency versions and script API requirements", () => {
		const manifest = fixture();
		expect(manifest?.scripted).toBe(true);
		expect(manifest?.minEngineVersion?.text).toBe("1.21.100");
		expect(manifest?.requirements[1]?.module).toBe("@minecraft/server");
	});
	test("rejects missing dependencies, wrong versions and an older engine", () => {
		const manifest = fixture();
		if (manifest === null) {
			throw new Error("invalid fixture");
		}
		expect(packProblems(manifest, new Map(), "1.21.90.1")).toHaveLength(2);
		const version = parsePackVersion([
			1,
			0,
			0,
		]);
		if (version === null) {
			throw new Error("invalid fixture");
		}
		expect(
			packProblems(
				manifest,
				new Map([
					[
						dependency,
						version,
					],
				]),
				"1.21.100.1",
			),
		).toHaveLength(1);
	});
	test("compares build components numerically", () => {
		expect(
			compareVersion(
				[
					1,
					21,
					100,
					1,
				],
				[
					1,
					21,
					90,
				],
			),
		).toBe(1);
	});
	test("does not silently accept invalid JSON or partial version strings", () => {
		expect(parsePackManifest("null")).toBeNull();
		expect(parsePackVersion("1.2garbage.3")).toBeNull();
		expect(
			parsePackVersion([
				1,
				-1,
				0,
			]),
		).toBeNull();
		expect(
			parsePackVersion([
				1.5,
				0,
				0,
			]),
		).toBeNull();
	});
	test("activates dependencies first, accepts two halves that require each other, and refuses a missing one", () => {
		const packs = parsePackSidecar(
			JSON.stringify({
				packs: {
					a: {
						folder: "behavior_packs/a",
						kind: "behavior",
						dependencies: [
							"b",
						],
					},
					b: {
						folder: "resource_packs/b",
						kind: "resource",
						dependencies: [],
					},
				},
			}),
		).packs;
		expect(
			activationOrder(
				[
					"a",
				],
				packs,
			).map((pack) => pack.uuid),
		).toEqual([
			"b",
			"a",
		]);
		const b = packs.b;
		if (b === undefined) {
			throw new Error("invalid fixture");
		}
		b.dependencies = [
			"a",
		];
		expect(
			activationOrder(
				[
					"a",
				],
				packs,
			).map((pack) => pack.uuid),
		).toEqual([
			"b",
			"a",
		]);
		b.dependencies = [
			"missing",
		];
		expect(() =>
			activationOrder(
				[
					"a",
				],
				packs,
			),
		).toThrow("Missing add-on dependency: missing");
	});
	test("groups the halves of an add-on that require each other, and nothing that only depends one way", () => {
		const packs = parsePackSidecar(
			JSON.stringify({
				packs: {
					a: {
						folder: "behavior_packs/a",
						kind: "behavior",
						dependencies: [
							"b",
						],
					},
					b: {
						folder: "resource_packs/b",
						kind: "resource",
						dependencies: [
							"a",
						],
					},
					c: {
						folder: "behavior_packs/c",
						kind: "behavior",
						dependencies: [
							"a",
						],
					},
				},
			}),
		).packs;
		expect(
			linkedPacks(
				[
					"a",
				],
				packs,
			).sort(),
		).toEqual([
			"a",
			"b",
		]);
		expect(
			linkedPacks(
				[
					"c",
				],
				packs,
			),
		).toEqual([
			"c",
		]);
	});
	test("only permits pack folders in supported world or global roots", () => {
		expect(safePackFolder("worlds/Survival/behavior_packs/addon")).toBe(true);
		expect(safePackFolder("behavior_packs/..")).toBe(false);
		expect(safePackFolder("worlds/../../settings")).toBe(false);
		expect(safePackFolder("server.properties")).toBe(false);
	});
});

test("shared packs cannot be removed from another world's registry", async () => {
	const { assertRemovable } = await import("./packCompatibility");
	type Context = import("@serverkgg/bridge").Bridge.Context;
	const packs = parsePackSidecar(
		JSON.stringify({
			packs: {
				a: {
					folder: "behavior_packs/a",
					kind: "behavior",
					dependencies: [],
				},
			},
		}),
	).packs;
	const pack = packs.a;
	if (pack === undefined) {
		throw new Error("invalid fixture");
	}
	const context = {
		codec: {
			properties: {
				read: async () => ({
					"level-name": "world",
				}),
			},
		},
		exec: async () => ({
			code: 0,
			stdout: "worlds/world/level.dat\nworlds/other/level.dat",
			stderr: "",
		}),
		files: {
			exists: async () => true,
			read: async () =>
				JSON.stringify([
					{
						pack_id: "a",
						version: [
							1,
							0,
							0,
						],
					},
				]),
		},
		activity: {
			report: () => {},
		},
	} as unknown as Context;
	await expect(
		assertRemovable(
			context,
			[
				pack,
			],
			packs,
		),
	).rejects.toThrow();
});
