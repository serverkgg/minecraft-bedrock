import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { worldPath, writeJsonList } from "../shared";
import { PackKind } from "./packManifest";

export interface WorldPackEntry {
	pack_id: string;
	version: [
		number,
		number,
		number,
	];
}

interface RawEntry {
	pack_id?: unknown;
	version?: unknown;
}

export const worldPackFile = (world: string, kind: PackKind) => {
	const name = kind === PackKind.Behavior ? "world_behavior_packs.json" : "world_resource_packs.json";

	return `${worldPath(world)}/${name}`;
};

export const normalizeWorldPacks = (entries: unknown[]): WorldPackEntry[] => {
	const listed: WorldPackEntry[] = [];

	for (const entry of entries as RawEntry[]) {
		const version = Array.isArray(entry?.version) ? entry.version : null;

		if (typeof entry?.pack_id !== "string" || entry.pack_id.length === 0 || version === null) {
			continue;
		}

		const parts = version.slice(0, 3).map((part) => (typeof part === "number" ? part : 0));

		listed.push({
			pack_id: entry.pack_id,
			version: [
				parts[0] ?? 0,
				parts[1] ?? 0,
				parts[2] ?? 0,
			],
		});
	}

	return listed;
};

export const withPackActivated = (entries: WorldPackEntry[], entry: WorldPackEntry, index?: number) => {
	const without = entries.filter((listed) => listed.pack_id !== entry.pack_id);
	const at = index === undefined ? without.length : Math.max(0, Math.min(index, without.length));

	return [
		...without.slice(0, at),
		entry,
		...without.slice(at),
	];
};

export const withPackDeactivated = (entries: WorldPackEntry[], uuid: string) => {
	return entries.filter((listed) => listed.pack_id !== uuid);
};

export const movePackEntry = (entries: WorldPackEntry[], uuid: string, delta: -1 | 1) => {
	const index = entries.findIndex((entry) => entry.pack_id === uuid);
	const target = index + delta;

	if (index === -1 || target < 0 || target >= entries.length) {
		return entries;
	}

	const moved = [
		...entries,
	];
	const [entry] = moved.splice(index, 1);

	if (entry === undefined) {
		return entries;
	}

	moved.splice(target, 0, entry);

	return moved;
};

export const readWorldPacks = async (context: Bridge.Context, world: string, kind: PackKind) => {
	const path = worldPackFile(world, kind);
	if (!(await context.files.exists(path))) {
		return [];
	}
	try {
		const raw: unknown = JSON.parse(await context.files.read(path));
		if (!Array.isArray(raw)) {
			throw new Error("invalid registry");
		}
		const entries = normalizeWorldPacks(raw);
		if (
			entries.length !== raw.length
			|| raw.some(
				(entry) =>
					!Array.isArray(entry?.version)
					|| entry.version.length !== 3
					|| !entry.version.every(
						(part: unknown) => typeof part === "number" && Number.isSafeInteger(part) && part >= 0,
					),
			)
		) {
			throw new Error("invalid registry entry");
		}
		return entries;
	} catch {
		throw new BridgeUserError({
			ar: `ملف الإضافات ${path} غير سليم. أصلحه من الملفات أو رجّع نسخة احتياطية قبل التعديل.`,
			en: `The add-on registry ${path} is invalid. Repair it in Files or restore a backup before changing add-ons.`,
		});
	}
};

export const writeWorldPacks = async (
	context: Bridge.Context,
	world: string,
	kind: PackKind,
	entries: WorldPackEntry[],
) => {
	await writeJsonList(context, worldPackFile(world, kind), entries);
};
