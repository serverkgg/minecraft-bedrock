import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { execDetail } from "@serverkgg/bridge/utils";
import { LEVEL_FILE, publishFiles, requireStopped, worldPath } from "../shared";

const EXEC_TIMEOUT_MS = 10_000;

const MAX_DEPTH = 64;

const EXPERIMENTS_TAG = "experiments";

const HARDCORE_TAG = "IsHardcore";

const SEED_TAG = "RandomSeed";

const LEVEL_NAME_TAG = "LevelName";

const LEVEL_STAGING = ".serverk-level";

export const BETA_APIS_EXPERIMENT = "gametest";

export enum NbtTag {
	End = 0,
	Byte = 1,
	Short = 2,
	Int = 3,
	Long = 4,
	Float = 5,
	Double = 6,
	ByteArray = 7,
	String = 8,
	List = 9,
	Compound = 10,
	IntArray = 11,
	LongArray = 12,
}

export interface NbtNumber {
	tag: NbtTag.Byte | NbtTag.Short | NbtTag.Int;
	value: number;
}

export interface NbtRaw {
	tag: NbtTag.Long | NbtTag.Float | NbtTag.Double | NbtTag.String;
	bytes: Uint8Array;
}

export interface NbtArray {
	tag: NbtTag.ByteArray | NbtTag.IntArray | NbtTag.LongArray;
	count: number;
	bytes: Uint8Array;
}

export interface NbtList {
	tag: NbtTag.List;
	element: NbtTag;
	items: NbtPayload[];
}

export interface NbtCompound {
	tag: NbtTag.Compound;
	entries: NbtEntry[];
}

export type NbtPayload = NbtNumber | NbtRaw | NbtArray | NbtList | NbtCompound;

export interface NbtEntry {
	name: Uint8Array;
	payload: NbtPayload;
}

export interface LevelFile {
	version: number;
	name: Uint8Array;
	root: NbtCompound;
}

const FIXED_BYTES: Partial<Record<NbtTag, number>> = {
	[NbtTag.Long]: 8,
	[NbtTag.Float]: 4,
	[NbtTag.Double]: 8,
};

const ARRAY_ELEMENT_BYTES: Partial<Record<NbtTag, number>> = {
	[NbtTag.ByteArray]: 1,
	[NbtTag.IntArray]: 4,
	[NbtTag.LongArray]: 8,
};

interface Cursor {
	view: DataView;
	offset: number;
}

const encoder = new TextEncoder();

const decoder = new TextDecoder();

const textOf = (bytes: Uint8Array) => decoder.decode(bytes);

const take = (cursor: Cursor, length: number) => {
	if (length < 0 || cursor.offset + length > cursor.view.byteLength) {
		throw new RangeError("nbt runs past the end of the file");
	}
	const bytes = new Uint8Array(cursor.view.buffer, cursor.view.byteOffset + cursor.offset, length).slice();
	cursor.offset += length;
	return bytes;
};

const readTag = (cursor: Cursor): NbtTag => {
	const tag = cursor.view.getUint8(cursor.offset);
	cursor.offset += 1;
	if (tag > NbtTag.LongArray) {
		throw new RangeError(`unknown nbt tag ${tag}`);
	}
	return tag;
};

const readInt = (cursor: Cursor) => {
	const value = cursor.view.getInt32(cursor.offset, true);
	cursor.offset += 4;
	return value;
};

const readName = (cursor: Cursor) => {
	const length = cursor.view.getUint16(cursor.offset, true);
	cursor.offset += 2;
	return take(cursor, length);
};

