import type { Bridge } from "@serverkgg/bridge";
import {
	LEVEL_FILE,
	LEVEL_NAME_FILE,
	mergeProperties,
	PROPERTY_KEYS,
	readProperties,
	WORLD_DATABASE_DIRECTORY,
	WORLDS_DIRECTORY,
	worldPath,
} from "../shared";

const FIND_TIMEOUT_MS = 60_000;

const NAME_LIMIT = 64;

const UNSAFE_CHARACTERS = /[^\p{L}\p{N}._-]+/gu;

const EDGE_CHARACTERS = /^[-._]+|[-._]+$/gu;

export const DEFAULT_LEVEL = "world";

export const levelDirectories = (output: string): string[] => {
	const directories = new Set<string>();
	const suffix = `/${LEVEL_FILE}`;

	for (const line of output.split("\n")) {
		const trimmed = line.trim();

		if (trimmed.endsWith(suffix) && trimmed.length > suffix.length) {
			directories.add(trimmed.slice(0, -suffix.length));
		}

		if (trimmed === LEVEL_FILE) {
			directories.add(".");
		}
	}

	return [
		...directories,
	].sort();
};

export const worldFolders = (output: string): string[] => {
	const prefix = `${WORLDS_DIRECTORY}/`;

	return levelDirectories(output)
		.filter((directory) => directory.startsWith(prefix))
		.map((directory) => directory.slice(prefix.length))
		.filter((folder) => folder.length > 0 && !folder.includes("/"));
};

export const safeWorldFolder = (name: string) => {
	return name.replace(UNSAFE_CHARACTERS, "-").slice(0, NAME_LIMIT).replace(EDGE_CHARACTERS, "");
};

export const suffixedWorldFolder = (name: string, suffix: string) => {
	const folder = safeWorldFolder(name);
	const stem = folder.length === 0 ? DEFAULT_LEVEL : folder;

	return `${stem.slice(0, NAME_LIMIT - suffix.length).replace(EDGE_CHARACTERS, "")}${suffix}`;
};

const find = async (context: Bridge.Context, root: string, depth: string) => {
	const result = await context.exec(
		[
			"find",
			root,
			"-maxdepth",
			depth,
			"-name",
			LEVEL_FILE,
		],
		{
			timeoutMs: FIND_TIMEOUT_MS,
		},
	);

	if (result.code !== 0) {
		context.log.warn("the world scan did not finish cleanly, listing what it found", {
			code: result.code,
			reason: result.stderr.trim().split("\n").at(0) ?? "",
		});
	}

	return result.stdout;
};

export const discoverWorlds = async (context: Bridge.Context) => {
	return worldFolders(await find(context, WORLDS_DIRECTORY, "2"));
};

export const findLevelDirectories = async (context: Bridge.Context, source: string) => {
	return levelDirectories(await find(context, source, "2")).map((directory) => {
		return directory === "." ? source : directory;
	});
};

export const isBedrockWorld = async (context: Bridge.Context, directory: string) => {
	return await context.files.exists(`${directory}/${WORLD_DATABASE_DIRECTORY}`);
};

export const worldDisplayName = async (context: Bridge.Context, folder: string) => {
	const path = `${worldPath(folder)}/${LEVEL_NAME_FILE}`;

	if (!(await context.files.exists(path))) {
		return folder;
	}

	const name = (await context.files.read(path)).trim();

	return name.length === 0 ? folder : name;
};

export const activeWorld = async (context: Bridge.Context) => {
	const properties = await readProperties(context);
	const level = (properties[PROPERTY_KEYS.levelName] ?? "").trim();

	return level.length === 0 ? DEFAULT_LEVEL : level;
};

export const setActiveWorld = async (context: Bridge.Context, folder: string) => {
	await mergeProperties(context, {
		[PROPERTY_KEYS.levelName]: folder,
	});
};

export const worldSize = async (context: Bridge.Context, folder: string) => {
	return await context.files.size(worldPath(folder));
};
