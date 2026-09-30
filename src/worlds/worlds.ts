import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import {
	formatByteSize,
	isUnder,
	nameOf,
	relativeUploadPath,
	requireStopped,
	sizeForReport,
	WORLD_STAGING,
	withoutExtension,
	worldPath,
} from "../shared";
import {
	activeWorld,
	discoverWorlds,
	findLevelDirectories,
	isBedrockWorld,
	safeWorldFolder,
	setActiveWorld,
	worldDisplayName,
	worldSize,
} from "./world";

import { cloneWorld, existingWorld, exportWorld } from "./worldTools";

const notAWorld = new BridgeUserError({
	ar: "ما لقينا ملف level.dat جوّا الملف. تأكد إنك رافع ملف ماب بصيغة .mcworld طالع من اللعبة نفسها.",
	en: "the archive holds no level.dat — make sure you are uploading a .mcworld exported from the game itself",
});

const notABedrockWorld = new BridgeUserError({
	ar: "هذي ماب جافا مو بيدروك. ما نقدر نحوّلها — لازم ماب طالعة من ماينكرافت بيدروك.",
	en: "this is a Java world, not a Bedrock one — we cannot convert it, you need a world exported from Minecraft Bedrock",
});

const multipleWorlds = new BridgeUserError({
	ar: "الملف فيه أكثر من ماب، ارفع كل ماب لحالها.",
	en: "the archive holds more than one world, upload them one at a time",
});

const unpack = async (context: Bridge.Context, archive: string, destination: string) => {
	await context.files.remove(destination);
	await context.files.ensure(destination);

	try {
		await context.files.extract(archive, destination, {
			tree: true,
		});
	} catch (error) {
		context.log.error("could not unpack an uploaded world", {
			reason: error instanceof Error ? error.message : String(error),
		});
		throw new BridgeUserError({
			ar: "ما قدرنا نفك الماب. تأكد إن الملف سليم وحجمه يناسب مساحة السيرفر.",
			en: "We could not unpack the world. Check the archive and available server space.",
		});
	}
};

export const worlds: Bridge.Collection = {
	kind: BridgeKind.Collection,
	protectedActions: [
		"delete",
	],

	async list(context) {
		const active = await activeWorld(context);
		const folders = await discoverWorlds(context);
		const rows = [];

		for (const folder of folders) {
			rows.push({
				id: folder,
				name: await worldDisplayName(context, folder),
				folder,
				size: formatByteSize(await worldSize(context, folder)),
				active: folder === active ? "✓" : "",
			});
		}

		return rows;
	},

	async add(context, input) {
		requireStopped(context);
		const relative = relativeUploadPath(input);

		if (relative === null || !isUnder(relative, WORLD_STAGING)) {
			throw new BridgeUserError({
				ar: "ما قدرنا نقرأ الملف اللي رفعته. جرّب ترفعه مرة ثانية.",
				en: "we could not read the file you uploaded — try uploading it again",
			});
		}

		const unpacked = `${WORLD_STAGING}/unpacked`;

		await unpack(context, relative, unpacked);

		const found = await findLevelDirectories(context, unpacked);

		if (found.length === 0) {
			throw notAWorld;
		}

		if (found.length > 1) {
			throw multipleWorlds;
		}

		const directory = found.at(0) ?? unpacked;

		if (!(await isBedrockWorld(context, directory))) {
			throw notABedrockWorld;
		}

		const folder = safeWorldFolder(withoutExtension(nameOf(relative)));
		const destination = worldPath(folder.length === 0 ? "imported-world" : folder);

		if (await context.files.exists(destination)) {
			throw new BridgeUserError({
				ar: `عندك ماب بنفس الاسم "${folder}"، غيّر اسم الملف وارفعه.`,
				en: `a world named "${folder}" is already here — rename the file and upload it again`,
			});
		}

		const sizeBytes = await sizeForReport(context, relative);

		await context.files.move(directory, destination);
		await context.files.remove(WORLD_STAGING);

		context.log("imported a world", {
			folder,
		});

		context.activity.report({
			name: BridgeEventName.WorldImported,
			text: {
				ar: `تم استيراد ماب ${folder}`,
				en: `Imported world ${folder}`,
			},
			subject: folder,
			details:
				sizeBytes === null
					? {
							folder,
						}
					: {
							folder,
							sizeBytes,
						},
		});
	},

	actions: {
		async clone(context, row, args) {
			const source = String(row.id);
			const folder = await cloneWorld(context, source, String(args.name ?? ""));

			context.activity.report({
				name: BridgeEventName.WorldCloned,
				text: {
					ar: `تم نسخ ماب ${source} باسم ${folder}`,
					en: `Cloned world ${source} as ${folder}`,
				},
				subject: folder,
				details: {
					source,
					folder,
				},
			});
		},
		async export(context, row) {
			await exportWorld(context, String(row.id));
		},
		async activate(context, row) {
			requireStopped(context);
			const folder = await existingWorld(context, String(row.id));
			const previous = await activeWorld(context);

			if (folder === previous) {
				throw new BridgeUserError({
					ar: "هذي الماب مفعّلة أصلًا.",
					en: "this world is already the active one",
				});
			}

			await setActiveWorld(context, folder);

			context.log("changed the active world", {
				folder,
			});

			context.activity.report({
				name: BridgeEventName.WorldActivated,
				text: {
					ar: `تم تفعيل ماب ${folder} بدل ${previous}`,
					en: `Activated world ${folder} in place of ${previous}`,
				},
				subject: folder,
				details: {
					folder,
					previous,
				},
			});
		},

		async delete(context, row) {
			requireStopped(context);
			const folder = await existingWorld(context, String(row.id));

			if (folder === (await activeWorld(context))) {
				throw new BridgeUserError({
					ar: "ما تقدر تحذف الماب المفعّلة. فعّل ماب ثانية الأول.",
					en: "you cannot delete the active world — activate another one first",
				});
			}

			await context.files.remove(worldPath(folder));

			context.log("deleted a world", {
				folder,
			});

			context.activity.report({
				name: BridgeEventName.WorldDeleted,
				text: {
					ar: `تم حذف ماب ${folder}`,
					en: `Deleted world ${folder}`,
				},
				subject: folder,
				details: {
					folder,
				},
			});
		},
	},
};