const readPayload = (cursor: Cursor, tag: NbtTag, depth: number): NbtPayload => {
	if (depth > MAX_DEPTH) {
		throw new RangeError("nbt nests deeper than a level file does");
	}
	switch (tag) {
		case NbtTag.Byte: {
			const value = cursor.view.getInt8(cursor.offset);
			cursor.offset += 1;
			return {
				tag,
				value,
			};
		}
		case NbtTag.Short: {
			const value = cursor.view.getInt16(cursor.offset, true);
			cursor.offset += 2;
			return {
				tag,
				value,
			};
		}
		case NbtTag.Int: {
			return {
				tag,
				value: readInt(cursor),
			};
		}
		case NbtTag.Long:
		case NbtTag.Float:
		case NbtTag.Double: {
			return {
				tag,
				bytes: take(cursor, FIXED_BYTES[tag] ?? 0),
			};
		}
		case NbtTag.String: {
			return {
				tag,
				bytes: readName(cursor),
			};
		}
		case NbtTag.ByteArray:
		case NbtTag.IntArray:
		case NbtTag.LongArray: {
			const count = readInt(cursor);
			const bytes = take(cursor, count * (ARRAY_ELEMENT_BYTES[tag] ?? 1));
			return {
				tag,
				count,
				bytes,
			};
		}
		case NbtTag.List: {
			const element = readTag(cursor);
			const count = readInt(cursor);
			if (count < 0) {
				throw new RangeError("negative nbt list length");
			}
			const items: NbtPayload[] = [];
			for (let index = 0; index < count; index++) {
				items.push(readPayload(cursor, element, depth + 1));
			}
			return {
				tag,
				element,
				items,
			};
		}
		case NbtTag.Compound: {
			const entries: NbtEntry[] = [];
			for (let child = readTag(cursor); child !== NbtTag.End; child = readTag(cursor)) {
				const name = readName(cursor);
				entries.push({
					name,
					payload: readPayload(cursor, child, depth + 1),
				});
			}
			return {
				tag,
				entries,
			};
		}
		default: {
			throw new RangeError("an end tag cannot carry a payload");
		}
	}
};

export const parseLevel = (bytes: Uint8Array): LevelFile | null => {
	try {
		const cursor: Cursor = {
			view: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
			offset: 0,
		};
		const version = readInt(cursor);
		readInt(cursor);
		if (readTag(cursor) !== NbtTag.Compound) {
			return null;
		}
		const name = readName(cursor);
		const root = readPayload(cursor, NbtTag.Compound, 0);
		if (root.tag !== NbtTag.Compound) {
			return null;
		}
		return {
			version,
			name,
			root,
		};
	} catch {
		return null;
	}
};

const numberBytes = (size: number, write: (view: DataView) => void) => {
	const bytes = new Uint8Array(size);
	write(new DataView(bytes.buffer));
	return bytes;
};

const int32 = (value: number) => numberBytes(4, (view) => view.setInt32(0, value, true));

const uint16 = (value: number) => numberBytes(2, (view) => view.setUint16(0, value, true));

const tagByte = (tag: NbtTag) => Uint8Array.of(tag);

const writeName = (parts: Uint8Array[], name: Uint8Array) => {
	parts.push(uint16(name.length), name);
};

const writePayload = (parts: Uint8Array[], payload: NbtPayload) => {
	switch (payload.tag) {
		case NbtTag.Byte: {
			parts.push(numberBytes(1, (view) => view.setInt8(0, payload.value)));
			return;
		}
		case NbtTag.Short: {
			parts.push(numberBytes(2, (view) => view.setInt16(0, payload.value, true)));
			return;
		}
		case NbtTag.Int: {
			parts.push(int32(payload.value));
			return;
		}
		case NbtTag.String: {
			writeName(parts, payload.bytes);
			return;
		}
		case NbtTag.Long:
		case NbtTag.Float:
		case NbtTag.Double: {
			parts.push(payload.bytes);
			return;
		}
		case NbtTag.ByteArray:
		case NbtTag.IntArray:
		case NbtTag.LongArray: {
			parts.push(int32(payload.count), payload.bytes);
			return;
		}
		case NbtTag.List: {
			parts.push(tagByte(payload.element), int32(payload.items.length));
			for (const item of payload.items) {
				writePayload(parts, item);
			}
			return;
		}
		case NbtTag.Compound: {
			for (const entry of payload.entries) {
				parts.push(tagByte(entry.payload.tag));
				writeName(parts, entry.name);
				writePayload(parts, entry.payload);
			}
			parts.push(tagByte(NbtTag.End));
		}
	}
};

const concat = (parts: Uint8Array[]) => {
	const bytes = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
	let offset = 0;
	for (const part of parts) {
		bytes.set(part, offset);
		offset += part.length;
	}
	return bytes;
};

export const serializeLevel = (level: LevelFile) => {
	const body: Uint8Array[] = [
		tagByte(NbtTag.Compound),
	];
	writeName(body, level.name);
	writePayload(body, level.root);
	const payload = concat(body);
	return concat([
		int32(level.version),
		int32(payload.length),
		payload,
	]);
};

