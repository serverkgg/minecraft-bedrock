import { describe, expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { existingWorld, exportWorld, validateWorldFolder, worldTools } from "./worldTools";

describe("safe world tools", () => {
	test("rejects separators and traversal while keeping existing world names with spaces", () => {
		for (const name of [
			"..",
			"../world",
			"world/../../config",
			"world\nstop",
			"",
		]) {
			expect(() => validateWorldFolder(name)).toThrow();
		}
		expect(validateWorldFolder("My World")).toBe("My World");
	});
	test("resolves rows against real worlds rather than trusting a submitted folder", async () => {
		const context = {
			exec: async () => ({
				code: 0,
				stdout: "worlds/real/level.dat",
				stderr: "",
			}),
		} as unknown as Bridge.Context;
		await expect(existingWorld(context, "forged")).rejects.toThrow();
		expect(await existingWorld(context, "real")).toBe("real");
	});
	test("creates a world with one property update, preserving the old worlds", async () => {
		const writes: Record<string, string>[] = [];
		const context = {
			server: {
				running: false,
				publicAddress: null,
			},
			portBlock: () => ({
				first: 20_000,
				count: 64,
			}),
			files: {
				exists: async () => false,
			},
			codec: {
				properties: {
					merge: async (_path: string, values: Record<string, string>) => {
						writes.push(values);
					},
				},
			},
			log: () => {},
		} as unknown as Bridge.Context;
		await worldTools.actions.create?.(context, {
			name: "New World",
			seed: "123",
		});
		expect(writes).toEqual([
			{
				"level-name": "New-World",
				"level-seed": "123",
			},
		]);
	});
	test("blocks a world change while the old world is still running", async () => {
		const context = {
			server: {
				running: true,
				publicAddress: null,
			},
			portBlock: () => ({
				first: 20_000,
				count: 64,
			}),
		} as unknown as Bridge.Context;
		await expect(
			worldTools.actions.create?.(context, {
				name: "new",
			}),
		).rejects.toThrow();
	});
	test("exports a world by listing only its own pack folders and the server pack folders", async () => {
		const uuid = "8f3a1b2c-0000-0000-0000-000000000001";
		const files: Record<string, string> = {
			"worlds/real/world_behavior_packs.json": JSON.stringify([
				{
					pack_id: uuid,
					version: [
						1,
						0,
						0,
					],
				},
			]),
			"behavior_packs/Cool/manifest.json": JSON.stringify({
				header: {
					uuid,
					name: "Cool",
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
		};
		const listed: (string | undefined)[] = [];
		const commands: string[][] = [];
		const context = {
			server: {
				running: false,
				publicAddress: null,
			},
			portBlock: () => ({
				first: 20_000,
				count: 64,
			}),
			exec: async (argv: string[]) => {
				commands.push(argv);
				return {
					code: 0,
					stdout: argv.includes("level.dat") ? "worlds/real/level.dat" : "",
					stderr: "",
				};
			},
			files: {
				exists: async (path: string) => path in files,
				read: async (path: string) => files[path] ?? "",
				write: async () => {},
				remove: async () => {},
				ensure: async () => {},
				move: async () => {},
				list: async (
					glob: string,
					options?: {
						directory?: string;
					},
				) => {
					listed.push(options?.directory);
					const directory = options?.directory;
					if (glob !== "**/manifest.json" || directory === undefined) {
						throw new Error("unscoped listing");
					}
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
			log: () => {},
		} as unknown as Bridge.Context;

		await exportWorld(context, "real");

		expect(listed).toEqual([
			"worlds/real/behavior_packs",
			"behavior_packs",
			"worlds/real/resource_packs",
			"resource_packs",
		]);
		expect(commands).toContainEqual([
			"cp",
			"-a",
			"--",
			"behavior_packs/Cool",
			`.serverk-world-export/world/behavior_packs/${uuid}`,
		]);
	});
});
