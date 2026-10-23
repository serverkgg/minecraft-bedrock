import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
	betaApisEnabled,
	type LevelFile,
	levelByte,
	levelExperiments,
	levelHardcore,
	levelLong,
	levelName,
	levelSeed,
	NbtTag,
	parseLevel,
	parseLevelExperiments,
	serializeLevel,
	withByte,
	withExperiment,
	withHardcore,
	withLevelName,
} from "./levelDat";

const name = (text: string) => {
	const bytes = new TextEncoder().encode(text);
	return [
		bytes.length & 0xff,
		(bytes.length >> 8) & 0xff,
		...bytes,
	];
};

const int32 = (value: number) => [
	value & 0xff,
	(value >> 8) & 0xff,
	(value >> 16) & 0xff,
	(value >> 24) & 0xff,
];

const level = (body: number[]) => {
	const root = [
		10,
		...name(""),
		...body,
		0,
	];
	return new Uint8Array([
		...int32(10),
		...int32(root.length),
		...root,
	]);
};

const byte = (key: string, value: number) => [
	1,
	...name(key),
	value,
];

const noise = [
	3,
	...name("NetworkVersion"),
	...int32(924),
	2,
	...name("Difficulty"),
	2,
	0,
	4,
	...name("RandomSeed"),
	0x15,
	0xcd,
	0x5b,
	0x07,
	0xff,
	0xff,
	0xff,
	0x7f,
	5,
	...name("lightningLevel"),
	0x00,
	0x00,
	0x80,
	0x3f,
	6,
	...name("currentTick"),
	0x18,
	0x2d,
	0x44,
	0x54,
	0xfb,
	0x21,
	0x09,
	0x40,
	8,
	...name("LevelName"),
	...name("ماب الربع"),
	7,
	...name("bytes"),
	...int32(3),
	1,
	2,
	3,
	9,
	...name("lastOpenedWithVersion"),
	3,
	...int32(2),
	...int32(1),
	...int32(26),
	9,
	...name("nested"),
	9,
	...int32(1),
	1,
	...int32(2),
	7,
	8,
	9,
	...name("empty"),
	0,
	...int32(0),
	11,
	...name("positions"),
	...int32(1),
	...int32(7),
	12,
	...name("stamps"),
	...int32(1),
	1,
	2,
	3,
	4,
	5,
	6,
	7,
	8,
	10,
	...name("abilities"),
	...byte("flying", 0),
	9,
	...name("layers"),
	10,
	...int32(2),
	...byte("a", 1),
	0,
	...byte("b", -1 & 0xff),
	0,
	0,
];

const experimentsLevel = (flags: number[]) =>
	level([
		...noise,
		10,
		...name("experiments"),
		...flags,
		0,
	]);

const fixture = () => new Uint8Array(readFileSync(new URL("./fixtures/level.dat", import.meta.url)));

const parsed = (bytes: Uint8Array): LevelFile => {
	const file = parseLevel(bytes);
	if (file === null) {
		throw new Error("fixture did not parse");
	}
	return file;
};

const without = (file: LevelFile, keys: string[]) =>
	file.root.entries.filter((entry) => !keys.includes(new TextDecoder().decode(entry.name)));

const rootKeys = (file: LevelFile) => file.root.entries.map((entry) => new TextDecoder().decode(entry.name));

const withoutExperiments = (file: LevelFile) =>
	serializeLevel({
		...file,
		root: {
			tag: NbtTag.Compound,
			entries: file.root.entries.filter((entry) => new TextDecoder().decode(entry.name) !== "experiments"),
		},
	});

