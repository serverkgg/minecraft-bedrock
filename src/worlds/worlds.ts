import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { formatByteSize, relativeUploadPath } from "@serverkgg/bridge/utils";
import {
	isUnder,
	mergeProperties,
	nameOf,
	PROPERTY_KEYS,
	requireStopped,
	sizeForReport,
	WORLD_SCRATCH,
	WORLD_STAGING,
	withoutExtension,
	worldPath,
} from "../shared";
import { readLevelHardcore, readLevelSeed, setLevelHardcore } from "./levelDat";
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
import {
	archiveFolder,
	cloneWorld,
	copyWorldAddons,
	existingWorld,
	exportWorld,
	nameWorld,
	reportWiped,
} from "./worldTools";

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

const unreadableSeed = new BridgeUserError({
	ar: "تعذّرت قراءة السيد من ملف الماب level.dat، لذلك لم يتم تنفيذ الريسيت. لبداية جديدة بسيد آخر، أنشئ مابًا جديدًا.",
	en: "We couldn't read the seed from the world's level.dat, so the world wasn't reset. To start fresh with another seed, create a new world.",
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

const INACTIVE_WORLD_RESET: Bridge.Text = {
	ar: "لا يمكن تنفيذ ريسيت إلا للماب المفعّل. فعّل هذا الماب أولًا.",
	en: "You can only reset the active world. Activate this one first.",
};

const HARDCORE_ALREADY_ON: Bridge.Text = {
	ar: "الهاردكور مفعّل مسبقًا في هذا الماب.",
	en: "Hardcore is already on for this world.",
};

const HARDCORE_ALREADY_OFF: Bridge.Text = {
	ar: "الهاردكور موقوف مسبقًا في هذا الماب.",
	en: "Hardcore is already off for this world.",
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
		"resetWorld",
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
				hardcore: (await readLevelHardcore(context, folder)) === true ? ACTIVE_MARK : "",
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

		async hardcore(context, row, args) {
			const folder = await existingWorld(context, String(row.id));
			const enabled = args.enabled === true;

			if (!(await setLevelHardcore(context, folder, enabled))) {
				throw new BridgeUserError(enabled ? HARDCORE_ALREADY_ON : HARDCORE_ALREADY_OFF);
			}

			context.activity.report({
				name: BridgeEventName.GameplayChanged,
				text: enabled
					? {
							ar: `تم تفعيل الهاردكور في ماب ${folder}`,
							en: `Turned on hardcore for world ${folder}`,
						}
					: {
							ar: `تم إيقاف الهاردكور في ماب ${folder}`,
							en: `Turned off hardcore for world ${folder}`,
						},
				subject: folder,
				details: {
					what: "hardcore",
					value: enabled ? "on" : "off",
					folder,
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

		async resetWorld(context, row) {
			const folder = await existingWorld(context, String(row.id));

			if (folder !== (await activeWorld(context))) {
				throw new BridgeUserError(INACTIVE_WORLD_RESET);
			}

			const seed = await readLevelSeed(context, folder);

			if (seed === null) {
				throw unreadableSeed;
			}

			const archive = await archiveFolder(context, folder);

			await context.files.move(worldPath(folder), worldPath(archive));
			await mergeProperties(context, {
				[PROPERTY_KEYS.levelSeed]: seed,
			});
			await nameWorld(context, archive);
			await copyWorldAddons(context, archive, folder);

			context.log("reset a world", {
				folder,
				archive,
			});

			reportWiped(context, folder, "world", {
				ar: `تم ريسيت ماب ${folder}، وحُفظ الماب السابق باسم ${archive}`,
				en: `Reset world ${folder}, previous world kept as ${archive}`,
			});
		},
	},

	async unavailable(_context, row): Promise<Bridge.Unavailable> {
		if (row.active !== ACTIVE_MARK) {
			return {
				resetWorld: INACTIVE_WORLD_RESET,
			};
		}

		return {
			delete: ACTIVE_WORLD_DELETE,
			activate: ACTIVE_WORLD_ACTIVATE,
		};
	},
};
