import { describe, expect, it } from "bun:test";
import { PRESERVE_ON_UPDATE, topLevelOf, vanillaPacksOf } from "./installGame";

const ENTRIES = [
	"bedrock_server",
	"libMinecraft.Server.Lib.a",
	"server.properties",
	"behavior_packs/vanilla/manifest.json",
	"behavior_packs/vanilla_1.21.40/manifest.json",
	"resource_packs/vanilla/textures/blocks.json",
	"definitions/entity/zombie.json",
	"worlds/",
];

describe("reading the archive inventory before unpacking it", () => {
	it("collects the top-level names, which is what a later upgrade deletes", () => {
		expect(topLevelOf(ENTRIES)).toEqual([
			"bedrock_server",
			"behavior_packs",
			"definitions",
			"libMinecraft.Server.Lib.a",
			"resource_packs",
			"server.properties",
			"worlds",
		]);
	});

	it("collects the vanilla pack folders this build ships, so a later build can sweep the stale ones", () => {
		expect(vanillaPacksOf(ENTRIES)).toEqual([
			"behavior_packs/vanilla",
			"behavior_packs/vanilla_1.21.40",
			"resource_packs/vanilla",
		]);
	});
});

describe("protecting what the player owns", () => {
	it("never deletes the world, the config or the player lists on an upgrade", () => {
		for (const name of [
			"worlds",
			"server.properties",
			"allowlist.json",
			"permissions.json",
		]) {
			expect(PRESERVE_ON_UPDATE).toContain(name);
		}
	});

	it("never deletes an installed add-on on an upgrade", () => {
		expect(PRESERVE_ON_UPDATE).toContain("behavior_packs");
		expect(PRESERVE_ON_UPDATE).toContain("resource_packs");
	});
});
