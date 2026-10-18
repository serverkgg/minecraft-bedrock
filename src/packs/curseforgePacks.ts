import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import {
	type CurseforgeFile,
	CurseforgeSort,
	CurseforgeSortOrder,
	createCurseforgeCatalog,
	curseforgeDownloadUrl,
	curseforgeSha1,
} from "@serverkgg/bridge/catalogs";
import { readInstallStamp } from "../install";
import { PACK_SCRATCH, recoverFileTransaction, requireStopped } from "../shared";
import { activeWorld } from "../worlds";
import { pickCurseforgeFiles } from "./curseforgeFiles";
import { packInstalledActivity, packsRemovedActivity, packsTitle, packsToggledActivity } from "./packActivity";
import { discoverPacks, unpackArchive } from "./packArchive";
import { inventoryPacks } from "./packDiscovery";
import { installUnpacked } from "./packInstall";
import { PackKind } from "./packManifest";
import { removePacks, setPacksEnabled } from "./packMutation";
import { walkPartnerFiles } from "./packPartners";
import { readWorldPacks } from "./packRegistry";

export const BEDROCK_GAME_ID = 78_022;

export const CLASS_ADDONS = 4984;

export const CLASS_TEXTURE_PACKS = 6929;

export const PROVIDER = "curseforge";

const PAGE_SIZE = 20;

export const FILES_PAGE_SIZE = 10;

const DOWNLOAD_TIMEOUT_MS = 600_000;

const classOf = (category: string | null) => {
	return category === "texture-packs" ? CLASS_TEXTURE_PACKS : CLASS_ADDONS;
};

export const decodeRef = (id: string) => {
	return id.startsWith(`${PROVIDER}:`) ? id.slice(PROVIDER.length + 1) : null;
};

export const encodeRef = (project: number | string) => `${PROVIDER}:${project}`;

const matchingPacks = async (context: Bridge.Context, id: string) => {
	const sidecar = await inventoryPacks(context);
	const project = decodeRef(id);

	return Object.values(sidecar.packs)
		.filter((pack) => pack.uuid === id || (project !== null && pack.project === project))
		.map((pack) => pack.uuid);
};

