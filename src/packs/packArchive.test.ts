import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { HAMMERS_BP, HAMMERS_RP, manifestText } from "../testing";
import { discoverPacks, packDirectories } from "./packArchive";

const ROOT = ".serverk-staging/pack/unpacked";

const unpacking = (files: Map<string, string>, archives: Record<string, Record<string, string>>) => {
	const under = (path: string, directory: string) => path === directory || path.startsWith(`${directory}/`);
	return {
		exec: async (args: string[]) => {
			const root = args[1] ?? "";
			const depth = Number(args[3]);
			const archiveSearch = args.includes("-iname");
			const matches = [
				...files.keys(),
			].filter(
				(path) =>
					path.startsWith(`${root}/`)
					&& path.slice(root.length + 1).split("/").length <= depth
					&& (archiveSearch ? /\.(?:mcpack|mcaddon)$/i.test(path) : path.endsWith("/manifest.json")),
			);
			return {
				code: 0,
				stdout: matches.join("\n"),
				stderr: "",
			};
		},
		files: {
			exists: async (path: string) =>
				[
					...files.keys(),
				].some((key) => under(key, path)),
			read: async (path: string) => files.get(path) ?? "",
			size: async () => 0,
			ensure: async () => {},
			remove: async (path: string) => {
				for (const key of [
					...files.keys(),
				]) {
					if (under(key, path)) {
						files.delete(key);
					}
				}
			},
			extract: async (archive: string, destination: string) => {
				const entries = Object.entries(archives[archive] ?? {});
				for (const [entry, text] of entries) {
					files.set(`${destination}/${entry}`, text);
				}
				return entries.map(([entry]) => entry);
			},
		},
		log: Object.assign(() => {}, {
			warn: () => {},
			error: () => {},
		}),
	} as unknown as Bridge.Context;
};

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

describe("finding packs after the catalog unpacks each file into its own folder", () => {
	it("still reaches a pack inside a nested .mcpack of an .mcaddon, one folder deeper than an upload", async () => {
		const nested = `${ROOT}/9001/Wrapper/Hammers RP.mcpack`;
		const files = new Map([
			[
				nested,
				"",
			],
			[
				`${ROOT}/9002/manifest.json`,
				manifestText(HAMMERS_BP),
			],
		]);
		const context = unpacking(files, {
			[nested]: {
				"Vanilla Hammers RP/manifest.json": manifestText(HAMMERS_RP),
			},
		});

		const first = await discoverPacks(context, `${ROOT}/9001`);
		const second = await discoverPacks(context, `${ROOT}/9002`);
		const all = await discoverPacks(context, ROOT);

		expect(first.map((pack) => pack.directory)).toEqual([
			`${ROOT}/9001/Wrapper/Hammers RP/Vanilla Hammers RP`,
		]);
		expect(second.map((pack) => pack.directory)).toEqual([
			`${ROOT}/9002`,
		]);
		expect(all.map((pack) => pack.manifest.uuid)).toEqual([
			HAMMERS_RP.uuid,
			HAMMERS_BP.uuid,
		]);
	});
});
