import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import {
	BEHAVIOR_PACKS_DIRECTORY,
	PACK_SCRATCH,
	PACK_SIDECAR_FILE,
	publishFiles,
	RESOURCE_PACKS_DIRECTORY,
	recoverFileTransaction,
	requireStopped,
} from "../shared";
import { activeWorld, betaApisEnabled, readLevelExperiments } from "../worlds";
import type { PackInstallResult } from "./packActivity";
import { discoverPacks, unpackArchive } from "./packArchive";
import { activationOrder, assertCompatible, packWorlds, recordedCandidates, safePackFolder } from "./packCompatibility";
import { inventoryPacks } from "./packDiscovery";
import { resolvePackText } from "./packLang";
import { PackKind } from "./packManifest";
import { readWorldPacks, withPackActivated, worldPackFile } from "./packRegistry";
import type { PackRecord } from "./packSidecar";

const UNSAFE_CHARACTERS = /[^\p{L}\p{N}._-]+/gu;

const EDGE_CHARACTERS = /^[-._]+|[-._]+$/gu;

const TITLE_LIMIT = 40;

export const packDirectory = (kind: PackKind) => {
	return kind === PackKind.Behavior ? BEHAVIOR_PACKS_DIRECTORY : RESOURCE_PACKS_DIRECTORY;
};

export const packFolderName = (title: string, uuid: string) => {
	const slug = title.replace(UNSAFE_CHARACTERS, "-").slice(0, TITLE_LIMIT).replace(EDGE_CHARACTERS, "");

	return `${slug.length === 0 ? "pack" : slug}-${uuid.replace(/[^a-zA-Z0-9-]/g, "")}`;
};

export const worldTemplateRejected = new BridgeUserError({
	ar: "هذا ملف ماب وليس إضافة. ارفعه من تبويب المابات.",
	en: "This is a world, not an add-on. Upload it from the Worlds tab.",
});

export const noManifest = new BridgeUserError({
	ar: "لا يحتوي الملف على manifest.json. تأكد من أنك ترفع إضافة أصلية بصيغة .mcaddon أو .mcpack",
	en: "The file has no manifest.json. Make sure you're uploading a real .mcaddon or .mcpack",
});

export interface PackOrigin {
	bundle: string;
	provider?: string | null;
	project?: string | null;
	file?: string | null;
	fileByDirectory?: Record<string, string>;
	icon?: string | null;
	pageUrl?: string | null;
}

export interface PackSource extends PackOrigin {
	archive: string;
}

export const packFileOf = (origin: PackOrigin, directory: string) => {
	const match = Object.entries(origin.fileByDirectory ?? {}).find(
		([root]) => directory === root || directory.startsWith(`${root}/`),
	);
	return match?.[1] ?? origin.file ?? null;
};

export const installPackSource = async (context: Bridge.Context, source: PackSource): Promise<PackInstallResult> => {
	requireStopped(context);
	const unpacked = `${PACK_SCRATCH}/unpacked`;

	await unpackArchive(context, source.archive, unpacked);

	return await installUnpacked(context, unpacked, source);
};

