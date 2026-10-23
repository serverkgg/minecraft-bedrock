import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { levelHardcore, levelName, NbtTag, parseLevel, serializeLevel, withLevelName } from "./levelDat";
import { worlds } from "./worlds";
import { NO_ACTIVE_WORLD, ONLY_WORLD, worldTools } from "./worldTools";

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

	it("any other world, and a row that carries only its id, keeps every action but the reset", async () => {
		const run = harness();
		const other = await listedRow(run.context, "skyblock");

		const unavailable = await worlds.unavailable?.(run.context, other);

		expect(Object.keys(unavailable ?? {})).toEqual([
			"resetWorld",
		]);
		expect(
			await worlds.unavailable?.(run.context, {
				id: "skyblock",
			}),
		).toEqual(unavailable ?? {});
		await expect(worlds.actions?.resetWorld?.(run.context, other, {})).rejects.toThrow(unavailable?.resetWorld?.en);
		expect(run.removed).toEqual([]);
		expect(run.reports).toEqual([]);
	});
});

const LEVEL = "worlds/world/level.dat";

const LEVEL_BYTES = new Uint8Array(readFileSync(new URL("./fixtures/level.dat", import.meta.url)));

const SEED = "6396108708387762195";

const renamed = (name: string) => {
	const file = parseLevel(LEVEL_BYTES);
	if (file === null) {
		throw new Error("the fixture level file did not parse");
	}
	return serializeLevel(withLevelName(file, name));
};

const worldHarness = (running = false, extra: Record<string, Uint8Array | string> = {}) => {
	const stored = new Map<string, Uint8Array>([
		[
			LEVEL,
			LEVEL_BYTES,
		],
		[
			"worlds/world/db/CURRENT",
			new Uint8Array(),
		],
		...Object.entries(extra).map(
			([path, contents]): [
				string,
				Uint8Array,
			] => [
				path,
				typeof contents === "string" ? new TextEncoder().encode(contents) : contents,
			],
		),
	]);
	const properties: Record<string, string> = {
		"level-name": "world",
	};
	const ensured: string[] = [];
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
			if (argv[0] === "find" && argv.includes("-type")) {
				return {
					code: 0,
					stdout: "",
					stderr: "",
				};
			}
			if (argv[0] === "cp") {
				const [, , , source = "", destination = ""] = argv;
				for (const key of under(source)) {
					stored.set(`${destination}${key.slice(source.length)}`, stored.get(key) ?? new Uint8Array());
				}
				return {
					code: 0,
					stdout: "",
					stderr: "",
				};
			}
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
					...properties,
				}),
				merge: async (_path: string, values: Record<string, string>) => {
					Object.assign(properties, values);
				},
			},
		},
		files: {
			exists: async (path: string) => under(path).length > 0,
			read: async (path: string) => new TextDecoder().decode(stored.get(path)),
			write: async (path: string, contents: string) => {
				stored.set(path, new TextEncoder().encode(contents));
			},
			ensure: async (...paths: string[]) => {
				ensured.push(...paths);
			},
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
	const level = (path = LEVEL) => {
		const file = parseLevel(stored.get(path) ?? new Uint8Array());
		if (file === null) {
			throw new Error("the stored level file did not parse");
		}
		return file;
	};
	const text = (path: string) => new TextDecoder().decode(stored.get(path));
	const paths = () =>
		[
			...stored.keys(),
		].sort();
	return {
		context,
		reports,
		level,
		stored,
		properties,
		ensured,
		text,
		paths,
	};
};

const WORLD: Bridge.Row = {
	id: "world",
};

describe("switching hardcore on a world", () => {
	it("turns hardcore on in the world's level file, leaves the difficulty alone and reports it", async () => {
		const run = worldHarness();

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
		const run = worldHarness();

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
		const run = worldHarness();
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
		const run = worldHarness(true);

		await expect(
			worlds.actions?.hardcore?.(run.context, WORLD, {
				enabled: true,
			}),
		).rejects.toThrow("Stop the server");
		expect(levelHardcore(run.level())).toBe(false);
	});
});

const ADDONS = {
	"worlds/world/world_behavior_packs.json": '[{"pack_id":"b1","version":[1,0,0]}]',
	"worlds/world/world_resource_packs.json": '[{"pack_id":"r1","version":[1,0,0]}]',
	"worlds/world/behavior_packs/b1/manifest.json": "{}",
	"worlds/world/resource_packs/r1/manifest.json": "{}",
};

