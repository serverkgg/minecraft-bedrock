import { describe, expect, it } from "bun:test";
import { packDirectories } from "./packArchive";

describe("finding the packs inside an uploaded archive", () => {
	it("takes a bare .mcpack, whose manifest sits at the root", () => {
		expect(packDirectories(".serverk-packs/unpacked/manifest.json")).toEqual([
			".serverk-packs/unpacked",
		]);
	});

	it("takes every pack out of a .mcaddon that bundles several", () => {
		const output = [
			".serverk-packs/unpacked/CoolBP/manifest.json",
			".serverk-packs/unpacked/CoolRP/manifest.json",
		].join("\n");

		expect(packDirectories(output)).toEqual([
			".serverk-packs/unpacked/CoolBP",
			".serverk-packs/unpacked/CoolRP",
		]);
	});

	it("ignores a vendored sub-pack, which is not separately installable", () => {
		const output = [
			".serverk-packs/unpacked/CoolBP/manifest.json",
			".serverk-packs/unpacked/CoolBP/subpacks/extra/manifest.json",
		].join("\n");

		expect(packDirectories(output)).toEqual([
			".serverk-packs/unpacked/CoolBP",
		]);
	});

	it("answers empty when the archive carries no manifest at all", () => {
		expect(packDirectories("")).toEqual([]);
	});
});
