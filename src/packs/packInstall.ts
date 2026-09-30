import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import {
	BEHAVIOR_PACKS_DIRECTORY,
	PACK_SIDECAR_FILE,
	PACK_STAGING,
	publishFiles,
	RESOURCE_PACKS_DIRECTORY,
	recoverFileTransaction,
	requireStopped,
} from "../shared";
import { activeWorld, betaApisEnabled, readLevelExperiments } from "../worlds";
import type { PackInstallResult } from "./packActivity";
import { discoverPacks, unpackArchive } from "./packArchive";
import { activationOrder, assertCompatible, manifestFor, packWorlds, safePackFolder } from "./packCompatibility";
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
	ar: "هذا ملف ماب مو أدون. ارفعه من تبويب المابات.",
	en: "this is a world, not an add-on — upload it from the Worlds tab",
});

export const noManifest = new BridgeUserError({
	ar: "ما لقينا ملف manifest.json داخل الملف. تأكد إنك ترفع أدون أصلي بصيغة .mcaddon أو .mcpack",
	en: "the archive holds no manifest.json — make sure you are uploading a real .mcaddon or .mcpack",
});

export interface PackSource {
	archive: string;
	bundle: string;
	provider?: string | null;
	project?: string | null;
	file?: string | null;
	icon?: string | null;
	pageUrl?: string | null;
}

export const installPackSource = async (context: Bridge.Context, source: PackSource): Promise<PackInstallResult> => {
	requireStopped(context);
	await recoverFileTransaction(context);
	const unpacked = `${PACK_STAGING}/unpacked`;

	await unpackArchive(context, source.archive, unpacked);

	const found = await discoverPacks(context, unpacked);

	if (found.length === 0) {
		throw noManifest;
	}

	if (found.every((pack) => pack.manifest.kind === PackKind.WorldTemplate)) {
		throw worldTemplateRejected;
	}

	const sidecar = await inventoryPacks(context);
	const world = await activeWorld(context);
	const installed: PackRecord[] = [];
	const candidateIds = new Set(found.map((pack) => pack.manifest.uuid));
	if (candidateIds.size !== found.length) {
		throw new BridgeUserError({
			ar: "الملف فيه أكثر من أدون بنفس المعرّف. ارفع نسخة وحدة من كل أدون.",
			en: "The archive contains duplicate pack identities. Include one version of each pack.",
		});
	}
	const existing = await Promise.all(
		Object.values(sidecar.packs)
			.filter((pack) => !candidateIds.has(pack.uuid) && pack.dependencies.some((id) => candidateIds.has(id)))
			.map((pack) => manifestFor(context, pack)),
	);
	await assertCompatible(
		context,
		[
			...found.map((pack) => pack.manifest),
			...existing.filter((manifest) => manifest !== null),
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

		const title = await resolvePackText(context, pack.directory, pack.manifest.nameKey, source.bundle);
		const previous = sidecar.packs[pack.manifest.uuid];
		if (
			previous !== undefined
			&& previous.versionText !== pack.manifest.version.text
			&& (await packWorlds(context, previous)).some((used) => used !== world)
		) {
			throw new BridgeUserError({
				ar: "هذا الأدون مستخدم في ماب ثانية. فك ارتباطه منها قبل تغيير نسخته.",
				en: "Another world uses this pack. Remove that world’s reference before changing its version.",
			});
		}
		if (previous !== undefined && previous.kind !== pack.manifest.kind) {
			throw new BridgeUserError({
				ar: "نوع الأدون تغيّر بنفس المعرّف. احذف النسخة القديمة بعد مراجعة متطلباتها قبل تركيب النوع الجديد.",
				en: "This pack changed type under the same identity. Review dependencies and remove the old pack before installing the new type.",
			});
		}
		const scope = previous?.folder.startsWith("worlds/") ? `worlds/${world}/` : "";
		const folder = `${scope}${packDirectory(pack.manifest.kind)}/${packFolderName(title, pack.manifest.uuid)}`;

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
			title,
			version: pack.manifest.version.parts,
			versionText: pack.manifest.version.text,
			bundle: source.bundle,
			order: previous?.order ?? 0,
			dependencies: pack.manifest.dependencies,
			provider: source.provider ?? null,
			project: source.project ?? null,
			file: source.file ?? null,
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
	const sidecarStage = `${PACK_STAGING}/next-sidecar.json`;
	await context.files.write(sidecarStage, JSON.stringify(sidecar));
	replacements.push({
		source: sidecarStage,
		destination: PACK_SIDECAR_FILE,
	});
	const activated = activationOrder(
		installed.map((pack) => pack.uuid),
		sidecar.packs,
	);
	const dependencyManifests = await Promise.all(
		activated.filter((pack) => !candidateIds.has(pack.uuid)).map((pack) => manifestFor(context, pack)),
	);
	await assertCompatible(
		context,
		[
			...found.map((pack) => pack.manifest),
			...dependencyManifests.filter((manifest) => manifest !== null),
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
		const stage = `${PACK_STAGING}/next-${kind}.json`;
		await context.files.write(stage, JSON.stringify(entries));
		replacements.push({
			source: stage,
			destination: worldPackFile(world, kind),
		});
	}
	await publishFiles(context, replacements, removed);

	await context.files.remove(PACK_STAGING);

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
