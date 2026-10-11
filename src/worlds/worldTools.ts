import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { execDetail } from "@serverkgg/bridge/utils";
import { safePackFolder } from "../packs/packCompatibility";
import { listPackManifests } from "../packs/packDiscovery";
import { PackKind, parsePackManifest } from "../packs/packManifest";
import { readWorldPacks } from "../packs/packRegistry";
import { mergeProperties, PROPERTY_KEYS, publishFiles, requireStopped, worldPath } from "../shared";
import { discoverWorlds, safeWorldFolder } from "./world";

export const validateWorldFolder = (folder: string) => {
	if (folder.length === 0 || folder === "." || folder === ".." || /[\\/\r\n\0]/.test(folder)) {
		throw new BridgeUserError({
			ar: "اسم الماب غير صحيح. اختر الماب من القائمة.",
			en: "That world name isn't valid. Pick a world from the list.",
		});
	}
	return folder;
};

export const existingWorld = async (context: Bridge.Context, folder: string) => {
	validateWorldFolder(folder);
	if (!(await discoverWorlds(context)).includes(folder)) {
		throw new BridgeUserError({
			ar: "تعذّر العثور على الماب. حدّث القائمة وجرب مرة ثانية.",
			en: "We couldn't find that world. Refresh the list and try again.",
		});
	}
	return folder;
};

const newWorld = async (context: Bridge.Context, name: string) => {
	const folder = safeWorldFolder(name.trim());
	validateWorldFolder(folder);
	if (await context.files.exists(worldPath(folder))) {
		throw new BridgeUserError({
			ar: "يوجد ماب بالاسم نفسه. اختر اسمًا آخر.",
			en: "A world with that name already exists. Choose another name.",
		});
	}
	return folder;
};

export const cloneWorld = async (context: Bridge.Context, source: string, name: string) => {
	requireStopped(context);
	await existingWorld(context, source);
	const folder = await newWorld(context, name);
	const staging = ".serverk-world-clone";
	await context.files.remove(staging);
	await context.files.ensure(staging);
	try {
		const staged = `${staging}/world`;
		await copyDirectory(context, worldPath(source), staged);
		await context.files.write(`${staged}/levelname.txt`, folder);
		await publishFiles(context, [
			{
				source: staged,
				destination: worldPath(folder),
			},
		]);
	} finally {
		await context.files.remove(staging);
	}
	return folder;
};

const copyDirectory = async (context: Bridge.Context, source: string, destination: string) => {
	const links = await context.exec(
		[
			"find",
			source,
			"-type",
			"l",
			"-print",
		],
		{
			timeoutMs: 60_000,
		},
	);
	if (links.code !== 0 || links.stdout.trim().length > 0) {
		throw new Error("world exports cannot contain symbolic links");
	}
	const result = await context.exec(
		[
			"cp",
			"-a",
			"--",
			source,
			destination,
		],
		{
			timeoutMs: 600_000,
		},
	);
	if (result.code !== 0) {
		throw new Error(`could not stage world files: ${execDetail(result)}`);
	}
};

export const exportWorld = async (context: Bridge.Context, source: string) => {
	requireStopped(context);
	await existingWorld(context, source);
	const staging = ".serverk-world-export";
	const world = `${staging}/world`;
	await context.files.remove(staging);
	await context.files.ensure(staging, "exports");
	try {
		await copyDirectory(context, worldPath(source), world);
		for (const kind of [
			PackKind.Behavior,
			PackKind.Resource,
		]) {
			const directory = kind === PackKind.Behavior ? "behavior_packs" : "resource_packs";
			const candidates = await listPackManifests(context, [
				`${worldPath(source)}/${directory}`,
				directory,
			]);
			for (const reference of await readWorldPacks(context, source, kind)) {
				let found = false;
				for (const entry of candidates) {
					const folder = entry.path.slice(0, -"/manifest.json".length);
					if (!safePackFolder(folder)) {
						continue;
					}
					const manifest = parsePackManifest(await context.files.read(entry.path));
					if (
						manifest?.uuid !== reference.pack_id
						|| manifest.version.parts.join(".") !== reference.version.join(".")
					) {
						continue;
					}
					if (!folder.startsWith("worlds/")) {
						await context.files.ensure(`${world}/${directory}`);
						const destination = `${world}/${directory}/${manifest.uuid}`;
						if (!(await context.files.exists(destination))) {
							await copyDirectory(context, folder, destination);
						}
					}
					found = true;
					break;
				}
				if (!found) {
					throw new BridgeUserError({
						ar: `تعذّر تصدير الماب لأن الإضافة ${reference.pack_id} غير موجودة بالإصدار المطلوب.`,
						en: `We couldn't export the world because add-on ${reference.pack_id} is missing at the required version.`,
					});
				}
			}
		}
		const destination = `exports/${source}.mcworld`;
		const archive = `${staging}/world.mcworld`;
		const result = await context.exec(
			[
				"sh",
				"-c",
				'cd "$1" && zip -q -r ../world.mcworld . -x db/LOCK db/LOG db/LOG.old',
				"export-world",
				world,
			],
			{
				timeoutMs: 600_000,
			},
		);
		if (result.code !== 0) {
			throw new Error(`could not export the world: ${execDetail(result)}`);
		}
		await publishFiles(context, [
			{
				source: archive,
				destination,
			},
		]);
		context.log("world export is ready in Files", {
			path: destination,
		});
	} finally {
		await context.files.remove(staging);
	}
};

export const worldTools: Bridge.Actions = {
	kind: BridgeKind.Actions,
	actions: {
		async create(context, args) {
			requireStopped(context);
			const folder = await newWorld(context, String(args.name ?? ""));
			const seed = String(args.seed ?? "").trim();
			if (seed.length > 64 || /[\r\n\0]/.test(seed)) {
				throw new BridgeUserError({
					ar: "السيد طويل أو يحتوي على رموز غير صالحة.",
					en: "The seed is too long or contains invalid characters.",
				});
			}
			await mergeProperties(context, {
				[PROPERTY_KEYS.levelSeed]: seed,
				[PROPERTY_KEYS.levelName]: folder,
			});
			context.log("the new world will generate on startup", {
				folder,
			});
			context.activity.report({
				name: BridgeEventName.WorldCreated,
				text: {
					ar: `تم إنشاء ماب ${folder} وتفعيله، ويتولد عند التشغيل التالي`,
					en: `Created and activated world ${folder}, generated on the next start`,
				},
				subject: folder,
				details:
					seed.length === 0
						? {
								folder,
							}
						: {
								folder,
								seed,
							},
			});
		},
	},
};
