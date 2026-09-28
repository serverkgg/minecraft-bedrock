import { describe, expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { install } from "./install";

const fixture = (binary: boolean, selected: string | null, unavailable = false) => {
	const files = new Map<string, string>([
		[
			".serverk-install.json",
			JSON.stringify({
				channel: "release",
				version: "1.26.45.1",
				label: "1.26.45.1",
				files: [
					"bedrock_server",
				],
				packs: [],
			}),
		],
	]);
	if (binary) {
		files.set("bedrock_server", "old binary");
	}
	const downloads: string[] = [];
	let lookups = 0;
	const context = {
		server: {
			running: false,
			publicAddress: null,
		},
		portBlock: () => ({
			first: 20_000,
			count: 64,
		}),
		variable: (name: string) => (name === "BEDROCK_CHANNEL" ? "release" : selected),
		port: () => 19_132,
		emit: () => {},
		codec: {
			properties: {
				read: async () => ({}),
				merge: async () => {},
			},
		},
		net: {
			json: async () => {
				lookups++;
				return {
					result: {
						links: [
							{
								downloadType: "serverBedrockLinux",
								downloadUrl: "https://www.minecraft.net/bedrockdedicatedserver/bin-linux/bedrock-server-1.26.99.1.zip",
							},
						],
					},
				};
			},
		},
		log: Object.assign(() => {}, {
			warn: () => {},
			error: () => {},
		}),
		exec: async () => ({
			code: 0,
			stdout: "",
			stderr: "",
		}),
		files: {
			exists: async (path: string) => files.has(path),
			read: async (path: string) => files.get(path) ?? "",
			write: async (path: string, value: string) => {
				files.set(path, value);
			},
			ensure: async () => {},
			remove: async (path: string) => {
				for (const key of files.keys()) {
					if (key === path || key.startsWith(`${path}/`)) {
						files.delete(key);
					}
				}
			},
			move: async (source: string, target: string) => {
				const value = files.get(source);
				if (value === undefined) {
					throw new Error("missing staged file");
				}
				if (files.has(target)) {
					throw new Error("target exists");
				}
				files.set(target, value);
				files.delete(source);
			},
			download: async (path: string, url: string) => {
				downloads.push(url);
				if (unavailable) {
					throw new Error("download unavailable");
				}
				files.set(path, "archive");
			},
			extract: async (_path: string, destination: string) => {
				files.set(`${destination}/bedrock_server`, "new binary");
				return [
					`${destination}/bedrock_server`,
				];
			},
		},
	} as unknown as Bridge.Context;
	return {
		context,
		files,
		downloads,
		lookups: () => lookups,
	};
};

describe("restoring exact Bedrock builds", () => {
	test("ordinary automatic-selection restart does not look up or download latest", async () => {
		const run = fixture(true, null);
		await install.run(run.context);
		expect(run.lookups()).toBe(0);
		expect(run.downloads).toEqual([]);
		expect(run.files.get("bedrock_server")).toBe("old binary");
	});
	test("a restored stamp with no runtime reinstalls that concrete build", async () => {
		const run = fixture(false, null);
		await install.run(run.context);
		expect(run.downloads).toEqual([
			"https://www.minecraft.net/bedrockdedicatedserver/bin-linux/bedrock-server-1.26.45.1.zip",
		]);
		expect(JSON.parse(run.files.get(".serverk-install.json") ?? "{}").version).toBe("1.26.45.1");
	});
	test("an unavailable explicitly selected build fails without deleting the working runtime", async () => {
		const run = fixture(true, "1.26.90.1", true);
		await expect(install.run(run.context)).rejects.toThrow("download unavailable");
		expect(run.files.get("bedrock_server")).toBe("old binary");
		expect(JSON.parse(run.files.get(".serverk-install.json") ?? "{}").version).toBe("1.26.45.1");
	});
});
