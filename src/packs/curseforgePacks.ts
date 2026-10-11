import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import {
	CurseforgeSort,
	CurseforgeSortOrder,
	createCurseforgeCatalog,
	curseforgeDownloadUrl,
	curseforgeSha1,
} from "@serverkgg/bridge/catalogs";
import { PACK_SCRATCH, requireStopped } from "../shared";
import { activeWorld } from "../worlds";
import { packInstalledActivity, packsRemovedActivity, packsTitle, packsToggledActivity } from "./packActivity";
import { inventoryPacks } from "./packDiscovery";
import { installPackSource } from "./packInstall";
import { PackKind } from "./packManifest";
import { removePacks, setPacksEnabled } from "./packMutation";
import { readWorldPacks } from "./packRegistry";

export const BEDROCK_GAME_ID = 78_022;

export const CLASS_ADDONS = 4984;

export const CLASS_TEXTURE_PACKS = 6929;

export const PROVIDER = "curseforge";

const PAGE_SIZE = 20;

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
			pageSize: 1,
		});
		const file = files.data.at(0);

		if (file === undefined) {
			throw new BridgeUserError({
				ar: `لا يوجد لدى «${mod.name}» أي ملف قابل للتنزيل.`,
				en: `"${mod.name}" has no downloadable file.`,
			});
		}

		const url = curseforgeDownloadUrl(file);

		if (url === null) {
			throw new BridgeUserError({
				ar: `صاحب «${mod.name}» لا يسمح بالتنزيل إلا من CurseForge. افتح صفحته، ونزّل الملف، ثم ارفعه من زر «ارفع إضافة» في الأسفل.`,
				en: `The author of "${mod.name}" allows downloads only from CurseForge. Open its page, download the file, and upload it with the button below.`,
			});
		}

		const digest = curseforgeSha1(file);
		const archive = `${PACK_SCRATCH}/${file.id}-${file.fileName}`;

		await context.files.remove(PACK_SCRATCH);
		await context.files.ensure(PACK_SCRATCH);
		await context.files.download(archive, url, {
			timeoutMs: DOWNLOAD_TIMEOUT_MS,
			...(digest === null
				? {}
				: {
						digest: `sha1:${digest}`,
					}),
			sizeBytes: file.fileLength,
		});

		const result = await installPackSource(context, {
			archive,
			bundle: mod.name,
			provider: PROVIDER,
			project: String(mod.id),
			file: String(file.id),
			icon: mod.logo?.thumbnailUrl ?? null,
			pageUrl: mod.links?.websiteUrl ?? null,
		});

		context.activity.report(
			packInstalledActivity(result, {
				bundle: mod.name,
				provider: PROVIDER,
				sizeBytes: file.fileLength,
			}),
		);

		const first = result.packs.at(0);

		return {
			id,
			provider: PROVIDER,
			path: first?.folder ?? "",
			title: first?.title ?? mod.name,
			version: first?.versionText ?? null,
			sizeBytes: file.fileLength,
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
