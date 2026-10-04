import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { inventoryPacks, listPackManifests } from "./packDiscovery";

const manifest = (uuid: string, type: string) =>
	JSON.stringify({
		header: {
			uuid,
			name: "Pack",
			version: [
				1,
				0,
				0,
			],
		},
		modules: [
			{
				type,
			},
		],
	});

const contextWith = (files: Record<string, string>, level: string) => {
	const listed: (string | undefined)[] = [];
	const context = {
		files: {
			exists: async (path: string) => path in files,
			read: async (path: string) => {
				const text = files[path];
				if (text === undefined) {
					throw new Error(`missing ${path}`);
				}
				return text;
			},
			list: async (
				glob: string,
				options?: {
					directory?: string;
				},
			) => {
				listed.push(options?.directory);
				if (glob !== "**/manifest.json" || options?.directory === undefined) {
					throw new Error("unscoped listing");
				}
				const directory = options.directory;
				return Object.keys(files)
					.filter((path) => path.startsWith(`${directory}/`) && path.endsWith("/manifest.json"))
					.map((path) => ({
						path,
						name: "manifest.json",
						directory: false,
						sizeBytes: 0,
						modifiedAt: "",
					}));
			},
		},
		codec: {
			properties: {
				read: async () => ({
					"level-name": level,
				}),
			},
		},
		activity: {
			report: () => {},
		},
	} as unknown as Bridge.Context;
	return {
		context,
		listed,
	};
};

describe("finding installed packs", () => {
	it("walks only the pack folders of the server and the active world, never the whole server", async () => {
		const { context, listed } = contextWith(
			{
				"behavior_packs/Cool/manifest.json": manifest("8f3a1b2c-0000-0000-0000-000000000001", "data"),
				"behavior_packs/Cool/subpacks/extra/manifest.json": manifest("8f3a1b2c-0000-0000-0000-000000000005", "data"),
				"resource_packs/Look/manifest.json": manifest("8f3a1b2c-0000-0000-0000-000000000002", "resources"),
				"worlds/world/behavior_packs/Local/manifest.json": manifest("8f3a1b2c-0000-0000-0000-000000000003", "data"),
				"worlds/other/behavior_packs/Foreign/manifest.json": manifest("8f3a1b2c-0000-0000-0000-000000000004", "data"),
			},
			"world",
		);

		const sidecar = await inventoryPacks(context);

		expect(listed).toEqual([
			"behavior_packs",
			"resource_packs",
			"worlds/world/behavior_packs",
			"worlds/world/resource_packs",
		]);
		expect(
			Object.values(sidecar.packs)
				.map((pack) => pack.folder)
				.sort(),
		).toEqual([
			"behavior_packs/Cool",
			"resource_packs/Look",
			"worlds/world/behavior_packs/Local",
		]);
	});

	it("skips the world folders when the level name is one the file listing would refuse", async () => {
		const { context, listed } = contextWith(
			{
				"behavior_packs/Cool/manifest.json": manifest("8f3a1b2c-0000-0000-0000-000000000001", "data"),
			},
			"..",
		);

		const sidecar = await inventoryPacks(context);

		expect(listed).toEqual([
			"behavior_packs",
			"resource_packs",
		]);
		expect(Object.keys(sidecar.packs)).toEqual([
			"8f3a1b2c-0000-0000-0000-000000000001",
		]);
	});

	it("returns manifests in the order the directories were given", async () => {
		const { context } = contextWith(
			{
				"behavior_packs/Cool/manifest.json": manifest("8f3a1b2c-0000-0000-0000-000000000001", "data"),
				"worlds/world/behavior_packs/Local/manifest.json": manifest("8f3a1b2c-0000-0000-0000-000000000003", "data"),
			},
			"world",
		);

		const entries = await listPackManifests(context, [
			"worlds/world/behavior_packs",
			"behavior_packs",
		]);

		expect(entries.map((entry) => entry.path)).toEqual([
			"worlds/world/behavior_packs/Local/manifest.json",
			"behavior_packs/Cool/manifest.json",
		]);
	});
});