describe("resetting the active world", () => {
	it("moves the world to a -old folder named after itself in levelname.txt and level.dat, and sets its seed for the next start", async () => {
		const run = worldHarness();

		await worlds.actions?.resetWorld?.(run.context, WORLD, {});

		expect(run.paths()).toEqual([
			"worlds/world-old/db/CURRENT",
			"worlds/world-old/level.dat",
			"worlds/world-old/levelname.txt",
		]);
		expect(run.stored.get("worlds/world-old/level.dat")).toEqual(renamed("world-old"));
		expect(levelName(run.level("worlds/world-old/level.dat"))).toBe("world-old");
		expect(run.text("worlds/world-old/levelname.txt")).toBe("world-old");
		expect(run.properties).toEqual({
			"level-name": "world",
			"level-seed": SEED,
		});
		expect(run.ensured).toContain("worlds/world");
	});

	it("reports the reset with the folder it kept the old world in", async () => {
		const run = worldHarness();

		await worlds.actions?.resetWorld?.(run.context, WORLD, {});

		expect(run.reports).toEqual([
			{
				name: BridgeEventName.WorldWiped,
				text: {
					ar: "تم ريسيت ماب world، وحُفظ الماب السابق باسم world-old",
					en: "Reset world world, previous world kept as world-old",
				},
				subject: "world",
				details: {
					folder: "world",
					scope: "world",
				},
			},
		]);
	});

	it("copies the add-ons activated on the world back into the fresh folder, and nothing else", async () => {
		const run = worldHarness(false, ADDONS);

		await worlds.actions?.resetWorld?.(run.context, WORLD, {});

		expect(run.paths().filter((path) => path.startsWith("worlds/world/"))).toEqual(Object.keys(ADDONS).sort());
		for (const [path, contents] of Object.entries(ADDONS)) {
			expect(run.text(path)).toBe(contents);
			expect(run.text(path.replace("worlds/world/", "worlds/world-old/"))).toBe(contents);
		}
	});

	it("numbers the archive when an -old world is already there, and leaves that one alone", async () => {
		const run = worldHarness(false, {
			"worlds/world-old/level.dat": "older",
		});

		await worlds.actions?.resetWorld?.(run.context, WORLD, {});

		expect(run.text("worlds/world-old/level.dat")).toBe("older");
		expect(levelName(run.level("worlds/world-old-2/level.dat"))).toBe("world-old-2");
		expect(run.text("worlds/world-old-2/levelname.txt")).toBe("world-old-2");
		expect(run.reports.at(0)?.text.en).toBe("Reset world world, previous world kept as world-old-2");
	});

	it("refuses when the world file has no readable seed, and moves and writes nothing", async () => {
		const run = worldHarness(false, {
			[LEVEL]: "not a level file",
		});
		const before = run.paths();

		await expect(worlds.actions?.resetWorld?.(run.context, WORLD, {})).rejects.toThrow(
			"We couldn't read the seed from the world's level.dat, so the world wasn't reset.",
		);
		expect(run.paths()).toEqual(before);
		expect(run.properties).toEqual({
			"level-name": "world",
		});
		expect(run.ensured).toEqual([]);
		expect(run.reports).toEqual([]);
	});

	it("refuses a world that is not the active one before it moves anything", async () => {
		const run = worldHarness(false, {
			"worlds/skyblock/level.dat": LEVEL_BYTES,
		});
		const before = run.paths();

		await expect(
			worlds.actions?.resetWorld?.(
				run.context,
				{
					id: "skyblock",
				},
				{},
			),
		).rejects.toThrow("You can only reset the active world.");
		expect(run.paths()).toEqual(before);
		expect(run.properties["level-seed"]).toBeUndefined();
		expect(run.reports).toEqual([]);
	});
});

