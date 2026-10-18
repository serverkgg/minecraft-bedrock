import { describe, expect, it } from "bun:test";
import { compareVersion } from "../shared";
import {
	BEANS_BP_4_2,
	BEANS_BP_4_3,
	BEANS_RP_4_2,
	BEANS_RP_4_3,
	BEANS_RP_UUID,
	HAMMERS_BP,
	HAMMERS_RP,
	HAMMERS_RP_UUID,
	manifestOf,
	manifestText,
} from "../testing";
import {
	activationOrder,
	assertCompatible,
	compatibilityRefusal,
	linkedPacks,
	PackProblemKind,
	type PresentPack,
	packProblems,
	safePackFolder,
} from "./packCompatibility";
import { parsePackManifest, parsePackVersion } from "./packManifest";
import { parsePackSidecar } from "./packSidecar";

const uuid = "aaaaaaaa-0000-0000-0000-000000000001";
const dependency = "bbbbbbbb-0000-0000-0000-000000000001";
const version = (text: string) => {
	const parsed = parsePackVersion(text);
	if (parsed === null) {
		throw new Error("invalid fixture");
	}
	return parsed;
};
const present = (
	...packs: {
		uuid: string;
		version: string;
		title: string;
	}[]
) =>
	new Map<string, PresentPack>(
		packs.map((pack) => [
			pack.uuid,
			{
				version: version(pack.version),
				title: pack.title,
			},
		]),
	);
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
	it("retains minimum engine, dependency versions and script API requirements", () => {
		const manifest = fixture();
		expect(manifest?.scripted).toBe(true);
		expect(manifest?.minEngineVersion?.text).toBe("1.21.100");
		expect(manifest?.requirements[1]?.module).toBe("@minecraft/server");
	});
	it("refuses a missing dependency and an older engine, and accepts both once they are met", () => {
		const manifest = fixture();
		if (manifest === null) {
			throw new Error("invalid fixture");
		}
		const candidate = {
			manifest,
			title: "Cool",
		};
		expect(packProblems(candidate, new Map(), "1.21.90.1").map((problem) => problem.kind)).toEqual([
			PackProblemKind.Engine,
			PackProblemKind.Missing,
		]);
		expect(
			packProblems(
				candidate,
				present({
					uuid: dependency,
					version: "2.0.0",
					title: "Base",
				}),
				"1.21.100.1",
			),
		).toEqual([]);
	});
	it("compares build components numerically", () => {
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
	it("does not silently accept invalid JSON or partial version strings", () => {
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
	it("activates dependencies first, accepts two halves that require each other, and refuses a missing one", () => {
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
	it("groups the halves of an add-on that require each other, and nothing that only depends one way", () => {
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
	it("only permits pack folders in supported world or global roots", () => {
		expect(safePackFolder("worlds/Survival/behavior_packs/addon")).toBe(true);
		expect(safePackFolder("behavior_packs/..")).toBe(false);
		expect(safePackFolder("worlds/../../settings")).toBe(false);
		expect(safePackFolder("server.properties")).toBe(false);
	});
});

describe("checking the packs an add-on requires, as leniently as the game does", () => {
	const hammers = {
		manifest: manifestOf(HAMMERS_BP),
		title: "Vanilla Hammers [BP]",
	};

	it("accepts a required pack at exactly the declared version", () => {
		expect(
			packProblems(
				hammers,
				present({
					uuid: HAMMERS_RP_UUID,
					version: "3.1.0",
					title: "Vanilla Hammers [RP]",
				}),
				null,
			),
		).toEqual([]);
	});

	it("accepts a required pack newer than declared, because the game loads it", () => {
		expect(
			packProblems(
				hammers,
				present({
					uuid: HAMMERS_RP_UUID,
					version: "3.2.0",
					title: "Vanilla Hammers [RP]",
				}),
				null,
			),
		).toEqual([]);
	});

	it("refuses a required pack older than declared and says which pack needs which version", () => {
		const problems = packProblems(
			hammers,
			present({
				uuid: HAMMERS_RP_UUID,
				version: "3.0.5",
				title: "Vanilla Hammers [RP]",
			}),
			null,
		);

		expect(problems).toEqual([
			{
				kind: PackProblemKind.Older,
				pack: "Vanilla Hammers [BP]",
				uuid: HAMMERS_RP_UUID,
				dependency: "Vanilla Hammers [RP]",
				declared: "3.1.0",
				installed: "3.0.5",
			},
		]);
		expect(compatibilityRefusal(problems).en).toBe(
			'"Vanilla Hammers [BP]" needs "Vanilla Hammers [RP]" 3.1.0 or newer, but 3.0.5 is installed. Install the requirements first.',
		);
	});

	it("refuses the Vanilla Hammers behavior pack alone and names it, because its resource pack is a separate file", () => {
		const problems = packProblems(hammers, new Map(), null);
		const refusal = compatibilityRefusal(problems);

		expect(problems).toEqual([
			{
				kind: PackProblemKind.Missing,
				pack: "Vanilla Hammers [BP]",
				uuid: HAMMERS_RP_UUID,
				declared: "3.1.0",
			},
		]);
		expect(refusal.en).toBe(
			`"Vanilla Hammers [BP]" needs a pack that is not installed (${HAMMERS_RP_UUID} 3.1.0). Install the requirements first.`,
		);
		expect(refusal.ar).toContain("«Vanilla Hammers [BP]»");
		expect(refusal.ar).toContain(`(${HAMMERS_RP_UUID} 3.1.0)`);
	});

	it("accepts a requirement with no declared version as soon as the pack is present", () => {
		const manifest = parsePackManifest(
			JSON.stringify({
				header: {
					uuid,
					version: [
						1,
						0,
						0,
					],
				},
				modules: [
					{
						type: "data",
					},
				],
				dependencies: [
					{
						uuid: dependency,
					},
				],
			}),
		);
		if (manifest === null) {
			throw new Error("invalid fixture");
		}
		const candidate = {
			manifest,
			title: "Cool",
		};

		expect(
			packProblems(
				candidate,
				present({
					uuid: dependency,
					version: "0.0.1",
					title: "Base",
				}),
				null,
			),
		).toEqual([]);
		expect(compatibilityRefusal(packProblems(candidate, new Map(), null)).en).toBe(
			`"Cool" needs a pack that is not installed (${dependency}). Install the requirements first.`,
		);
	});

	it("still refuses a server older than the minimum engine version the add-on declares", () => {
		const resource = {
			manifest: manifestOf(HAMMERS_RP),
			title: "Vanilla Hammers [RP]",
		};
		const both = present(
			{
				uuid: HAMMERS_BP.uuid,
				version: "3.1.0",
				title: "Vanilla Hammers [BP]",
			},
			{
				uuid: HAMMERS_RP_UUID,
				version: "3.1.0",
				title: "Vanilla Hammers [RP]",
			},
		);
		const problems = packProblems(resource, both, "1.20.73.1");

		expect(problems).toEqual([
			{
				kind: PackProblemKind.Engine,
				pack: "Vanilla Hammers [RP]",
				engine: "1.20.80",
			},
		]);
		expect(compatibilityRefusal(problems).en).toBe(
			'"Vanilla Hammers [RP]" needs Minecraft 1.20.80 or newer. Install the requirements first.',
		);
		expect(packProblems(resource, both, "1.20.80.1")).toEqual([]);
		expect(packProblems(resource, both, null)).toEqual([]);
	});

	it("accepts Bean's Armed Forces 4.2, whose behavior pack asks for its resource pack one patch older than it ships", () => {
		const candidates = [
			{
				manifest: manifestOf(BEANS_BP_4_2),
				title: "Bean's Armed Forces BP",
			},
			{
				manifest: manifestOf(BEANS_RP_4_2),
				title: "Bean's Armed Forces RP",
			},
		];
		const shipped = new Map<string, PresentPack>(
			candidates.map((candidate) => [
				candidate.manifest.uuid,
				{
					version: candidate.manifest.version,
					title: candidate.title,
				},
			]),
		);

		expect(candidates.flatMap((candidate) => packProblems(candidate, shipped, "1.21.100.1"))).toEqual([]);
	});

	it("accepts Bean's Armed Forces 4.3, whose resource pack lists itself one patch older as a dependency", () => {
		const candidates = [
			{
				manifest: manifestOf(BEANS_BP_4_3),
				title: "Bean's Armed Forces BP",
			},
			{
				manifest: manifestOf(BEANS_RP_4_3),
				title: "Bean's Armed Forces RP",
			},
		];
		const shipped = new Map<string, PresentPack>(
			candidates.map((candidate) => [
				candidate.manifest.uuid,
				{
					version: candidate.manifest.version,
					title: candidate.title,
				},
			]),
		);

		expect(candidates.flatMap((candidate) => packProblems(candidate, shipped, "1.21.100.1"))).toEqual([]);
	});

	it("names the Bean's behavior pack when its resource pack is missing from the upload", () => {
		const refusal = compatibilityRefusal(
			packProblems(
				{
					manifest: manifestOf(BEANS_BP_4_2),
					title: "Bean's Armed Forces BP",
				},
				new Map(),
				null,
			),
		);

		expect(refusal.en).toBe(
			`"Bean's Armed Forces BP" needs a pack that is not installed (${BEANS_RP_UUID} 4.0.1). Install the requirements first.`,
		);
	});

	it("refuses through the install check with the title of the pack that needs it and of the one on the server", async () => {
		const older = {
			...HAMMERS_RP,
			version: [
				3,
				0,
				5,
			],
		};
		const files = new Map([
			[
				"resource_packs/hammers/manifest.json",
				manifestText(older),
			],
		]);
		const context = {
			files: {
				exists: async (path: string) => files.has(path),
				read: async (path: string) => files.get(path) ?? "",
			},
		} as unknown as import("@serverkgg/bridge").Bridge.Context;
		const packs = parsePackSidecar(
			JSON.stringify({
				packs: {
					[HAMMERS_RP_UUID]: {
						folder: "resource_packs/hammers",
						kind: "resource",
						title: "Vanilla Hammers [RP]",
						dependencies: [],
					},
				},
			}),
		).packs;

		await expect(
			assertCompatible(
				context,
				[
					hammers,
				],
				packs,
			),
		).rejects.toThrow(
			'"Vanilla Hammers [BP]" needs "Vanilla Hammers [RP]" 3.1.0 or newer, but 3.0.5 is installed. Install the requirements first.',
		);
	});
});

it("shared packs cannot be removed from another world's registry", async () => {
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
