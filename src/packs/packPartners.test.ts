import { describe, expect, it } from "bun:test";
import {
	ADMIN_UTILS_BP,
	ADMIN_UTILS_RP_DARK,
	BEANS_BP_4_2,
	BEANS_RP_4_2,
	HAMMERS_BP,
	HAMMERS_RP,
	HAMMERS_RP_UUID,
	manifestOf,
} from "../testing";
import type { PackManifest, PackVersion } from "./packManifest";
import { keepsPartner, PARTNER_FILE_LIMIT, unmetRequirements, walkPartnerFiles } from "./packPartners";

interface FakeFile {
	name: string;
	packs: PackManifest[] | null;
}

const walk = async (candidates: PackManifest[], files: FakeFile[], installed = new Map<string, PackVersion>()) => {
	const opened: string[] = [];
	const dropped: string[] = [];
	const kept = await walkPartnerFiles({
		candidates,
		installed,
		files,
		open: async (file) => {
			opened.push(file.name);
			return file.packs;
		},
		drop: async (file) => {
			dropped.push(file.name);
		},
	});
	return {
		kept: kept.map((file) => file.name),
		opened,
		dropped,
	};
};

const unrelated = (index: number): FakeFile => ({
	name: `unrelated ${index}`,
	packs: [
		manifestOf({
			...BEANS_BP_4_2,
			uuid: `cccccccc-0000-0000-0000-00000000000${index}`,
			dependencies: [],
		}),
	],
});

describe("deciding which other files of a catalog project complete an add-on", () => {
	it("finds nothing missing in Bean's Armed Forces, which ships both packs in one file", () => {
		expect(
			unmetRequirements(
				[
					manifestOf(BEANS_BP_4_2),
					manifestOf(BEANS_RP_4_2),
				],
				new Map(),
			),
		).toEqual([]);
	});

	it("finds the resource pack missing when Vanilla Hammers arrives as its behavior pack alone", () => {
		expect(
			unmetRequirements(
				[
					manifestOf(HAMMERS_BP),
				],
				new Map(),
			).map((requirement) => `${requirement.uuid} ${requirement.version?.text}`),
		).toEqual([
			`${HAMMERS_RP_UUID} 3.1.0`,
		]);
	});

	it("counts a pack already on the server as present", () => {
		expect(
			unmetRequirements(
				[
					manifestOf(HAMMERS_BP),
				],
				new Map([
					[
						HAMMERS_RP_UUID,
						manifestOf(HAMMERS_RP).version,
					],
				]),
			),
		).toEqual([]);
	});

	it("keeps a file that brings the missing pack and drops one that repeats a pack it already has", () => {
		const candidates = [
			manifestOf(HAMMERS_BP),
		];
		const unmet = unmetRequirements(candidates, new Map());

		expect(
			keepsPartner(unmet, candidates, [
				manifestOf(HAMMERS_RP),
			]),
		).toBe(true);
		expect(
			keepsPartner(unmet, candidates, [
				manifestOf({
					...HAMMERS_BP,
					version: [
						3,
						0,
						0,
					],
				}),
			]),
		).toBe(false);
		expect(
			keepsPartner(unmet, candidates, [
				manifestOf({
					...HAMMERS_BP,
					version: [
						3,
						0,
						0,
					],
				}),
				manifestOf(HAMMERS_RP),
			]),
		).toBe(false);
	});

	it("drops a file whose copy of the missing pack is older than declared, so a later file can still fill it", () => {
		const candidates = [
			manifestOf(HAMMERS_BP),
		];

		expect(
			keepsPartner(unmetRequirements(candidates, new Map()), candidates, [
				manifestOf({
					...HAMMERS_RP,
					version: [
						3,
						0,
						5,
					],
				}),
			]),
		).toBe(false);
	});
});

describe("walking a catalog project's files for the other half of an add-on", () => {
	it("downloads nothing more when the newest file is complete", async () => {
		const run = await walk(
			[
				manifestOf(BEANS_BP_4_2),
				manifestOf(BEANS_RP_4_2),
			],
			[
				unrelated(1),
			],
		);

		expect(run.opened).toEqual([]);
		expect(run.kept).toEqual([]);
	});

	it("pulls the Vanilla Hammers resource pack published as its own file next to the behavior pack", async () => {
		const run = await walk(
			[
				manifestOf(HAMMERS_BP),
			],
			[
				{
					name: "v3.1.0 [Resource]",
					packs: [
						manifestOf(HAMMERS_RP),
					],
				},
				unrelated(1),
			],
		);

		expect(run.kept).toEqual([
			"v3.1.0 [Resource]",
		]);
		expect(run.opened).toEqual([
			"v3.1.0 [Resource]",
		]);
	});

	it("stops at the first AdminUtils resource pack, so the alternative listed after it is never downloaded", async () => {
		const run = await walk(
			[
				manifestOf(ADMIN_UTILS_BP),
			],
			[
				{
					name: "RP Dark v1.1.23",
					packs: [
						manifestOf(ADMIN_UTILS_RP_DARK),
					],
				},
				{
					name: "RP Light v1.1.23",
					packs: [
						manifestOf(ADMIN_UTILS_RP_DARK),
					],
				},
			],
		);

		expect(run.kept).toEqual([
			"RP Dark v1.1.23",
		]);
		expect(run.opened).toEqual([
			"RP Dark v1.1.23",
		]);
	});

	it("drops an older copy of the same behavior pack and keeps walking to the resource pack", async () => {
		const run = await walk(
			[
				manifestOf(HAMMERS_BP),
			],
			[
				{
					name: "v3.0.0 [Behavior]",
					packs: [
						manifestOf({
							...HAMMERS_BP,
							version: [
								3,
								0,
								0,
							],
						}),
					],
				},
				{
					name: "v3.1.0 [Resource]",
					packs: [
						manifestOf(HAMMERS_RP),
					],
				},
			],
		);

		expect(run.dropped).toEqual([
			"v3.0.0 [Behavior]",
		]);
		expect(run.kept).toEqual([
			"v3.1.0 [Resource]",
		]);
	});

	it("gives up after four extra downloads and leaves the refusal to the install check", async () => {
		const run = await walk(
			[
				manifestOf(HAMMERS_BP),
			],
			[
				1,
				2,
				3,
				4,
				5,
				6,
			].map(unrelated),
		);

		expect(PARTNER_FILE_LIMIT).toBe(4);
		expect(run.opened).toHaveLength(PARTNER_FILE_LIMIT);
		expect(run.dropped).toEqual(run.opened);
		expect(run.kept).toEqual([]);
	});

	it("does not count a file the author keeps off the API against the four downloads", async () => {
		const run = await walk(
			[
				manifestOf(HAMMERS_BP),
			],
			[
				{
					name: "not downloadable",
					packs: null,
				},
				unrelated(1),
				unrelated(2),
				unrelated(3),
				{
					name: "v3.1.0 [Resource]",
					packs: [
						manifestOf(HAMMERS_RP),
					],
				},
			],
		);

		expect(run.dropped).toEqual([
			"unrelated 1",
			"unrelated 2",
			"unrelated 3",
		]);
		expect(run.kept).toEqual([
			"v3.1.0 [Resource]",
		]);
	});
});
