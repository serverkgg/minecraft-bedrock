import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { levelHardcore, NbtTag, parseLevel } from "./levelDat";
import { worlds } from "./worlds";

const SECRET = "hunter2-super-secret";

const harness = () => {
	const properties: Record<string, string> = {
		"level-name": "world",
	};
	const removed: string[] = [];
	const reports: Bridge.Activity[] = [];
	const context = {
		server: {
			running: false,
			publicAddress: null,
		},
		variable: () => SECRET,
		exec: async () => ({
			code: 0,
			stdout: "worlds/world/level.dat\nworlds/skyblock/level.dat",
			stderr: "",
		}),
		codec: {
			properties: {
				read: async () => ({
					...properties,
				}),
				merge: async (_path: string, values: Record<string, string>) => {
					Object.assign(properties, values);
				},
			},
		},
		files: {
			exists: async () => false,
			size: async () => 100,
			remove: async (path: string) => {
				removed.push(path);
			},
		},
		log: Object.assign(() => {}, {
			warn: () => {},
			error: () => {},
		}),
		activity: {
			report: (entry: Bridge.Activity) => {
				reports.push(entry);
			},
		},
	} as unknown as Bridge.Context;
	return {
		context,
		properties,
		removed,
		reports,
	};
};

const SKYBLOCK: Bridge.Row = {
	id: "skyblock",
	name: "Skyblock",
	folder: "skyblock",
};

describe("reporting world changes", () => {
	it("activating a world reports it and the world it replaced", async () => {
		const run = harness();
		await worlds.actions?.activate?.(run.context, SKYBLOCK, {});
		expect(run.properties["level-name"]).toBe("skyblock");
		expect(run.reports).toEqual([
			{
				name: BridgeEventName.WorldActivated,
				text: {
					ar: "تم تفعيل ماب skyblock بدلًا من world",
					en: "Activated world skyblock in place of world",
				},
				subject: "skyblock",
				details: {
					folder: "skyblock",
					previous: "world",
				},
			},
		]);
		expect(JSON.stringify(run.reports)).not.toContain(SECRET);
	});

	it("deleting a world reports the folder it removed", async () => {
		const run = harness();
		await worlds.actions?.delete?.(run.context, SKYBLOCK, {});
		expect(run.removed).toEqual([
			"worlds/skyblock",
		]);
		expect(run.reports.at(0)).toMatchObject({
			name: BridgeEventName.WorldDeleted,
			subject: "skyblock",
		});
	});

	it("a refused activation reports nothing", async () => {
		const run = harness();
		await expect(
			worlds.actions?.activate?.(
				run.context,
				{
					id: "world",
					name: "world",
				},
				{},
			),
		).rejects.toThrow();
		expect(run.reports).toEqual([]);
	});
});

describe("which world actions apply", () => {
	const listedRow = async (context: Bridge.Context, id: string) => {
		const row = (await worlds.list(context)).find((entry) => entry.id === id);

		if (!row) {
			throw new Error(`the list built no row for ${id}`);
		}

		return row;
	};

	it("the active world cannot be deleted or activated, and says why in the words the refusal uses", async () => {
		const run = harness();
		const active = await listedRow(run.context, "world");

		const unavailable = await worlds.unavailable?.(run.context, active);

		expect(Object.keys(unavailable ?? {}).sort()).toEqual([
			"activate",
			"delete",
		]);
		await expect(worlds.actions?.delete?.(run.context, active, {})).rejects.toThrow(unavailable?.delete?.en);
		await expect(worlds.actions?.activate?.(run.context, active, {})).rejects.toThrow(unavailable?.activate?.en);
		expect(run.removed).toEqual([]);
	});

	it("any other world, and a row that carries only its id, keeps every action", async () => {
		const run = harness();

		expect(await worlds.unavailable?.(run.context, await listedRow(run.context, "skyblock"))).toEqual({});
		expect(
			await worlds.unavailable?.(run.context, {
				id: "skyblock",
			}),
		).toEqual({});
	});
});

const LEVEL = "worlds/world/level.dat";

