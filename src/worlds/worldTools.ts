import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { execDetail } from "@serverkgg/bridge/utils";
import { safePackFolder } from "../packs/packCompatibility";
import { listPackManifests } from "../packs/packDiscovery";
import { PackKind, parsePackManifest } from "../packs/packManifest";
import { readWorldPacks, worldPackFile } from "../packs/packRegistry";
import {
	BEHAVIOR_PACKS_DIRECTORY,
	LEVEL_NAME_FILE,
	mergeProperties,
	PROPERTY_KEYS,
	publishFiles,
	RESOURCE_PACKS_DIRECTORY,
	requireStopped,
	worldPath,
} from "../shared";
import { setLevelName } from "./levelDat";
import { activeWorld, discoverWorlds, safeWorldFolder, suffixedWorldFolder } from "./world";

const FOLDER_ATTEMPT_LIMIT = 100;

const ARCHIVE_SUFFIX = "-old";

const COPY_SUFFIX = "-new";

export const NO_ACTIVE_WORLD: Bridge.Text = {
	ar: "لم يتولد الماب المفعّل بعد، فلا يوجد ماب يتم استبداله. شغّل سيرفرك أولًا ليتولد الماب.",
	en: "The active world hasn't generated yet, so there's nothing to replace. Start your server first to generate it.",
};

export const ONLY_WORLD: Bridge.Text = {
	ar: "لا يوجد في قائمة المابات ماب آخر لتنفيذ الريسيت منه. احتفظ أولًا بنسخة من الماب عبر «انسخ الماب».",
	en: "There's no other world in the Worlds list to reset from. Keep a copy of the world first with Copy world.",
};

const ACTIVE_WORLD_SOURCE: Bridge.Text = {
	ar: "لا يمكن تنفيذ ريسيت للماب المفعّل من نفسه. اكتب اسم مجلد ماب آخر من قائمة المابات.",
	en: "You can't reset the active world from itself. Type the folder name of another world from the Worlds list.",
};

const COPY_FAILED: Bridge.Text = {
	ar: "تعذّر نسخ الماب الأصلي، لذلك لم يتم تنفيذ الريسيت. تأكد من أن مساحة سيرفرك تكفي لنسخة ثانية من الماب، وجرب مرة ثانية.",
	en: "We couldn't copy the source world, so the world wasn't reset. Make sure your server has room for a second copy of the world, then try again.",
};

export const reportWiped = (
	context: Bridge.Context,
	folder: string,
	scope: string,
	text: Bridge.Text,
	details: Record<string, string> = {},
) => {
	context.activity.report({
		name: BridgeEventName.WorldWiped,
		text,
		subject: folder,
		details: {
			folder,
			scope,
			...details,
		},
	});
};

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

export const freeWorldFolder = async (context: Bridge.Context, base: string) => {
	for (let attempt = 1; attempt <= FOLDER_ATTEMPT_LIMIT; attempt += 1) {
		const candidate = attempt === 1 ? base : suffixedWorldFolder(base, `-${attempt}`);
		if (!(await context.files.exists(worldPath(candidate)))) {
			return candidate;
		}
	}
	throw new BridgeUserError({
		ar: `لديك مابات كثيرة بالاسم نفسه «${base}». احذف ما لا تحتاجه منها وجرب مرة ثانية.`,
		en: `Too many worlds are already named "${base}". Delete the ones you don't need and try again.`,
	});
};

export const archiveFolder = async (context: Bridge.Context, folder: string) => {
	return await freeWorldFolder(context, suffixedWorldFolder(folder, ARCHIVE_SUFFIX));
};

export const nameWorld = async (context: Bridge.Context, folder: string) => {
	await context.files.write(`${worldPath(folder)}/${LEVEL_NAME_FILE}`, folder);
	if (!(await setLevelName(context, worldPath(folder), folder))) {
		throw new Error("could not name the world in its level file");
	}
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
		await context.files.write(`${staged}/${LEVEL_NAME_FILE}`, folder);
		if (!(await setLevelName(context, staged, folder))) {
			throw new BridgeUserError({
				ar: "تعذّرت قراءة ملف الماب level.dat، لذلك لم يتم نسخ الماب. رجّع نسخة احتياطية وجرب مرة ثانية.",
				en: "We couldn't read the world's level.dat, so the world wasn't copied. Restore a backup and try again.",
			});
		}
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
		throw new Error("a world copy cannot contain symbolic links");
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
		throw new Error(`could not copy world files: ${execDetail(result)}`);
	}
};

const worldAddons = (world: string) => [
	worldPackFile(world, PackKind.Behavior),
	worldPackFile(world, PackKind.Resource),
	`${worldPath(world)}/${BEHAVIOR_PACKS_DIRECTORY}`,
	`${worldPath(world)}/${RESOURCE_PACKS_DIRECTORY}`,
];

export const copyWorldAddons = async (context: Bridge.Context, source: string, destination: string) => {
	await context.files.ensure(worldPath(destination));
	for (const path of worldAddons(source)) {
		if (await context.files.exists(path)) {
			await copyDirectory(context, path, `${worldPath(destination)}${path.slice(worldPath(source).length)}`);
		}
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

const resetFromCopyRefusal = async (context: Bridge.Context, folder: string) => {
	const listed = await discoverWorlds(context);
	if (!listed.includes(folder)) {
		return NO_ACTIVE_WORLD;
	}
	if (listed.every((entry) => entry === folder)) {
		return ONLY_WORLD;
	}
	return null;
};

const copyForReset = async (context: Bridge.Context, source: string, folder: string) => {
	const copy = await freeWorldFolder(context, suffixedWorldFolder(folder, COPY_SUFFIX));
	try {
		return await cloneWorld(context, source, copy);
	} catch (error) {
		if (error instanceof BridgeUserError) {
			throw error;
		}
		context.log.error("could not copy the source world", {
			from: source,
			reason: error instanceof Error ? error.message : String(error),
		});
		await context.files.remove(worldPath(copy));
		if (await context.files.exists(worldPath(copy))) {
			throw error;
		}
		throw new BridgeUserError(COPY_FAILED);
	}
};

export const worldTools: Bridge.Actions = {
	kind: BridgeKind.Actions,
	protectedActions: [
		"resetFromCopy",
	],
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

		async resetFromCopy(context, args) {
			requireStopped(context);
			const folder = await activeWorld(context);
			const refusal = await resetFromCopyRefusal(context, folder);
			if (refusal !== null) {
				throw new BridgeUserError(refusal);
			}
			const source = await existingWorld(context, String(args.source ?? "").trim());
			if (source === folder) {
				throw new BridgeUserError(ACTIVE_WORLD_SOURCE);
			}
			const archive = await archiveFolder(context, folder);
			const copy = await copyForReset(context, source, folder);
			await context.files.move(worldPath(folder), worldPath(archive));
			await nameWorld(context, archive);
			await context.files.move(worldPath(copy), worldPath(folder));
			await nameWorld(context, folder);
			context.log("reset a world from a copy", {
				folder,
				from: source,
				archive,
			});
			reportWiped(
				context,
				folder,
				"copy",
				{
					ar: `تم ريسيت ماب ${folder} من نسخة ${source}، وحُفظ الماب السابق باسم ${archive}`,
					en: `Reset world ${folder} from the copy ${source}, previous world kept as ${archive}`,
				},
				{
					source,
				},
			);
		},
	},

	async unavailable(context): Promise<Bridge.Unavailable> {
		const refusal = await resetFromCopyRefusal(context, await activeWorld(context));
		return refusal === null
			? {}
			: {
					resetFromCopy: refusal,
				};
	},
};
