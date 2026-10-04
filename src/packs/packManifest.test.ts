import { describe, expect, it } from "bun:test";
import { PackKind, packKindOf, parsePackManifest, parsePackVersion } from "./packManifest";

const manifest = (
	modules: string[],
	version: unknown = [
		1,
		0,
		0,
	],
) =>
	JSON.stringify({
		header: {
			uuid: "8f3a1b2c-0000-0000-0000-000000000001",
			name: "pack.name",
			version,
		},
		modules: modules.map((type) => ({
			type,
		})),
	});

describe("telling a behavior pack from a resource pack", () => {
	it("reads a plain behavior pack", () => {
		expect(
			parsePackManifest(
				manifest([
					"data",
				]),
			)?.kind,
		).toBe(PackKind.Behavior);
	});

	it("reads a scripting pack, which carries no data module at all", () => {
		expect(
			parsePackManifest(
				manifest([
					"script",
				]),
			)?.kind,
		).toBe(PackKind.Behavior);
	});

	it("reads a behavior pack that also ships a client_data module", () => {
		expect(
			packKindOf([
				"data",
				"client_data",
			]),
		).toBe(PackKind.Behavior);
	});

	it("reads a resource pack", () => {
		expect(
			parsePackManifest(
				manifest([
					"resources",
				]),
			)?.kind,
		).toBe(PackKind.Resource);
	});

	it("calls a world template what it is, so the packs tab can send it to the worlds tab", () => {
		expect(
			parsePackManifest(
				manifest([
					"world_template",
				]),
			)?.kind,
		).toBe(PackKind.WorldTemplate);
	});

	it("answers null for a manifest with no module we can place", () => {
		expect(parsePackManifest(manifest([]))).toBeNull();
	});
});

describe("reading a pack version", () => {
	it("reads the array form every shipping pack uses", () => {
		expect(
			parsePackVersion([
				1,
				2,
				3,
			]),
		).toEqual({
			parts: [
				1,
				2,
				3,
			],
			text: "1.2.3",
		});
	});

	it("reads the semver string newer manifests are allowed to use", () => {
		expect(parsePackVersion("1.2.3")).toEqual({
			parts: [
				1,
				2,
				3,
			],
			text: "1.2.3",
		});
	});

	it("keeps a prerelease tag for display while still giving the triple the world file needs", () => {
		expect(parsePackVersion("1.2.3-beta.4")).toEqual({
			parts: [
				1,
				2,
				3,
			],
			text: "1.2.3-beta.4",
		});
	});

	it("answers null for a version it cannot read, rather than guessing zero", () => {
		expect(parsePackVersion("latest")).toBeNull();
		expect(parsePackVersion(undefined)).toBeNull();
	});
});

describe("reading a manifest the way the game does", () => {
	it("accepts comments and trailing commas, which community add-ons ship and the game allows", () => {
		const parsed = parsePackManifest(`/*
	Credits header left by the add-on author
*/
{
	"format_version": 1,
	"header": {
		"name": "M1A2 Tank Addon [BP]",
		"uuid": "a1825b12-610a-4bf5-aaa3-ba685b6d3c1f",
		"version": [1, 0, 0],
		"min_engine_version": [1, 8, 0]
	},
	// the behavior half
	"modules": [{ "type": "data", "uuid": "ebdbef84-1aee-4af1-b5e0-c917da03ad79", "version": [1, 0, 0] }],
	"dependencies": [{ "uuid": "692256f2-404b-4509-8df3-b5b6ec299d2d", "version": [1, 0, 0] },],
}`);

		expect(parsed?.uuid).toBe("a1825b12-610a-4bf5-aaa3-ba685b6d3c1f");
		expect(parsed?.kind).toBe(PackKind.Behavior);
		expect(parsed?.dependencies).toEqual([
			"692256f2-404b-4509-8df3-b5b6ec299d2d",
		]);
	});
});

describe("refusing a manifest that cannot be trusted", () => {
	it("answers null for unparsable json", () => {
		expect(parsePackManifest("{not json")).toBeNull();
	});

	it("answers null when the uuid is missing, because the world file is keyed by it", () => {
		expect(
			parsePackManifest(
				JSON.stringify({
					header: {
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
				}),
			),
		).toBeNull();
	});
});