const experimentsOf = (level: LevelFile) => {
	const entry = level.root.entries.find(
		(candidate) => candidate.payload.tag === NbtTag.Compound && textOf(candidate.name) === EXPERIMENTS_TAG,
	);
	return entry?.payload.tag === NbtTag.Compound ? entry.payload : null;
};

export const levelExperiments = (level: LevelFile) => {
	const flags: Record<string, number> = {};
	for (const entry of experimentsOf(level)?.entries ?? []) {
		if (entry.payload.tag === NbtTag.Byte) {
			flags[textOf(entry.name)] = entry.payload.value;
		}
	}
	return flags;
};

const withRootEntry = (level: LevelFile, entry: NbtEntry): LevelFile => {
	const key = textOf(entry.name);
	const entries = [
		...level.root.entries,
	];
	const at = entries.findIndex((candidate) => textOf(candidate.name) === key);
	if (at < 0) {
		entries.push(entry);
	} else {
		entries[at] = entry;
	}
	return {
		version: level.version,
		name: level.name,
		root: {
			tag: NbtTag.Compound,
			entries,
		},
	};
};

export const levelByte = (level: LevelFile, key: string) => {
	const payload = level.root.entries.find((entry) => textOf(entry.name) === key)?.payload;
	return payload?.tag === NbtTag.Byte ? payload.value : null;
};

export const levelLong = (level: LevelFile, key: string) => {
	const payload = level.root.entries.find((entry) => textOf(entry.name) === key)?.payload;
	return payload?.tag === NbtTag.Long
		? new DataView(payload.bytes.buffer, payload.bytes.byteOffset, 8).getBigInt64(0, true)
		: null;
};

export const withByte = (level: LevelFile, key: string, value: number) => {
	return withRootEntry(level, {
		name: encoder.encode(key),
		payload: {
			tag: NbtTag.Byte,
			value,
		},
	});
};

export const withExperiment = (level: LevelFile, key: string, value: number): LevelFile => {
	const flag: NbtEntry = {
		name: encoder.encode(key),
		payload: {
			tag: NbtTag.Byte,
			value,
		},
	};
	const children = [
		...(experimentsOf(level)?.entries ?? []),
	];
	const at = children.findIndex((entry) => textOf(entry.name) === key);
	if (at < 0) {
		children.push(flag);
	} else {
		children[at] = flag;
	}
	return withRootEntry(level, {
		name: encoder.encode(EXPERIMENTS_TAG),
		payload: {
			tag: NbtTag.Compound,
			entries: children,
		},
	});
};

export const levelHardcore = (level: LevelFile) => {
	return (levelByte(level, HARDCORE_TAG) ?? 0) !== 0;
};

export const withHardcore = (level: LevelFile, enabled: boolean) => {
	return withByte(level, HARDCORE_TAG, enabled ? 1 : 0);
};

export const levelSeed = (level: LevelFile) => {
	return levelLong(level, SEED_TAG)?.toString() ?? null;
};

export const levelName = (level: LevelFile) => {
	const payload = level.root.entries.find((entry) => textOf(entry.name) === LEVEL_NAME_TAG)?.payload;
	return payload?.tag === NbtTag.String ? textOf(payload.bytes) : null;
};

export const withLevelName = (level: LevelFile, name: string) => {
	return withRootEntry(level, {
		name: encoder.encode(LEVEL_NAME_TAG),
		payload: {
			tag: NbtTag.String,
			bytes: encoder.encode(name),
		},
	});
};

export const parseLevelExperiments = (bytes: Uint8Array): Record<string, number> | null => {
	const level = parseLevel(bytes);
	return level === null ? null : levelExperiments(level);
};

export const betaApisEnabled = (experiments: Record<string, number> | null) => {
	return experiments === null ? null : (experiments[BETA_APIS_EXPERIMENT] ?? 0) !== 0;
};

const levelPath = (world: string) => `${worldPath(world)}/${LEVEL_FILE}`;

