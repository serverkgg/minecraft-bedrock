import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { type PackManifest, parsePackManifest } from "./packManifest";

const FIND_TIMEOUT_MS = 60_000;

const MANIFEST_FILE = "manifest.json";

const NESTED_ARCHIVE_DEPTH = 3;

const MANIFEST_DEPTH = 5;

export interface DiscoveredPack {
	directory: string;
	manifest: PackManifest;
}

export const packDirectories = (output: string): string[] => {
	const directories = new Set<string>();
	const suffix = `/${MANIFEST_FILE}`;

	for (const line of output.split("\n")) {
		const trimmed = line.trim();

		if (trimmed.endsWith(suffix) && trimmed.length > suffix.length) {
			directories.add(trimmed.slice(0, -suffix.length));
		}
	}

	const listed = [
		...directories,
	].sort();

	return listed.filter((directory) => {
		return !listed.some((other) => other !== directory && directory.startsWith(`${other}/`));
	});
};

export const unpackArchive = async (
	context: Bridge.Context,
	archive: string,
	destination: string,
	maxBytes = 2 * 1024 ** 3,
) => {
	await context.files.remove(destination);
	await context.files.ensure(destination);

	try {
		await context.files.extract(archive, destination, {
			tree: true,
			maxBytes,
			exclude: [
				"__MACOSX/**",
			],
		});
	} catch (error) {
		context.log.error("could not unpack an uploaded add-on", {
			reason: error instanceof Error ? error.message : String(error),
		});
		throw new BridgeUserError({
			ar: "تعذّر فك ضغط الإضافة. تأكد من أن الملف سليم وأن حجمه يناسب مساحة السيرفر.",
			en: "We couldn't unpack the add-on. Check the file and the free space on your server.",
		});
	}
};

const unpackNested = async (context: Bridge.Context, root: string) => {
	const found = await context.exec(
		[
			"find",
			root,
			"-maxdepth",
			String(NESTED_ARCHIVE_DEPTH),
			"(",
			"-iname",
			"*.mcpack",
			"-o",
			"-iname",
			"*.mcaddon",
			")",
		],
		{
			timeoutMs: FIND_TIMEOUT_MS,
		},
	);

	const archives = found.stdout.split("\n").filter((line) => line.trim().length > 0);
	if (archives.length > 32) {
		throw new Error("the add-on contains too many nested packs");
	}
	let remaining = 2 * 1024 ** 3 - (await context.files.size(root));
	for (const line of archives) {
		const nested = line.trim();

		if (nested.length === 0) {
			continue;
		}

		const directory = nested.slice(0, nested.lastIndexOf("."));

		if (remaining <= 0 || (await context.files.exists(directory))) {
			throw new Error("the nested pack exceeds the expansion budget or overlaps another pack");
		}
		await unpackArchive(context, nested, directory, remaining);
		remaining -= await context.files.size(directory);
		await context.files.remove(nested);
	}
};

export const discoverPacks = async (context: Bridge.Context, root: string): Promise<DiscoveredPack[]> => {
	await unpackNested(context, root);

	const found = await context.exec(
		[
			"find",
			root,
			"-maxdepth",
			String(MANIFEST_DEPTH),
			"-name",
			MANIFEST_FILE,
		],
		{
			timeoutMs: FIND_TIMEOUT_MS,
		},
	);

	const packs: DiscoveredPack[] = [];

	for (const directory of packDirectories(found.stdout)) {
		const manifest = parsePackManifest(await context.files.read(`${directory}/${MANIFEST_FILE}`));

		if (manifest !== null) {
			packs.push({
				directory,
				manifest,
			});
		}
	}

	return packs;
};