export const packCatalog: Bridge.Catalog = {
	kind: BridgeKind.Catalog,
	pageSize: PAGE_SIZE,

	async search(context, query) {
		const catalog = createCurseforgeCatalog(context, {
			gameId: BEDROCK_GAME_ID,
		});

		const categories: Bridge.CatalogFacet[] = [
			{
				value: "addons",
				label: {
					ar: "الإضافات",
					en: "Add-ons",
				},
			},
			{
				value: "texture-packs",
				label: {
					ar: "إضافات المظهر",
					en: "Texture packs",
				},
			},
		];

		if (!catalog.ready()) {
			return {
				hits: [],
				total: 0,
				categories,
				sorts: [],
				providers: [
					{
						id: PROVIDER,
						label: {
							ar: "CurseForge",
							en: "CurseForge",
						},
						ready: false,
						note: {
							ar: "لم يُضف مفتاح CurseForge إلى المنصة، لذلك الكتالوج غير متاح. ارفع إضافاتك بنفسك من الأسفل.",
							en: "No CurseForge key is set on the platform, so the catalog is off. You can still upload your own add-ons below.",
						},
					},
				],
			};
		}

		const page = await catalog.search({
			query: query.query,
			classId: classOf(query.category),
			index: query.page * PAGE_SIZE,
			pageSize: PAGE_SIZE,
			sort: CurseforgeSort.Popularity,
			sortOrder: CurseforgeSortOrder.Desc,
		});

		return {
			hits: page.data.map((mod) => ({
				id: encodeRef(mod.id),
				provider: PROVIDER,
				title: mod.name,
				description: mod.summary,
				icon: mod.logo?.thumbnailUrl ?? null,
				downloads: mod.downloadCount,
				author: mod.authors.at(0)?.name ?? null,
				categories: mod.categories.map((category) => category.name),
				updatedAt: mod.dateModified,
				pageUrl: mod.links?.websiteUrl ?? null,
			})),
			total: page.pagination.totalCount,
			categories,
			sorts: [],
			providers: [
				{
					id: PROVIDER,
					label: {
						ar: "CurseForge",
						en: "CurseForge",
					},
					ready: true,
				},
			],
		};
	},

	async installed(context) {
		const sidecar = await inventoryPacks(context);
		const world = await activeWorld(context);
		const active = new Map<PackKind, string[]>();

		for (const kind of [
			PackKind.Behavior,
			PackKind.Resource,
		]) {
			active.set(
				kind,
				(await readWorldPacks(context, world, kind)).map((entry) => entry.pack_id),
			);
		}

		const entries = [];

		for (const pack of Object.values(sidecar.packs)) {
			entries.push({
				id: pack.project === null ? pack.uuid : encodeRef(pack.project),
				provider: pack.provider,
				path: pack.folder,
				title: pack.title,
				version: pack.versionText,
				sizeBytes: (await context.files.exists(pack.folder)) ? await context.files.size(pack.folder) : 0,
				enabled: (active.get(pack.kind) ?? []).includes(pack.uuid),
				gameVersion: null,
				stale: false,
				pageUrl: pack.pageUrl,
				icon: pack.icon,
			});
		}

		return entries;
	},

	async install(context, id) {
		requireStopped(context);
		const project = decodeRef(id);

		if (project === null) {
			throw new BridgeUserError({
				ar: "تعذّر تحديد مصدر تنزيل هذه الإضافة.",
				en: "We couldn't tell where to download this add-on from.",
			});
		}

		const catalog = createCurseforgeCatalog(context, {
			gameId: BEDROCK_GAME_ID,
		});
		const mod = await catalog.mod(project);
		const files = await catalog.modFiles(project, {
			pageSize: FILES_PAGE_SIZE,
		});
		const build = (await readInstallStamp(context))?.version ?? null;
		const pick = pickCurseforgeFiles(files.data, build);

		if (pick === null) {
			throw new BridgeUserError({
				ar: `لا يوجد لدى «${mod.name}» أي ملف قابل للتنزيل.`,
				en: `"${mod.name}" has no downloadable file.`,
			});
		}

		const { file, partners: older } = pick;

		context.log("picked the catalog file for the server build", {
			project: mod.id,
			file: file.displayName,
			build,
		});

		const url = curseforgeDownloadUrl(file);

		if (url === null) {
			throw new BridgeUserError({
				ar: `صاحب «${mod.name}» لا يسمح بالتنزيل إلا من CurseForge. افتح صفحته، ونزّل الملف، ثم ارفعه من زر «ارفع إضافة» في الأسفل.`,
				en: `The author of "${mod.name}" allows downloads only from CurseForge. Open its page, download the file, and upload it with the button below.`,
			});
		}

		const unpacked = `${PACK_SCRATCH}/unpacked`;
		const directoryOf = (entry: CurseforgeFile) => `${unpacked}/${entry.id}`;
		const pullFile = async (entry: CurseforgeFile, from: string) => {
			const archive = `${PACK_SCRATCH}/${entry.id}-${entry.fileName}`;
			const digest = curseforgeSha1(entry);

			await context.files.download(archive, from, {
				timeoutMs: DOWNLOAD_TIMEOUT_MS,
				...(digest === null
					? {}
					: {
							digest: `sha1:${digest}`,
						}),
				sizeBytes: entry.fileLength,
			});
			await unpackArchive(context, archive, directoryOf(entry));
			await context.files.remove(archive);

			return (await discoverPacks(context, directoryOf(entry))).map((pack) => pack.manifest);
		};

		await recoverFileTransaction(context);
		await context.files.remove(PACK_SCRATCH);
		await context.files.ensure(unpacked);

		const candidates = await pullFile(file, url);
		const installed = new Map(
			Object.values((await inventoryPacks(context)).packs).map((pack) => [
				pack.uuid,
				{
					parts: pack.version,
					text: pack.versionText,
				},
			]),
		);
		const partners = await walkPartnerFiles({
			candidates,
			installed,
			files: older,
			open: async (entry) => {
				const from = curseforgeDownloadUrl(entry);

				if (from === null) {
					return null;
				}

				try {
					return await pullFile(entry, from);
				} catch (error) {
					context.log.warn("could not fetch a partner file of an add-on", {
						project: mod.id,
						file: entry.id,
						reason: error instanceof Error ? error.message : String(error),
					});

					return [];
				}
			},
			drop: async (entry) => {
				await context.files.remove(directoryOf(entry));
			},
		});
		const pulled = [
			file,
			...partners,
		];

		if (partners.length > 0) {
			context.log("pulled partner files for an add-on", {
				project: mod.id,
				files: partners.map((entry) => entry.displayName).join(", "),
			});
		}

		const sizeBytes = pulled.reduce((total, entry) => total + entry.fileLength, 0);
		const result = await installUnpacked(context, unpacked, {
			bundle: mod.name,
			provider: PROVIDER,
			project: String(mod.id),
			file: String(file.id),
			fileByDirectory: Object.fromEntries(
				pulled.map((entry) => [
					directoryOf(entry),
					String(entry.id),
				]),
			),
			icon: mod.logo?.thumbnailUrl ?? null,
			pageUrl: mod.links?.websiteUrl ?? null,
		});

		context.activity.report(
			packInstalledActivity(result, {
				bundle: mod.name,
				provider: PROVIDER,
				sizeBytes,
			}),
		);

		const first = result.packs.at(0);

		return {
			id,
			provider: PROVIDER,
			path: first?.folder ?? "",
			title: first?.title ?? mod.name,
			version: first?.versionText ?? null,
			sizeBytes,
			enabled: true,
			gameVersion: null,
			stale: false,
			pageUrl: mod.links?.websiteUrl ?? null,
			icon: mod.logo?.thumbnailUrl ?? null,
		};
	},

	async remove(context, id) {
		const removed = await removePacks(context, await matchingPacks(context, id));

		if (removed.length > 0) {
			context.activity.report(packsRemovedActivity(removed, packsTitle(removed, id)));
		}
	},
	async toggle(context, id, enabled) {
		const changed = await setPacksEnabled(context, await matchingPacks(context, id), enabled);

		if (changed.length > 0) {
			context.activity.report(packsToggledActivity(changed, packsTitle(changed, id), enabled));
		}
	},
};
