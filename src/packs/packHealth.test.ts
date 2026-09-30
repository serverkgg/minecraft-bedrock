import { describe, expect, test } from "bun:test";
import { installableListing, packLoadState, repairable, repairRefusal, strayArchives } from "./packHealth";
import { PackKind, parsePackManifest } from "./packManifest";
import type { PackRecord } from "./packSidecar";

const manifest = (dependencies: unknown[]) =>
	parsePackManifest(
		JSON.stringify({
			header: {
				uuid: "aaaaaaaa-0000-0000-0000-000000000001",
				version: [
					1,
					0,
					0,
				],
			},
			modules: [
				{
					type: "script",
				},
			],
			dependencies,
		}),
	);

const record = (uuid: string): PackRecord => ({
	uuid,
	kind: PackKind.Behavior,
	folder: `behavior_packs/${uuid}`,
	title: uuid,
	version: [
		1,
		0,
		0,
	],
	versionText: "1.0.0",
	bundle: null,
	order: 0,
	dependencies: [],
	provider: null,
	project: null,
	file: null,
	icon: null,
	pageUrl: null,
	installedAt: "",
});

describe("finding add-on files that never installed", () => {
	test("keeps archives sitting at the top of either packs folder, whatever the case of the extension", () => {
		const output = [
			"behavior_packs/Advanced Machines Add-On (addon)_2.mcaddon",
			"resource_packs/warplanesrp (1).MCPACK",
			"behavior_packs/M1A2_abrams_by_bmheades.mcaddon.zip",
			"",
		].join("\n");

		expect(strayArchives(output)).toEqual([
			"behavior_packs/Advanced Machines Add-On (addon)_2.mcaddon",
			"behavior_packs/M1A2_abrams_by_bmheades.mcaddon.zip",
			"resource_packs/warplanesrp (1).MCPACK",
		]);
	});

	test("ignores files that are not archives and anything outside the packs folders", () => {
		const output = [
			"behavior_packs/readme.txt",
			"behavior_packs/Teams-7a8094b9/manifest.json",
			"behavior_packs/Teams-7a8094b9/nested.mcpack",
			"worlds/world/behavior_packs/pack.mcpack",
			"exports/world.zip",
		].join("\n");

		expect(strayArchives(output)).toEqual([]);
	});
});

describe("telling an add-on archive from any other zip", () => {
	test("accepts an archive with a manifest at any depth or a nested pack", () => {
		expect(installableListing("./manifest.json\n./scripts/main.js")).toBe(true);
		expect(installableListing("Probe BP/manifest.json\nProbe RP/manifest.json")).toBe(true);
		expect(installableListing("inner.mcaddon")).toBe(true);
		expect(installableListing("packs/warplanes.MCPACK")).toBe(true);
	});

	test("rejects a zip that holds no add-on, so the repair is not offered for it forever", () => {
		expect(installableListing("readme.txt")).toBe(false);
		expect(installableListing("notmanifest.json.bak\nworld/level.dat")).toBe(false);
		expect(installableListing("")).toBe(false);
	});
});

describe("marking add-ons that need beta apis", () => {
	test("recognises versioned and bare beta script modules", () => {
		expect(
			manifest([
				{
					module_name: "@minecraft/server",
					version: "2.10.0-beta",
				},
				{
					module_name: "@minecraft/server-ui",
					version: "beta",
				},
				{
					module_name: "@minecraft/server-net",
					version: "1.0.0-beta.1.26.40-stable",
				},
			])?.betaModules,
		).toEqual([
			"@minecraft/server",
			"@minecraft/server-ui",
			"@minecraft/server-net",
		]);
	});

	test("leaves stable script modules and pack dependencies alone", () => {
		expect(
			manifest([
				{
					module_name: "@minecraft/server",
					version: "2.4.0",
				},
				{
					uuid: "bbbbbbbb-0000-0000-0000-000000000001",
					version: [
						1,
						0,
						0,
					],
				},
			])?.betaModules,
		).toEqual([]);
	});

	test("says why a beta add-on will not load, and stays quiet once beta apis is on", () => {
		const beta = manifest([
			{
				module_name: "@minecraft/server",
				version: "2.10.0-beta",
			},
		]);

		expect(packLoadState(beta, false).en).toContain("off on this world");
		expect(packLoadState(beta, false).ar).toContain("مقفلة على الماب");
		expect(packLoadState(beta, null).en).toContain("Needs Beta APIs");
		expect(packLoadState(beta, null).ar).toContain("يحتاج Beta APIs");
		expect(packLoadState(beta, true).en).toContain("Installed");
		expect(packLoadState(beta, true).ar).toContain("مركّب");
		expect(packLoadState(null, true).en).toContain("Missing files");
		expect(packLoadState(null, true).ar).toContain("ملفات ناقصة");
	});
});

describe("offering the repair", () => {
	test("offers it only when there is a file to install, a pack to activate or beta apis to turn on", () => {
		const clean = {
			world: "world",
			archives: [],
			unusable: [
				"resource_packs/not an addon.zip",
			],
			inactive: [],
			missing: [],
			beta: [
				record("beta"),
			],
			betaApis: null,
		};

		expect(repairable(clean)).toBe(false);
		expect(
			repairable({
				...clean,
				betaApis: true,
			}),
		).toBe(false);
		expect(
			repairable({
				...clean,
				betaApis: false,
			}),
		).toBe(true);
		expect(
			repairable({
				...clean,
				archives: [
					"behavior_packs/a.mcaddon",
				],
			}),
		).toBe(true);
		expect(
			repairable({
				...clean,
				inactive: [
					record("manual"),
				],
			}),
		).toBe(true);
	});
});

describe("saying why the repair is not offered", () => {
	const healthy = {
		world: "world",
		archives: [],
		unusable: [],
		inactive: [],
		missing: [],
		beta: [],
		betaApis: true,
	};

	test("says nothing while there is something to repair", () => {
		expect(
			repairRefusal({
				...healthy,
				inactive: [
					record("manual"),
				],
			}),
		).toBeNull();
	});

	test("says there is nothing to repair when nothing needs it", () => {
		expect(repairRefusal(healthy)?.en).toBe("There is nothing to repair here.");
	});

	test("points to the details when what is wrong is beyond the repair", () => {
		const beyond = "This cannot be repaired automatically. Open the Add-on check in the Add-ons tab for the details.";

		expect(
			repairRefusal({
				...healthy,
				missing: [
					{
						pack: record("needy"),
						uuid: "gone",
					},
				],
			})?.en,
		).toBe(beyond);
		expect(
			repairRefusal({
				...healthy,
				beta: [
					record("beta"),
				],
				betaApis: null,
			})?.en,
		).toBe(beyond);
	});
});