describe("reading experiments from level.dat", () => {
	it("finds beta apis past every other kind of tag", () => {
		const experiments = parseLevelExperiments(
			experimentsLevel([
				...byte("gametest", 1),
				...byte("experiments_ever_used", 1),
			]),
		);

		expect(experiments).toEqual({
			gametest: 1,
			experiments_ever_used: 1,
		});
		expect(betaApisEnabled(experiments)).toBe(true);
	});

	it("reports beta apis off when the world never had experiments", () => {
		const experiments = parseLevelExperiments(level(noise));

		expect(experiments).toEqual({});
		expect(betaApisEnabled(experiments)).toBe(false);
	});

	it("reports beta apis off when the flag is present but zero", () => {
		expect(betaApisEnabled(parseLevelExperiments(experimentsLevel(byte("gametest", 0))))).toBe(false);
	});

	it("answers unknown rather than guessing for a truncated or foreign file", () => {
		const whole = experimentsLevel(byte("gametest", 1));

		expect(parseLevelExperiments(whole.slice(0, 30))).toBeNull();
		expect(parseLevelExperiments(new Uint8Array(4))).toBeNull();
		expect(betaApisEnabled(null)).toBeNull();
	});

	it("reads the level file a real 1.26.45 server generated", () => {
		expect(parseLevelExperiments(fixture())).toEqual({
			experiments_ever_used: 0,
			saved_with_toggled_experiments: 0,
		});
	});
});

describe("writing level.dat back", () => {
	it("writes a real server's level file back byte for byte", () => {
		const bytes = fixture();

		expect(serializeLevel(parsed(bytes))).toEqual(bytes);
	});

	it("writes every tag type back byte for byte, including longs, floats, arrays and nested lists", () => {
		const bytes = experimentsLevel(byte("gametest", 0));

		expect(serializeLevel(parsed(bytes))).toEqual(bytes);
	});

	it("turns beta apis on in a real level file and leaves every other tag exactly as it was", () => {
		const original = parsed(fixture());
		const written = serializeLevel(withExperiment(original, "gametest", 1));
		const reread = parsed(written);

		expect(levelExperiments(reread)).toEqual({
			experiments_ever_used: 0,
			saved_with_toggled_experiments: 0,
			gametest: 1,
		});
		expect(withoutExperiments(reread)).toEqual(withoutExperiments(original));
		expect(reread.version).toBe(original.version);
		expect(new DataView(written.buffer).getInt32(4, true)).toBe(written.length - 8);
	});

	it("adds the experiments compound to a world that never had one", () => {
		const written = serializeLevel(withExperiment(parsed(level(noise)), "gametest", 1));

		expect(parseLevelExperiments(written)).toEqual({
			gametest: 1,
		});
		expect(withoutExperiments(parsed(written))).toEqual(serializeLevel(parsed(level(noise))));
	});

	it("flips a flag that is present but off, without duplicating it", () => {
		const written = serializeLevel(withExperiment(parsed(experimentsLevel(byte("gametest", 0))), "gametest", 1));

		expect(parseLevelExperiments(written)).toEqual({
			gametest: 1,
		});
		expect(written.length).toBe(experimentsLevel(byte("gametest", 0)).length);
	});

	it("changes nothing when beta apis is already on", () => {
		const bytes = experimentsLevel(byte("gametest", 1));

		expect(serializeLevel(withExperiment(parsed(bytes), "gametest", 1))).toEqual(bytes);
	});
});

describe("reading and writing a root byte in level.dat", () => {
	it("reads a real server's hardcore byte, and answers null for a missing key or a tag that is not a byte", () => {
		const file = parsed(fixture());

		expect(levelByte(file, "IsHardcore")).toBe(0);
		expect(levelByte(file, "Difficulty")).toBeNull();
		expect(levelByte(file, "NoSuchTag")).toBeNull();
		expect(levelHardcore(file)).toBe(false);
	});

	it("replaces a root byte where it stands, without duplicating it or touching any other tag", () => {
		const bytes = fixture();
		const original = parsed(bytes);
		const written = serializeLevel(withByte(original, "IsHardcore", 1));
		const reread = parsed(written);

		expect(levelByte(reread, "IsHardcore")).toBe(1);
		expect(rootKeys(reread)).toEqual(rootKeys(original));
		expect(
			without(reread, [
				"IsHardcore",
			]),
		).toEqual(
			without(original, [
				"IsHardcore",
			]),
		);
		expect(written.length).toBe(bytes.length);
	});

	it("appends a root byte the level never had, after every existing tag", () => {
		const original = parsed(level(noise));
		const written = serializeLevel(withByte(original, "IsHardcore", 1));
		const reread = parsed(written);

		expect(rootKeys(reread)).toEqual([
			...rootKeys(original),
			"IsHardcore",
		]);
		expect(levelByte(reread, "IsHardcore")).toBe(1);
		expect(
			without(reread, [
				"IsHardcore",
			]),
		).toEqual(original.root.entries);
		expect(new DataView(written.buffer).getInt32(4, true)).toBe(written.length - 8);
	});
});

