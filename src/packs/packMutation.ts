import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { PACK_SIDECAR_FILE, PACK_STAGING, publishFiles, recoverFileTransaction, requireStopped } from "../shared";
import { activeWorld } from "../worlds";
import {
	activationOrder,
	assertCanDisable,
	assertCompatible,
	assertRemovable,
	linkedPacks,
	manifestFor,
} from "./packCompatibility";
import { inventoryPacks } from "./packDiscovery";
import { PackKind } from "./packManifest";
import {
	readWorldPacks,
	type WorldPackEntry,
	withPackActivated,
	withPackDeactivated,
	worldPackFile,
} from "./packRegistry";
import type { PackRecord, PackSidecar } from "./packSidecar";

const commitState = async (
	context: Bridge.Context,
	world: string,
	sidecar: PackSidecar,
	registries: Map<PackKind, WorldPackEntry[]>,
	removed: string[] = [],
) => {
	await context.files.ensure(PACK_STAGING);
	const staged = `${PACK_STAGING}/mutation-sidecar.json`;
	await context.files.write(staged, JSON.stringify(sidecar));
	const replacements = [
		{
			source: staged,
			destination: PACK_SIDECAR_FILE,
		},
	];
	for (const [kind, entries] of registries) {
		const source = `${PACK_STAGING}/mutation-${kind}.json`;
		await context.files.write(source, JSON.stringify(entries));
		replacements.push({
			source,
			destination: worldPackFile(world, kind),
		});
	}
	await publishFiles(context, replacements, removed);
	await context.files.remove(PACK_STAGING);
};

const worldRegistries = async (context: Bridge.Context, world: string) => {
	const registries = new Map<PackKind, WorldPackEntry[]>();
	for (const kind of [
		PackKind.Behavior,
		PackKind.Resource,
	]) {
		registries.set(kind, await readWorldPacks(context, world, kind));
	}
	return registries;
};

export const setPacksEnabled = async (
	context: Bridge.Context,
	ids: string[],
	enabled: boolean,
): Promise<PackRecord[]> => {
	requireStopped(context);
	await recoverFileTransaction(context);
	const sidecar = await inventoryPacks(context);
	const world = await activeWorld(context);
	const registries = await worldRegistries(context, world);
	const targets = enabled ? ids : linkedPacks(ids, sidecar.packs);
	const ordered = enabled ? activationOrder(ids, sidecar.packs) : targets.flatMap((id) => sidecar.packs[id] ?? []);
	if (enabled) {
		const manifests = await Promise.all(ordered.map((pack) => manifestFor(context, pack)));
		if (manifests.some((manifest) => manifest === null)) {
			throw new BridgeUserError({
				ar: "ملفات أحد المتطلبات ناقصة. ركّب الأدون مرة ثانية.",
				en: "A required pack has missing files. Install it again.",
			});
		}
		await assertCompatible(
			context,
			manifests.filter((manifest) => manifest !== null),
			sidecar.packs,
		);
	} else {
		const otherPacks = Object.fromEntries(Object.entries(sidecar.packs).filter(([id]) => !targets.includes(id)));
		for (const pack of ordered) {
			await assertCanDisable(context, pack, otherPacks);
		}
	}
	for (const pack of ordered) {
		const entries = registries.get(pack.kind) ?? [];
		const index = entries.findIndex((entry) => entry.pack_id === pack.uuid);
		if (!enabled) {
			pack.order = Math.max(0, index);
		}
		registries.set(
			pack.kind,
			enabled
				? withPackActivated(
						entries,
						{
							pack_id: pack.uuid,
							version: pack.version,
						},
						index < 0 ? undefined : index,
					)
				: withPackDeactivated(entries, pack.uuid),
		);
	}
	await commitState(context, world, sidecar, registries);
	return ordered;
};

export const removePacks = async (context: Bridge.Context, ids: string[]): Promise<PackRecord[]> => {
	requireStopped(context);
	await recoverFileTransaction(context);
	const sidecar = await inventoryPacks(context);
	const world = await activeWorld(context);
	const selected = linkedPacks(ids, sidecar.packs).flatMap((id) => sidecar.packs[id] ?? []);
	await assertRemovable(context, selected, sidecar.packs);
	const registries = await worldRegistries(context, world);
	for (const pack of selected) {
		registries.set(pack.kind, withPackDeactivated(registries.get(pack.kind) ?? [], pack.uuid));
		delete sidecar.packs[pack.uuid];
	}
	await commitState(
		context,
		world,
		sidecar,
		registries,
		selected.map((pack) => pack.folder),
	);
	return selected;
};