const readLevelBytes = async (context: Bridge.Context, path: string) => {
	if (!(await context.files.exists(path))) {
		return null;
	}
	const result = await context.exec(
		[
			"base64",
			"-w",
			"0",
			"--",
			path,
		],
		{
			timeoutMs: EXEC_TIMEOUT_MS,
		},
	);
	if (result.code !== 0) {
		context.log.warn("could not read a level file", {
			path,
			code: result.code,
		});
		return null;
	}
	return new Uint8Array(Buffer.from(result.stdout.trim(), "base64"));
};

const readLevel = async (context: Bridge.Context, path: string) => {
	const bytes = await readLevelBytes(context, path);
	return bytes === null ? null : parseLevel(bytes);
};

const writeLevel = async (context: Bridge.Context, path: string, next: Uint8Array) => {
	const encoded = `${LEVEL_STAGING}/${LEVEL_FILE}.b64`;
	const staged = `${LEVEL_STAGING}/${LEVEL_FILE}`;
	await context.files.remove(LEVEL_STAGING);
	await context.files.ensure(LEVEL_STAGING);
	try {
		await context.files.write(encoded, Buffer.from(next).toString("base64"));
		const decoded = await context.exec(
			[
				"sh",
				"-c",
				'base64 -d -- "$1" > "$2"',
				"write-level",
				encoded,
				staged,
			],
			{
				timeoutMs: EXEC_TIMEOUT_MS,
			},
		);
		if (decoded.code !== 0) {
			throw new Error(`could not stage the level file: ${execDetail(decoded)}`);
		}
		const written = await readLevelBytes(context, staged);
		if (written === null || Buffer.compare(written, next) !== 0) {
			throw new Error("the staged level file does not match what we meant to write");
		}
		await publishFiles(context, [
			{
				source: staged,
				destination: path,
			},
		]);
	} finally {
		await context.files.remove(LEVEL_STAGING);
	}
};

export const readLevelExperiments = async (context: Bridge.Context, world: string) => {
	const bytes = await readLevelBytes(context, levelPath(world));
	return bytes === null ? null : parseLevelExperiments(bytes);
};

export const readLevelHardcore = async (context: Bridge.Context, world: string): Promise<boolean | null> => {
	const level = await readLevel(context, levelPath(world));
	return level === null ? null : levelHardcore(level);
};

export const readLevelSeed = async (context: Bridge.Context, world: string): Promise<string | null> => {
	const level = await readLevel(context, levelPath(world));
	return level === null ? null : levelSeed(level);
};

export const enableBetaApis = async (context: Bridge.Context, world: string) => {
	requireStopped(context);
	const path = levelPath(world);
	const level = await readLevel(context, path);
	if (level === null) {
		throw new BridgeUserError({
			ar: "تعذّرت قراءة ملف الماب level.dat، لذلك لم يتم تفعيل Beta APIs. رجّع نسخة احتياطية أو فعّلها من جهازك.",
			en: "We couldn't read the world's level.dat, so Beta APIs wasn't turned on. Restore a backup or turn it on from your device.",
		});
	}
	if (betaApisEnabled(levelExperiments(level))) {
		return false;
	}
	await writeLevel(context, path, serializeLevel(withExperiment(level, BETA_APIS_EXPERIMENT, 1)));
	context.log("turned on Beta APIs for the world", {
		world,
	});
	return true;
};

export const setLevelHardcore = async (context: Bridge.Context, world: string, enabled: boolean) => {
	requireStopped(context);
	const path = levelPath(world);
	const level = await readLevel(context, path);
	if (level === null) {
		throw new BridgeUserError({
			ar: "تعذّرت قراءة ملف الماب level.dat، لذلك لم يتغيّر الهاردكور. رجّع نسخة احتياطية وجرب مرة ثانية.",
			en: "We couldn't read the world's level.dat, so hardcore wasn't changed. Restore a backup and try again.",
		});
	}
	if (levelHardcore(level) === enabled) {
		return false;
	}
	await writeLevel(context, path, serializeLevel(withHardcore(level, enabled)));
	context.log(enabled ? "turned on hardcore for the world" : "turned off hardcore for the world", {
		world,
	});
	return true;
};

export const setLevelName = async (context: Bridge.Context, directory: string, name: string) => {
	requireStopped(context);
	const path = `${directory}/${LEVEL_FILE}`;
	const level = await readLevel(context, path);
	if (level === null) {
		return false;
	}
	await writeLevel(context, path, serializeLevel(withLevelName(level, name)));
	return true;
};