describe("cloning a world", () => {
	it("names the copy after its folder in levelname.txt and level.dat, and leaves the source alone", async () => {
		const run = worldHarness();

		await worlds.actions?.clone?.(run.context, WORLD, {
			name: "copy",
		});

		expect(run.paths()).toEqual([
			"worlds/copy/db/CURRENT",
			"worlds/copy/level.dat",
			"worlds/copy/levelname.txt",
			"worlds/world/db/CURRENT",
			LEVEL,
		]);
		expect(run.stored.get("worlds/copy/level.dat")).toEqual(renamed("copy"));
		expect(levelName(run.level("worlds/copy/level.dat"))).toBe("copy");
		expect(run.text("worlds/copy/levelname.txt")).toBe("copy");
		expect(run.stored.get(LEVEL)).toBe(LEVEL_BYTES);
		expect(run.reports.at(0)).toMatchObject({
			name: BridgeEventName.WorldCloned,
			subject: "copy",
		});
	});

	it("refuses a world whose level file cannot be read, and publishes nothing", async () => {
		const run = worldHarness(false, {
			[LEVEL]: "not a level file",
		});
		const before = run.paths();

		await expect(
			worlds.actions?.clone?.(run.context, WORLD, {
				name: "copy",
			}),
		).rejects.toThrow("We couldn't read the world's level.dat, so the world wasn't copied.");
		expect(run.paths()).toEqual(before);
		expect(run.reports).toEqual([]);
	});
});

const ORIGINAL = {
	"worlds/original/level.dat": renamed("original"),
	"worlds/original/levelname.txt": "original",
	"worlds/original/db/CURRENT": "original-db",
	"worlds/original/world_behavior_packs.json": '[{"pack_id":"copy","version":[1,0,0]}]',
	"worlds/world/levelname.txt": "world",
	"worlds/world/marker.txt": "built",
	"worlds/world/world_behavior_packs.json": '[{"pack_id":"played","version":[1,0,0]}]',
};

const failingCopy = (context: Bridge.Context): Bridge.Context => ({
	...context,
	exec: async (argv: string[], options) =>
		argv[0] === "cp"
			? {
					code: 1,
					stdout: "",
					stderr: "cp: error writing: No space left on device",
				}
			: await context.exec(argv, options),
});

