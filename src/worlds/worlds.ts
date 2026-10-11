import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import {
	formatByteSize,
	isUnder,
	nameOf,
	relativeUploadPath,
	requireStopped,
	sizeForReport,
	WORLD_SCRATCH,
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
	ar: "لا يحتوي الملف على level.dat. تأكد من أنك ترفع ملف ماب بصيغة .mcworld مُصدَّرًا من اللعبة نفسها.",
	en: "The file has no level.dat. Make sure you're uploading a .mcworld exported from the game itself.",
});

const notABedrockWorld = new BridgeUserError({
	ar: "هذا ماب جافا وليس ماب بيدروك، ولا يمكن تحويله. يلزم استخدام ماب مُصدَّر من ماينكرافت بيدروك.",
	en: "This is a Java world, not a Bedrock one, and we can't convert it. You need a world exported from Minecraft Bedrock.",
});

const multipleWorlds = new BridgeUserError({
	ar: "يحتوي الملف على أكثر من ماب، ارفع كل ماب على حدة.",
	en: "The file has more than one world. Upload them one at a time.",
});

const ACTIVE_MARK = "✓";

const ACTIVE_WORLD_DELETE: Bridge.Text = {
	ar: "لا يمكن حذف الماب المفعّل. فعّل مابًا آخر أولًا.",
	en: "You can't delete the active world. Activate another one first.",
};

const ACTIVE_WORLD_ACTIVATE: Bridge.Text = {
	ar: "هذا الماب مفعّل مسبقًا.",
	en: "This world is already the active one.",
};

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
			ar: "تعذّر فك ضغط الماب. تأكد من أن الملف سليم وأن حجمه يناسب مساحة السيرفر.",
			en: "We couldn't unpack the world. Check the file and the free space on your server.",
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
				active: folder === active ? ACTIVE_MARK : "",
			});
		}

		return rows;
	},

	async add(context, input) {
		requireStopped(context);
		const relative = relativeUploadPath(input);

		if (relative === null || !isUnder(relative, WORLD_STAGING)) {
			throw new BridgeUserError({
				ar: "تعذّرت قراءة الملف المرفوع، ارفعه مرة ثانية.",
				en: "We couldn't read the file you uploaded. Try uploading it again.",
			});
		}

		const unpacked = `${WORLD_SCRATCH}/unpacked`;

		await context.files.remove(WORLD_SCRATCH);
		await context.files.ensure(WORLD_SCRATCH);
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
				ar: `يوجد ماب بالاسم نفسه «${folder}»، غيّر اسم الملف وارفعه مرة ثانية.`,
				en: `A world named "${folder}" is already here. Rename the file and upload it again.`,
			});
		}

		const sizeBytes = await sizeForReport(context, relative);

		await context.files.move(directory, destination);
		await context.files.remove(WORLD_SCRATCH);
		await context.files.remove(relative);

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
				throw new BridgeUserError(ACTIVE_WORLD_ACTIVATE);
			}

			await setActiveWorld(context, folder);

			context.log("changed the active world", {
				folder,
			});

			context.activity.report({
				name: BridgeEventName.WorldActivated,
				text: {
					ar: `تم تفعيل ماب ${folder} بدلًا من ${previous}`,
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
			const folder = await existingWorld(context, String(row.id));

			if (folder === (await activeWorld(context))) {
				throw new BridgeUserError(ACTIVE_WORLD_DELETE);
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

	async unavailable(_context, row): Promise<Bridge.Unavailable> {
		if (row.active !== ACTIVE_MARK) {
			return {};
		}

		return {
			delete: ACTIVE_WORLD_DELETE,
			activate: ACTIVE_WORLD_ACTIVATE,
		};
	},
};
