import { describe, expect, it } from "bun:test";
import { BEDROCK_GAME_ID, CLASS_ADDONS, CLASS_TEXTURE_PACKS, decodeRef, encodeRef, PROVIDER } from "./curseforgePacks";

describe("pointing the catalog at bedrock and not at java", () => {
	it("uses the bedrock game, confirmed against the live curseforge api", () => {
		expect(BEDROCK_GAME_ID).toBe(78_022);
	});

	it("never uses java's game id, which would fill the tab with mods that cannot run here", () => {
		expect(BEDROCK_GAME_ID).not.toBe(432);
	});

	it("knows the two classes worth browsing on a server", () => {
		expect(CLASS_ADDONS).toBe(4984);
		expect(CLASS_TEXTURE_PACKS).toBe(6929);
	});
});

describe("carrying a catalog project through install and back", () => {
	it("round-trips a project id", () => {
		expect(decodeRef(encodeRef(103_408))).toBe("103408");
	});

	it("marks the entry with its provider so the panel can tell it apart from an upload", () => {
		expect(encodeRef(1)).toBe(`${PROVIDER}:1`);
	});

	it("answers null for a bare uuid, which is what an uploaded pack carries", () => {
		expect(decodeRef("8f3a1b2c-0000-0000-0000-000000000001")).toBeNull();
	});
});
