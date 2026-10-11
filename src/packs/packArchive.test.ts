import { describe, expect, it } from "bun:test";
import { packDirectories } from "./packArchive";

describe("finding the packs inside an uploaded archive", () => {
	it("takes a bare .mcpack, whose manifest sits at the root", () => {
		expect(packDirectories(".serverk-staging/pack/unpacked/manifest.json")).toEqual([
			".serverk-staging/pack/unpacked",
		]);
	});

	it("takes every pack out of a .mcaddon that bundles several", () => {
		const output = [
			".serverk-staging/pack/unpacked/CoolBP/manifest.json",
			".serverk-staging/pack/unpacked/CoolRP/manifest.json",
		].join("\n");

		expect(packDirectories(output)).toEqual([
			".serverk-staging/pack/unpacked/CoolBP",
			".serverk-staging/pack/unpacked/CoolRP",
		]);
	});

	it("ignores a vendored sub-pack, which is not separately installable", () => {
		const output = [
			".serverk-staging/pack/unpacked/CoolBP/manifest.json",
			".serverk-staging/pack/unpacked/CoolBP/subpacks/extra/manifest.json",
		].join("\n");

		expect(packDirectories(output)).toEqual([
			".serverk-staging/pack/unpacked/CoolBP",
		]);
	});

	it("answers empty when the archive carries no manifest at all", () => {
		expect(packDirectories("")).toEqual([]);
	});
});
