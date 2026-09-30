import { type Bridge, BridgeUserError, describeDownloadFailure } from "@serverkgg/bridge";
import { INSTALL_STAMP_FILE, writeStamp } from "@serverkgg/bridge/install";
import { execDetail } from "@serverkgg/bridge/utils";
import {
	ALLOWLIST_FILE,
	BEHAVIOR_PACKS_DIRECTORY,
	CONFIG_FILE,
	DOWNLOAD_STAGING,
	PERMISSIONS_FILE,
	publishFiles,
	RESOURCE_PACKS_DIRECTORY,
	SERVER_BINARY,
	WORLDS_DIRECTORY,
} from "../shared";
import type { Release } from "./releases";

const DOWNLOAD_TIMEOUT_MS = 1_800_000;

export const PRESERVE_ON_UPDATE: string[] = [
	WORLDS_DIRECTORY,
	CONFIG_FILE,
	ALLOWLIST_FILE,
	PERMISSIONS_FILE,
	BEHAVIOR_PACKS_DIRECTORY,
	RESOURCE_PACKS_DIRECTORY,
	"development_behavior_packs",
	"development_resource_packs",
	"development_skin_packs",
	"world_templates",
	"config",
];

const EXTRACT_EXCLUDES = [
	CONFIG_FILE,
	ALLOWLIST_FILE,
	PERMISSIONS_FILE,
	"whitelist.json",
];

export const topLevelOf = (entries: string[]) => {
	const names = new Set<string>();

	for (const entry of entries) {
		const name = entry.split("/").at(0) ?? "";

		if (name.length > 0) {
			names.add(name);
		}
	}

	return [
		...names,
	].sort();
};

export const vanillaPacksOf = (entries: string[]) => {
	const packs = new Set<string>();

	for (const entry of entries) {
		const parts = entry.split("/");
		const root = parts.at(0) ?? "";
		const folder = parts.at(1) ?? "";

		if ((root === BEHAVIOR_PACKS_DIRECTORY || root === RESOURCE_PACKS_DIRECTORY) && folder.length > 0) {
			packs.add(`${root}/${folder}`);
		}
	}

	return [
		...packs,
	].sort();
};

export interface UnpackedArchive {
	files: string[];
	packs: string[];
}

export const installGame = async (
	context: Bridge.Context,
	release: Release,
	stale: string[],
	previousPacks: string[] = [],
): Promise<UnpackedArchive> => {
	const archive = `${DOWNLOAD_STAGING}/bedrock-server-${release.version}.zip`;

	await context.files.remove(DOWNLOAD_STAGING);
	await context.files.ensure(DOWNLOAD_STAGING);

	context.log("downloading the bedrock dedicated server", {
		channel: release.channel,
		version: release.version,
	});

	try {
		await context.files.download(archive, release.url, {
			timeoutMs: DOWNLOAD_TIMEOUT_MS,
		});
	} catch (error) {
		throw new BridgeUserError(describeDownloadFailure(error, `Bedrock ${release.label}`), {
			cause: error,
		});
	}

	const staged = `${DOWNLOAD_STAGING}/unpacked`;
	const entries = await context.files.extract(archive, staged, {
		tree: true,
		maxEntryBytes: 512 * 1024 * 1024,
		exclude: EXTRACT_EXCLUDES,
	});
	const relative = entries.map((entry) => (entry.startsWith(`${staged}/`) ? entry.slice(staged.length + 1) : entry));
	const files = topLevelOf(relative);
	const packs = vanillaPacksOf(relative);
	if (!(await context.files.exists(`${staged}/${SERVER_BINARY}`))) {
		throw new Error("the Bedrock archive carried no server binary");
	}
	const marked = await context.exec([
		"chmod",
		"+x",
		`${staged}/${SERVER_BINARY}`,
	]);
	if (marked.code !== 0) {
		throw new Error(`could not mark the server executable: ${execDetail(marked)}`);
	}
	const roots = files.filter((name) => !PRESERVE_ON_UPDATE.includes(name));
	const replacements = [
		...roots,
		...packs,
	].map((destination) => ({
		source: `${staged}/${destination}`,
		destination,
	}));
	for (const path of relative.filter((entry) => entry.startsWith("config/"))) {
		if (!(await context.files.exists(path))) {
			replacements.push({
				source: `${staged}/${path}`,
				destination: path,
			});
		}
	}
	const stagedStamp = `${DOWNLOAD_STAGING}/next-stamp.json`;
	await writeStamp(
		context,
		{
			channel: release.channel,
			version: release.version,
			label: release.label,
			files,
			packs,
		},
		stagedStamp,
	);
	replacements.push({
		source: stagedStamp,
		destination: INSTALL_STAMP_FILE,
	});
	await publishFiles(context, replacements, [
		...stale.filter((name) => !PRESERVE_ON_UPDATE.includes(name) && !roots.includes(name)),
		...previousPacks.filter((pack) => !packs.includes(pack)),
	]);

	await context.files.remove(DOWNLOAD_STAGING);

	return {
		files,
		packs,
	};
};

export const gameInstalled = async (context: Bridge.Context) => {
	return await context.files.exists(SERVER_BINARY);
};
