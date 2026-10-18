import { type CurseforgeFile, selectCurseforgeFile } from "@serverkgg/bridge/catalogs";
import { VERSION_PATTERN } from "../install";
import { versionParts } from "../shared";

const YEAR_VERSION = 26;

const UPDATE_STEP = 10;

export interface CurseforgePick {
	file: CurseforgeFile;
	partners: CurseforgeFile[];
}

const lineOf = (build: string) => {
	const [major = 0, minor = 0, patch = 0] = versionParts(build);

	if (major !== 1) {
		return {
			line: String(major),
			hotfix: minor,
		};
	}

	return {
		line: minor < YEAR_VERSION ? `1.${minor}` : String(minor),
		hotfix: patch,
	};
};

export const curseforgeTagsOf = (build: string | null): string[] => {
	if (build === null || !VERSION_PATTERN.test(build)) {
		return [];
	}

	const { line, hotfix } = lineOf(build);

	return [
		...new Set([
			`${line}.${hotfix}`,
			`${line}.${hotfix - (hotfix % UPDATE_STEP)}`,
		]),
	];
};

const chooseFile = (files: CurseforgeFile[], tags: string[]) => {
	for (const tag of tags) {
		const chosen = selectCurseforgeFile(files, {
			gameVersion: tag,
		});

		if (chosen?.gameVersions.includes(tag)) {
			return chosen;
		}
	}

	return selectCurseforgeFile(files);
};

export const pickCurseforgeFiles = (files: CurseforgeFile[], build: string | null): CurseforgePick | null => {
	const file = chooseFile(files, curseforgeTagsOf(build));

	if (file === null) {
		return null;
	}

	const rest = files.filter((entry) => entry.isAvailable && entry.id !== file.id);
	const sameBuild = (entry: CurseforgeFile) => entry.gameVersions.some((tag) => file.gameVersions.includes(tag));

	return {
		file,
		partners: [
			...rest.filter(sameBuild),
			...rest.filter((entry) => !sameBuild(entry)),
		],
	};
};