const hardcoreHarness = (running = false) => {
	const stored = new Map<string, Uint8Array>([
		[
			LEVEL,
			new Uint8Array(readFileSync(new URL("./fixtures/level.dat", import.meta.url))),
		],
		[
			"worlds/world/db/CURRENT",
			new Uint8Array(),
		],
	]);
	const reports: Bridge.Activity[] = [];
	const under = (path: string) =>
		[
			...stored.keys(),
		].filter((key) => key === path || key.startsWith(`${path}/`));
	const context = {
		server: {
			running,
			publicAddress: null,
		},
		exec: async (argv: string[]) => {
			if (argv[0] === "find") {
				return {
					code: 0,
					stdout: [
						...stored.keys(),
					]
						.filter((key) => key.endsWith("/level.dat"))
						.join("\n"),
					stderr: "",
				};
			}
			if (argv[0] === "base64") {
				return {
					code: 0,
					stdout: Buffer.from(stored.get(argv.at(-1) ?? "") ?? new Uint8Array()).toString("base64"),
					stderr: "",
				};
			}
			const [, , , , encoded = "", staged = ""] = argv;
			stored.set(staged, new Uint8Array(Buffer.from(new TextDecoder().decode(stored.get(encoded)), "base64")));
			return {
				code: 0,
				stdout: "",
				stderr: "",
			};
		},
		codec: {
			properties: {
				read: async () => ({
					"level-name": "world",
				}),
			},
		},
		files: {
			exists: async (path: string) => under(path).length > 0,
			read: async (path: string) => new TextDecoder().decode(stored.get(path)),
			write: async (path: string, contents: string) => {
				stored.set(path, new TextEncoder().encode(contents));
			},
			ensure: async () => {},
			size: async () => 100,
			remove: async (path: string) => {
				for (const key of under(path)) {
					stored.delete(key);
				}
			},
			move: async (source: string, destination: string) => {
				for (const key of under(source)) {
					stored.set(`${destination}${key.slice(source.length)}`, stored.get(key) ?? new Uint8Array());
					stored.delete(key);
				}
			},
		},
		log: Object.assign(() => {}, {
			warn: () => {},
			error: () => {},
		}),
		activity: {
			report: (entry: Bridge.Activity) => {
				reports.push(entry);
			},
		},
	} as unknown as Bridge.Context;
	const level = () => {
		const file = parseLevel(stored.get(LEVEL) ?? new Uint8Array());
		if (file === null) {
			throw new Error("the stored level file did not parse");
		}
		return file;
	};
	return {
		context,
		reports,
		level,
		stored,
	};
};

const WORLD: Bridge.Row = {
	id: "world",
};

describe("switching hardcore on a world", () => {
	it("turns hardcore on in the world's level file, leaves the difficulty alone and reports it", async () => {
		const run = hardcoreHarness();

		await worlds.actions?.hardcore?.(run.context, WORLD, {
			enabled: true,
		});

		expect(levelHardcore(run.level())).toBe(true);
		expect(
			run.level().root.entries.find((entry) => new TextDecoder().decode(entry.name) === "Difficulty")?.payload,
		).toEqual({
			tag: NbtTag.Int,
			value: 1,
		});
		expect(run.reports).toEqual([
			{
				name: BridgeEventName.GameplayChanged,
				text: {
					ar: "تم تفعيل الهاردكور في ماب world",
					en: "Turned on hardcore for world world",
				},
				subject: "world",
				details: {
					what: "hardcore",
					value: "on",
					folder: "world",
				},
			},
		]);
		expect(
			[
				...run.stored.keys(),
			].sort(),
		).toEqual([
			"worlds/world/db/CURRENT",
			LEVEL,
		]);
	});

	it("lists the world as hardcore once it is on, and turns it off again", async () => {
		const run = hardcoreHarness();

		expect((await worlds.list(run.context)).at(0)?.hardcore).toBe("");
		await worlds.actions?.hardcore?.(run.context, WORLD, {
			enabled: true,
		});
		expect((await worlds.list(run.context)).at(0)?.hardcore).toBe("✓");
		await worlds.actions?.hardcore?.(run.context, WORLD, {
			enabled: false,
		});

		expect(levelHardcore(run.level())).toBe(false);
		expect(run.reports.at(1)?.text.en).toBe("Turned off hardcore for world world");
	});

	it("refuses to set hardcore to the value the world already has, and writes nothing", async () => {
		const run = hardcoreHarness();
		const before = run.stored.get(LEVEL);

		await expect(
			worlds.actions?.hardcore?.(run.context, WORLD, {
				enabled: false,
			}),
		).rejects.toThrow("Hardcore is already off for this world.");
		expect(run.stored.get(LEVEL)).toBe(before);
		expect(run.reports).toEqual([]);
	});

	it("refuses while the server is running", async () => {
		const run = hardcoreHarness(true);

		await expect(
			worlds.actions?.hardcore?.(run.context, WORLD, {
				enabled: true,
			}),
		).rejects.toThrow("Stop the server");
		expect(levelHardcore(run.level())).toBe(false);
	});
});