export const installUnpacked = async (
	context: Bridge.Context,
	root: string,
	source: PackOrigin,
): Promise<PackInstallResult> => {
	requireStopped(context);
	await recoverFileTransaction(context);

	const discovered = await discoverPacks(context, root);

	if (discovered.length === 0) {
		throw noManifest;
	}

	if (discovered.every((pack) => pack.manifest.kind === PackKind.WorldTemplate)) {
		throw worldTemplateRejected;
	}

	const sidecar = await inventoryPacks(context);
	const world = await activeWorld(context);
	const installed: PackRecord[] = [];
	const candidateIds = new Set(discovered.map((pack) => pack.manifest.uuid));
	if (candidateIds.size !== discovered.length) {
		throw new BridgeUserError({
			ar: "يحتوي الملف على أكثر من إضافة بالمعرّف نفسه. ارفع إصدارًا واحدًا من كل إضافة.",
			en: "The file has more than one add-on with the same id. Include one version of each add-on.",
		});
	}
	const found = await Promise.all(
		discovered.map(async (pack) => ({
			...pack,
			title: await resolvePackText(context, pack.directory, pack.manifest.nameKey, source.bundle),
		})),
	);
	const existing = await recordedCandidates(
		context,
		Object.values(sidecar.packs).filter(
			(pack) => !candidateIds.has(pack.uuid) && pack.dependencies.some((id) => candidateIds.has(id)),
		),
	);
	await assertCompatible(
		context,
		[
			...found,
			...existing,
		],
		sidecar.packs,
	);
	const replacements: {
		source: string;
		destination: string;
	}[] = [];
	const removed: string[] = [];

	for (const pack of found) {
		if (pack.manifest.kind !== PackKind.Behavior && pack.manifest.kind !== PackKind.Resource) {
			context.log.warn("skipped a pack we cannot install", {
				uuid: pack.manifest.uuid,
				kind: pack.manifest.kind,
			});

			continue;
		}

		const previous = sidecar.packs[pack.manifest.uuid];
		if (
			previous !== undefined
			&& previous.versionText !== pack.manifest.version.text
			&& (await packWorlds(context, previous)).some((used) => used !== world)
		) {
			throw new BridgeUserError({
				ar: "هذه الإضافة مستخدمة في ماب آخر. ألغِ ارتباطها به قبل تغيير إصدارها.",
				en: "Another world uses this add-on. Remove that world's reference before changing its version.",
			});
		}
		if (previous !== undefined && previous.kind !== pack.manifest.kind) {
			throw new BridgeUserError({
				ar: "تغيّر نوع الإضافة مع بقاء المعرّف نفسه. راجع متطلبات الإصدار القديم ثم احذفه قبل تثبيت النوع الجديد.",
				en: "This add-on changed type under the same id. Review its dependencies and delete the old version before installing the new type.",
			});
		}
		const scope = previous?.folder.startsWith("worlds/") ? `worlds/${world}/` : "";
		const folder = `${scope}${packDirectory(pack.manifest.kind)}/${packFolderName(pack.title, pack.manifest.uuid)}`;

		if (previous !== undefined && previous.folder !== folder) {
			if (!safePackFolder(previous.folder)) {
				throw new Error("invalid previous pack folder");
			}
			removed.push(previous.folder);
		}
		replacements.push({
			source: pack.directory,
			destination: folder,
		});

		const record: PackRecord = {
			uuid: pack.manifest.uuid,
			kind: pack.manifest.kind,
			folder,
			title: pack.title,
			version: pack.manifest.version.parts,
			versionText: pack.manifest.version.text,
			bundle: source.bundle,
			order: previous?.order ?? 0,
			dependencies: pack.manifest.dependencies,
			provider: source.provider ?? null,
			project: source.project ?? null,
			file: packFileOf(source, pack.directory),
			icon: source.icon ?? null,
			pageUrl: source.pageUrl ?? null,
			installedAt: new Date().toISOString(),
		};

		sidecar.packs[record.uuid] = record;
		installed.push(record);
	}

	sidecar.world = world;

	if (installed.length === 0) {
		throw noManifest;
	}
	const sidecarStage = `${PACK_SCRATCH}/next-sidecar.json`;
	await context.files.write(sidecarStage, JSON.stringify(sidecar));
	replacements.push({
		source: sidecarStage,
		destination: PACK_SIDECAR_FILE,
	});
	const activated = activationOrder(
		installed.map((pack) => pack.uuid),
		sidecar.packs,
	);
	const dependencies = await recordedCandidates(
		context,
		activated.filter((pack) => !candidateIds.has(pack.uuid)),
	);
	await assertCompatible(
		context,
		[
			...found,
			...dependencies,
		],
		sidecar.packs,
	);
	for (const kind of [
		PackKind.Behavior,
		PackKind.Resource,
	]) {
		let entries = await readWorldPacks(context, world, kind);
		for (const record of activated.filter((pack) => pack.kind === kind)) {
			const index = entries.findIndex((entry) => entry.pack_id === record.uuid);
			entries = withPackActivated(
				entries,
				{
					pack_id: record.uuid,
					version: record.version,
				},
				index < 0 ? undefined : index,
			);
		}
		const stage = `${PACK_SCRATCH}/next-${kind}.json`;
		await context.files.write(stage, JSON.stringify(entries));
		replacements.push({
			source: stage,
			destination: worldPackFile(world, kind),
		});
	}
	await publishFiles(context, replacements, removed);

	await context.files.remove(PACK_SCRATCH);

	context.log("installed an add-on", {
		packs: installed.length,
		bundle: source.bundle,
		provider: source.provider ?? "upload",
	});

	const beta = found.filter((pack) => pack.manifest.betaModules.length > 0);
	const betaApisOff = beta.length > 0 && betaApisEnabled(await readLevelExperiments(context, world)) !== true;
	if (betaApisOff) {
		context.log.warn(
			"this add-on needs the Beta APIs experiment, which is not on for this world, so its scripts will not load until Repair add-ons turns it on",
			{
				world,
				modules: [
					...new Set(beta.flatMap((pack) => pack.manifest.betaModules)),
				].join(", "),
			},
		);
	}

	return {
		packs: installed,
		betaApisOff,
	};
};
