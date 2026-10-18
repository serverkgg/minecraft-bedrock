import { describe, expect, it } from "bun:test";
import { type CurseforgeFile, CurseforgeReleaseType } from "@serverkgg/bridge/catalogs";
import { HAMMERS_BP, HAMMERS_RP, manifestOf } from "../testing";
import { curseforgeTagsOf, pickCurseforgeFiles } from "./curseforgeFiles";
import type { PackManifest } from "./packManifest";
import { walkPartnerFiles } from "./packPartners";

const file = (id: number, displayName: string, gameVersions: string[]): CurseforgeFile => ({
	id,
	modId: 1_575_941,
	fileName: displayName,
	displayName,
	downloadUrl: `https://edge.forgecdn.net/files/${String(id).slice(0, 4)}/${String(id).slice(4)}/addon.mcaddon`,
	fileLength: 1024,
	fileDate: null,
	isAvailable: true,
	releaseType: CurseforgeReleaseType.Release,
	gameVersions,
	hashes: [],
	dependencies: [],
});

const VERITY_26_50 = file(8_902_437, "ThatMob's Verity 4.0.0 by PnTMC [Add-on] - V26.50.mcaddon", [
	"26.50",
]);

const VERITY_26_40 = file(8_690_130, "ThatMob's Verity 4.0.0 by PnTMC [Add-on] - V26.40.mcaddon", [
	"26.40",
]);

const VERITY_26_30 = file(8_690_120, "ThatMob's Verity 4.0.0 by PnTMC [Add-on] - V26.30.mcaddon", [
	"26.30",
]);

const VERITY_26_10 = file(8_690_112, "ThatMob's Verity 4.0.0 by PnTMC [Add-on] - V26.10.mcaddon", [
	"26.10",
	"26.11",
	"26.12",
	"26.13",
]);

const VERITY_3_2_26_40 = file(8_593_642, "ThatMob's Verity 3.2.0 by PnTMC [Add-on] - V26.40.mcaddon", [
	"26.40",
]);

const VERITY = [
	VERITY_26_50,
	VERITY_26_40,
	VERITY_26_30,
	VERITY_26_10,
	VERITY_3_2_26_40,
];

const BEANS_TAGS = [
	"1.21.50",
	"1.21.51",
	"1.21.60",
	"1.21.100",
	"26.30",
];

describe("naming the curseforge tag of the server's build", () => {
	it("drops the leading 1 from a 1.26 build and cuts it after the minor", () => {
		expect(curseforgeTagsOf("1.26.52.3")).toEqual([
			"26.52",
			"26.50",
		]);
	});

	it("names one tag for a build that is the update itself", () => {
		expect(curseforgeTagsOf("1.26.60.1")).toEqual([
			"26.60",
		]);
	});

	it("keeps the leading 1 on a 1.21 build, the way curseforge tags those", () => {
		expect(curseforgeTagsOf("1.21.51.02")).toEqual([
			"1.21.51",
			"1.21.50",
		]);
	});

	it("names no tag when the build is unknown or unreadable", () => {
		expect(curseforgeTagsOf(null)).toEqual([]);
		expect(curseforgeTagsOf("latest")).toEqual([]);
	});
});

describe("picking the catalog file built for the server", () => {
	it("picks the 26.40 file on a 26.40 server, though a 26.50 file is newer", () => {
		expect(pickCurseforgeFiles(VERITY, "1.26.40.1")?.file.id).toBe(VERITY_26_40.id);
	});

	it("picks the 26.40 file on a 1.26.45 hotfix that no file is tagged for", () => {
		expect(pickCurseforgeFiles(VERITY, "1.26.45.1")?.file.id).toBe(VERITY_26_40.id);
	});

	it("picks the file tagged with every hotfix of its update", () => {
		expect(pickCurseforgeFiles(VERITY, "1.26.12.1")?.file.id).toBe(VERITY_26_10.id);
	});

	it("picks the newest file when the project ships nothing for the server's build", () => {
		expect(pickCurseforgeFiles(VERITY, "1.26.60.1")?.file.id).toBe(VERITY_26_50.id);
	});

	it("picks the newest file of a project that tags no versions", () => {
		expect(
			pickCurseforgeFiles(
				[
					file(10, "older", []),
					file(30, "newest", []),
					file(20, "middle", []),
				],
				"1.26.40.1",
			)?.file.id,
		).toBe(30);
	});

	it("picks the newest file when the server's build is unknown", () => {
		expect(pickCurseforgeFiles(VERITY, null)?.file.id).toBe(VERITY_26_50.id);
	});

	it("picks the newest Bean's Armed Forces file on a 26.30 server, since both carry the tag", () => {
		expect(
			pickCurseforgeFiles(
				[
					file(9_219_160, "Bean's Armed Forces v4.3.mcaddon", BEANS_TAGS),
					file(8_580_091, "Bean's Armed Forces v4.2.mcaddon", BEANS_TAGS),
				],
				"1.26.30.2",
			)?.file.id,
		).toBe(9_219_160);
	});

	it("answers null when the project has no file it allows to download", () => {
		expect(
			pickCurseforgeFiles(
				[
					{
						...VERITY_26_40,
						isAvailable: false,
					},
				],
				"1.26.40.1",
			),
		).toBeNull();
	});
});

describe("handing the rest of the project to the partner walk", () => {
	it("leaves the chosen file out of the partners", () => {
		const pick = pickCurseforgeFiles(VERITY, "1.26.40.1");

		expect(pick?.partners.map((entry) => entry.id)).not.toContain(VERITY_26_40.id);
		expect(pick?.partners).toHaveLength(VERITY.length - 1);
	});

	it("lists the files built for the chosen file's version first", () => {
		expect(pickCurseforgeFiles(VERITY, "1.26.40.1")?.partners.map((entry) => entry.id)).toEqual([
			VERITY_3_2_26_40.id,
			VERITY_26_50.id,
			VERITY_26_30.id,
			VERITY_26_10.id,
		]);
	});

	it("walks to the resource pack built for the same version and never downloads the chosen file again", async () => {
		const behavior = file(300, "Vanilla Hammers v3.1.0 [Behavior] 26.40", [
			"26.40",
		]);
		const resource = file(299, "Vanilla Hammers v3.1.0 [Resource] 26.40", [
			"26.40",
		]);
		const packs = new Map<number, PackManifest[]>([
			[
				302,
				[
					manifestOf(HAMMERS_BP),
				],
			],
			[
				301,
				[
					manifestOf(HAMMERS_RP),
				],
			],
			[
				299,
				[
					manifestOf(HAMMERS_RP),
				],
			],
		]);
		const pick = pickCurseforgeFiles(
			[
				file(302, "Vanilla Hammers v3.1.0 [Behavior] 26.50", [
					"26.50",
				]),
				file(301, "Vanilla Hammers v3.1.0 [Resource] 26.50", [
					"26.50",
				]),
				behavior,
				resource,
			],
			"1.26.40.1",
		);
		const opened: number[] = [];
		const kept = await walkPartnerFiles({
			candidates: [
				manifestOf(HAMMERS_BP),
			],
			installed: new Map(),
			files: pick?.partners ?? [],
			open: async (entry) => {
				opened.push(entry.id);

				return packs.get(entry.id) ?? [];
			},
			drop: async () => {},
		});

		expect(pick?.file.id).toBe(behavior.id);
		expect(opened).toEqual([
			resource.id,
		]);
		expect(kept.map((entry) => entry.id)).toEqual([
			resource.id,
		]);
	});
});