describe("resetting the active world from a copy", () => {
	it("moves the active world to -old and puts a copy of the source under the active folder, named after it", async () => {
		const run = worldHarness(false, ORIGINAL);

		await worldTools.actions.resetFromCopy?.(run.context, {
			source: "original",
		});

		expect(run.paths()).toEqual([
			"worlds/original/db/CURRENT",
			"worlds/original/level.dat",
			"worlds/original/levelname.txt",
			"worlds/original/world_behavior_packs.json",
			"worlds/world-old/db/CURRENT",
			"worlds/world-old/level.dat",
			"worlds/world-old/levelname.txt",
			"worlds/world-old/marker.txt",
			"worlds/world-old/world_behavior_packs.json",
			"worlds/world/db/CURRENT",
			LEVEL,
			"worlds/world/levelname.txt",
			"worlds/world/world_behavior_packs.json",
		]);
		expect(run.text("worlds/world-old/marker.txt")).toBe("built");
		expect(run.text("worlds/world-old/levelname.txt")).toBe("world-old");
		expect(levelName(run.level("worlds/world-old/level.dat"))).toBe("world-old");
		expect(run.text("worlds/world/db/CURRENT")).toBe("original-db");
		expect(run.text("worlds/world/world_behavior_packs.json")).toBe(
			ORIGINAL["worlds/original/world_behavior_packs.json"],
		);
		expect(run.text("worlds/world/levelname.txt")).toBe("world");
		expect(run.stored.get(LEVEL)).toEqual(renamed("world"));
		expect(levelName(run.level())).toBe("world");
		expect(run.stored.get("worlds/original/level.dat")).toEqual(renamed("original"));
		expect(run.text("worlds/original/levelname.txt")).toBe("original");
		expect(run.properties).toEqual({
			"level-name": "world",
		});
	});

	it("reports the reset with the source and the folder it kept the old world in", async () => {
		const run = worldHarness(false, ORIGINAL);

		await worldTools.actions.resetFromCopy?.(run.context, {
			source: "original",
		});

		expect(run.reports).toEqual([
			{
				name: BridgeEventName.WorldWiped,
				text: {
					ar: "تم ريسيت ماب world من نسخة original، وحُفظ الماب السابق باسم world-old",
					en: "Reset world world from the copy original, previous world kept as world-old",
				},
				subject: "world",
				details: {
					folder: "world",
					scope: "copy",
					source: "original",
				},
			},
		]);
	});

	it("numbers the archive and the copy when those names are taken, and leaves the existing ones alone", async () => {
		const run = worldHarness(false, {
			...ORIGINAL,
			"worlds/world-old/level.dat": "older",
			"worlds/world-new/level.dat": "newer",
		});

		await worldTools.actions.resetFromCopy?.(run.context, {
			source: "original",
		});

		expect(run.text("worlds/world-old/level.dat")).toBe("older");
		expect(run.text("worlds/world-new/level.dat")).toBe("newer");
		expect(run.text("worlds/world-old-2/marker.txt")).toBe("built");
		expect(levelName(run.level("worlds/world-old-2/level.dat"))).toBe("world-old-2");
		expect(run.paths().some((path) => path.startsWith("worlds/world-new-2"))).toBe(false);
		expect(run.reports.at(0)?.text.en).toBe(
			"Reset world world from the copy original, previous world kept as world-old-2",
		);
	});

	it("refuses the active world as its own source before it copies or moves anything", async () => {
		const run = worldHarness(false, ORIGINAL);
		const before = run.paths();

		await expect(
			worldTools.actions.resetFromCopy?.(run.context, {
				source: "world",
			}),
		).rejects.toThrow("You can't reset the active world from itself.");
		expect(run.paths()).toEqual(before);
		expect(run.reports).toEqual([]);
	});

	it("refuses a source that is not in the Worlds list", async () => {
		const run = worldHarness(false, ORIGINAL);
		const before = run.paths();

		await expect(
			worldTools.actions.resetFromCopy?.(run.context, {
				source: "missing",
			}),
		).rejects.toThrow("We couldn't find that world.");
		expect(run.paths()).toEqual(before);
		expect(run.reports).toEqual([]);
	});

	it("refuses when the active world has no folder yet, and says so in the words the panel shows", async () => {
		const run = worldHarness(false, ORIGINAL);
		run.properties["level-name"] = "fresh";
		const before = run.paths();

		expect(await worldTools.unavailable?.(run.context)).toEqual({
			resetFromCopy: NO_ACTIVE_WORLD,
		});
		await expect(
			worldTools.actions.resetFromCopy?.(run.context, {
				source: "original",
			}),
		).rejects.toThrow(NO_ACTIVE_WORLD.en);
		expect(run.paths()).toEqual(before);
		expect(run.properties).toEqual({
			"level-name": "fresh",
		});
		expect(run.reports).toEqual([]);
	});

	it("is unavailable when the active world is the only one listed, and the handler refuses with the same words", async () => {
		const run = worldHarness();
		const before = run.paths();

		expect(await worldTools.unavailable?.(run.context)).toEqual({
			resetFromCopy: ONLY_WORLD,
		});
		await expect(
			worldTools.actions.resetFromCopy?.(run.context, {
				source: "world",
			}),
		).rejects.toThrow(ONLY_WORLD.en);
		expect(run.paths()).toEqual(before);
		expect(run.reports).toEqual([]);
	});

	it("is available once another world is listed", async () => {
		const run = worldHarness(false, ORIGINAL);

		expect(await worldTools.unavailable?.(run.context)).toEqual({});
	});

	it("refuses after a failed copy and leaves the active world, the settings and the list as they were", async () => {
		const run = worldHarness(false, ORIGINAL);
		const context = failingCopy(run.context);
		const before = run.paths();
		const listed = await worlds.list(context);

		await expect(
			worldTools.actions.resetFromCopy?.(context, {
				source: "original",
			}),
		).rejects.toThrow("We couldn't copy the source world, so the world wasn't reset.");
		expect(run.paths()).toEqual(before);
		expect(run.stored.get(LEVEL)).toBe(LEVEL_BYTES);
		expect(run.properties).toEqual({
			"level-name": "world",
		});
		expect(await worlds.list(context)).toEqual(listed);
		expect(run.reports).toEqual([]);
	});

	it("refuses while the server is running", async () => {
		const run = worldHarness(true, ORIGINAL);
		const before = run.paths();

		await expect(
			worldTools.actions.resetFromCopy?.(run.context, {
				source: "original",
			}),
		).rejects.toThrow("Stop the server");
		expect(run.paths()).toEqual(before);
	});
});
