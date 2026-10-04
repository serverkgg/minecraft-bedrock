import { describe, expect, it } from "bun:test";
import { parseSaveFiles } from "./bedrockSave";

describe("Bedrock snapshot file boundaries", () => {
	it("reads both server-relative and world-relative reports including spaces", () => {
		expect(parseSaveFiles("My World/db/000123.ldb:42, worlds/My World/level.dat:12", "My World")).toEqual([
			{
				path: "worlds/My World/db/000123.ldb",
				size: 42,
			},
			{
				path: "worlds/My World/level.dat",
				size: 12,
			},
		]);
	});
	it("rejects another world, traversal and unsafe byte counts", () => {
		for (const report of [
			"other/db/file:42",
			"world/../secret:1",
			"world/db/file:9007199254740992",
			"world/db/file:-1",
		]) {
			expect(() => parseSaveFiles(report, "world")).toThrow();
		}
	});
	it("does not treat readiness alone as a complete snapshot", () => {
		expect(() => parseSaveFiles("Data saved. Files are now ready to be copied.", "world")).toThrow();
	});
});

it("fresh query subscription supplies a snapshot without reading old log tails", async () => {
	const { holdSave, holding, resumeSave } = await import("./bedrockSave");
	type Context = import("@serverkgg/bridge").Bridge.Context;
	let listener: ((match: RegExpMatchArray) => void) | null = null;
	let released = false;
	let queries = 0;
	const context = {
		files: {
			list: async () => [
				{
					path: "worlds/world/level.dat",
					sizeBytes: 24,
					directory: false,
				},
				{
					path: "worlds/world/behavior_packs/custom/manifest.json",
					sizeBytes: 64,
					directory: false,
				},
				{
					path: "worlds/world/db/unlisted.ldb",
					sizeBytes: 99,
					directory: false,
				},
				{
					path: "worlds/other/level.dat",
					sizeBytes: 24,
					directory: false,
				},
			],
		},
		codec: {
			properties: {
				read: async () => ({
					"level-name": "world",
				}),
			},
		},
		logs: {
			tail: async () => {
				throw new Error("must not read old log tails");
			},
			follow: (_pattern: RegExp, callback: (match: RegExpMatchArray) => void) => {
				listener = callback;
				return () => {
					released = true;
				};
			},
		},
		command: async (
			input: string,
			options: {
				expect?: RegExp;
			},
		) => {
			if (input === "save query") {
				queries++;
				const lines =
					queries === 1
						? [
								"A previous save has not been completed.",
							]
						: [
								"Data saved. Files are now ready to be copied.",
								"world/db/data.ldb:12",
							];
				for (const line of lines) {
					const match = line.match(/.+/);
					if (match !== null) {
						listener?.(match);
					}
				}
				expect(options.expect).toBeInstanceOf(RegExp);
			}
			return {
				sent: input,
				line: "",
				groups: {},
			};
		},
		activity: {
			report: () => {},
		},
	} as unknown as Context;
	try {
		expect(await holdSave(context)).toEqual({
			roots: [
				"worlds/world",
			],
			files: [
				{
					path: "worlds/world/db/data.ldb",
					size: 12,
				},
				{
					path: "worlds/world/level.dat",
					size: 24,
				},
				{
					path: "worlds/world/behavior_packs/custom/manifest.json",
					size: 64,
				},
			],
		});
		expect(queries).toBe(2);
		expect(released).toBe(true);
		expect(holding()).toBe(true);
	} finally {
		await resumeSave(context);
	}
	expect(holding()).toBe(false);
});