describe("reading the seed from level.dat", () => {
	it("reads a real server's seed as the decimal it would type into level-seed", () => {
		const file = parsed(fixture());

		expect(levelLong(file, "RandomSeed")).toBe(6396108708387762195n);
		expect(levelSeed(file)).toBe("6396108708387762195");
	});

	it("reads a long past every other kind of tag, as eight little-endian bytes", () => {
		expect(levelSeed(parsed(level(noise)))).toBe("9223372032683265301");
	});

	it("reads a negative seed as signed", () => {
		const file = parsed(
			level([
				4,
				...name("RandomSeed"),
				...new Array<number>(8).fill(0xff),
			]),
		);

		expect(levelSeed(file)).toBe("-1");
	});

	it("answers null for a missing seed or a tag that is not a long", () => {
		const file = parsed(fixture());

		expect(levelLong(file, "Difficulty")).toBeNull();
		expect(levelLong(file, "NoSuchTag")).toBeNull();
		expect(levelSeed(parsed(level(byte("IsHardcore", 0))))).toBeNull();
	});
});

describe("switching hardcore in level.dat", () => {
	it("turns hardcore on and off in a real level file and changes only that byte", () => {
		const bytes = fixture();
		const on = serializeLevel(withHardcore(parsed(bytes), true));
		const off = serializeLevel(withHardcore(parsed(on), false));

		expect(levelHardcore(parsed(on))).toBe(true);
		expect(levelHardcore(parsed(off))).toBe(false);
		expect(on.filter((value, index) => value !== bytes[index]).length).toBe(1);
		expect(off).toEqual(bytes);
	});
});

describe("naming the world in level.dat", () => {
	it("renames a real server's world and leaves every other tag exactly as it was", () => {
		const bytes = fixture();
		const original = parsed(bytes);
		const written = serializeLevel(withLevelName(original, "world-old"));
		const reread = parsed(written);

		expect(levelName(original)).toBe("world");
		expect(levelName(reread)).toBe("world-old");
		expect(rootKeys(reread)).toEqual(rootKeys(original));
		expect(
			without(reread, [
				"LevelName",
			]),
		).toEqual(
			without(original, [
				"LevelName",
			]),
		);
		expect(written.length).toBe(bytes.length + "-old".length);
		expect(new DataView(written.buffer).getInt32(4, true)).toBe(written.length - 8);
	});

	it("writes a real server's level file back byte for byte when the name does not change", () => {
		const bytes = fixture();

		expect(serializeLevel(withLevelName(parsed(bytes), "world"))).toEqual(bytes);
	});

	it("replaces a name found past every other kind of tag, without duplicating it", () => {
		const original = parsed(level(noise));
		const reread = parsed(serializeLevel(withLevelName(original, "skyblock")));

		expect(levelName(original)).toBe("ماب الربع");
		expect(levelName(reread)).toBe("skyblock");
		expect(rootKeys(reread)).toEqual(rootKeys(original));
	});

	it("appends the name to a level that never had one, as a length in bytes and the UTF-8 text", () => {
		const written = serializeLevel(withLevelName(parsed(level(byte("IsHardcore", 0))), "ماب-old"));

		expect(written).toEqual(
			level([
				...byte("IsHardcore", 0),
				8,
				...name("LevelName"),
				...name("ماب-old"),
			]),
		);
		expect(levelName(parsed(written))).toBe("ماب-old");
	});

	it("answers null for a missing name or a tag that is not a string", () => {
		expect(levelName(parsed(level(byte("IsHardcore", 0))))).toBeNull();
		expect(levelName(parsed(level(byte("LevelName", 1))))).toBeNull();
	});
});
