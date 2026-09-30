import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { readInstallStamp } from "../install";
import { activeWorld, discoverWorlds } from "../worlds";
import { type PackKind, type PackManifest, type PackVersion, parsePackManifest } from "./packManifest";
import { readWorldPacks } from "./packRegistry";
import type { PackRecord } from "./packSidecar";

export const compareVersion = (a: number[], b: number[]) => {
	for (let index = 0; index < Math.max(a.length, b.length); index++) {
		const difference = (a[index] ?? 0) - (b[index] ?? 0);
		if (difference !== 0) {
			return Math.sign(difference);
		}
	}
	return 0;
};

export const packProblems = (
	manifest: PackManifest,
	installed: Map<string, PackVersion>,
	engine: string | null,
): string[] => {
	const problems: string[] = [];
	if (
		manifest.minEngineVersion !== null
		&& engine !== null
		&& compareVersion(engine.split(".").map(Number), manifest.minEngineVersion.parts) < 0
	) {
		problems.push(`Minecraft ${manifest.minEngineVersion.text}`);
	}
	for (const dependency of manifest.requirements) {
		if (dependency.uuid === null) {
			continue;
		}
		const version = installed.get(dependency.uuid);
		if (
			version === undefined
			|| (dependency.version !== null && compareVersion(version.parts, dependency.version.parts) !== 0)
		) {
			problems.push(`${dependency.uuid} ${dependency.version?.text ?? ""}`.trim());
		}
	}
	return problems;
};

export const safePackFolder = (folder: string) =>
	/^(?:(?:behavior_packs|resource_packs)\/[^/]+|worlds\/[^/]+\/(?:behavior_packs|resource_packs)\/[^/]+)$/.test(folder)
	&& !/[\\\r\n\0]/.test(folder)
	&& folder.split("/").every((part) => part !== ".." && part !== ".");

export const manifestFor = async (context: Bridge.Context, record: PackRecord) => {
	if (!safePackFolder(record.folder)) {
		throw new Error("invalid pack folder");
	}
	if (!(await context.files.exists(`${record.folder}/manifest.json`))) {
		return null;
	}
	return parsePackManifest(await context.files.read(`${record.folder}/manifest.json`));
};

export const assertCompatible = async (
	context: Bridge.Context,
	candidates: PackManifest[],
	packs: Record<string, PackRecord>,
) => {
	const versions = new Map<string, PackVersion>();
	for (const pack of Object.values(packs)) {
		const manifest = await manifestFor(context, pack);
		if (manifest !== null) {
			versions.set(manifest.uuid, manifest.version);
		}
	}
	for (const manifest of candidates) {
		versions.set(manifest.uuid, manifest.version);
	}
	const engine = (await readInstallStamp(context))?.version ?? null;
	const problems = candidates.flatMap((manifest) => packProblems(manifest, versions, engine));
	if (problems.length > 0) {
		throw new BridgeUserError({
			ar: `الأدون يحتاج ملفات أو نسخة مختلفة: ${problems.join(", ")}. ركّب المتطلبات أول.`,
			en: `This add-on needs different files or an engine version: ${problems.join(", ")}. Install the requirements first.`,
		});
	}
};

export interface PackUsage {
	active: string;
	worldsUsing(pack: PackRecord): Promise<string[]>;
}

export const readPackUsage = async (context: Bridge.Context): Promise<PackUsage> => {
	const worlds = await discoverWorlds(context);
	const active = await activeWorld(context);
	if (!worlds.includes(active)) {
		worlds.push(active);
	}
	const registries = new Map<string, Promise<Set<string>>>();
	const registryOf = (world: string, kind: PackKind) => {
		const key = `${world}/${kind}`;
		const known = registries.get(key);
		if (known) {
			return known;
		}
		const read = readWorldPacks(context, world, kind).then((entries) => new Set(entries.map((entry) => entry.pack_id)));
		registries.set(key, read);
		return read;
	};
	return {
		active,
		async worldsUsing(pack) {
			const used: string[] = [];
			for (const world of worlds) {
				if ((await registryOf(world, pack.kind)).has(pack.uuid)) {
					used.push(world);
				}
			}
			return used;
		},
	};
};

export const packWorlds = async (context: Bridge.Context, pack: PackRecord) => {
	return await (await readPackUsage(context)).worldsUsing(pack);
};

export const removalRefusal = async (
	usage: PackUsage,
	selected: PackRecord[],
	packs: Record<string, PackRecord>,
): Promise<Bridge.Text | null> => {
	const ids = new Set(selected.map((pack) => pack.uuid));
	for (const pack of selected) {
		if (!safePackFolder(pack.folder)) {
			throw new Error("invalid pack folder");
		}
		const otherWorlds = (await usage.worldsUsing(pack)).filter((world) => world !== usage.active);
		const dependents = Object.values(packs).filter(
			(entry) => !ids.has(entry.uuid) && entry.dependencies.includes(pack.uuid),
		);
		if (otherWorlds.length > 0 || dependents.length > 0) {
			const users = [
				...otherWorlds,
				...dependents.map((entry) => entry.title),
			].join(", ");
			return {
				ar: `الأدون مستخدم في مابات أو أدونات ثانية: ${users}. فك ارتباطه أول.`,
				en: `This pack is used by other worlds or add-ons: ${users}. Remove those references first.`,
			};
		}
	}
	return null;
};

export const assertRemovable = async (
	context: Bridge.Context,
	selected: PackRecord[],
	packs: Record<string, PackRecord>,
) => {
	const refusal = await removalRefusal(await readPackUsage(context), selected, packs);
	if (refusal !== null) {
		throw new BridgeUserError(refusal);
	}
};

const reachablePacks = (id: string, packs: Record<string, PackRecord>) => {
	const seen = new Set<string>();
	const pending = [
		id,
	];
	while (pending.length > 0) {
		const next = pending.pop();
		if (next === undefined || seen.has(next)) {
			continue;
		}
		seen.add(next);
		pending.push(...(packs[next]?.dependencies ?? []));
	}
	return seen;
};

export const linkedPacks = (ids: string[], packs: Record<string, PackRecord>): string[] => {
	const linked = new Set(ids);
	for (const id of ids) {
		for (const candidate of reachablePacks(id, packs)) {
			if (packs[candidate] !== undefined && reachablePacks(candidate, packs).has(id)) {
				linked.add(candidate);
			}
		}
	}
	return [
		...linked,
	];
};

export const activationOrder = (ids: string[], packs: Record<string, PackRecord>): PackRecord[] => {
	const complete = new Set<string>();
	const visiting = new Set<string>();
	const ordered: PackRecord[] = [];
	const visit = (id: string) => {
		if (complete.has(id) || visiting.has(id)) {
			return;
		}
		const pack = packs[id];
		if (pack === undefined) {
			throw new BridgeUserError({
				ar: `الأدون يحتاج ملف مفقود: ${id}`,
				en: `Missing add-on dependency: ${id}`,
			});
		}
		visiting.add(id);
		for (const dependency of pack.dependencies) {
			visit(dependency);
		}
		visiting.delete(id);
		complete.add(id);
		ordered.push(pack);
	};
	for (const id of ids) {
		visit(id);
	}
	return ordered;
};

export const assertCanDisable = async (
	context: Bridge.Context,
	pack: PackRecord,
	packs: Record<string, PackRecord>,
) => {
	const world = await activeWorld(context);
	for (const candidate of Object.values(packs)) {
		if (!candidate.dependencies.includes(pack.uuid)) {
			continue;
		}
		if ((await readWorldPacks(context, world, candidate.kind)).some((entry) => entry.pack_id === candidate.uuid)) {
			throw new BridgeUserError({
				ar: `عطّل "${candidate.title}" أول، لأنه يحتاج هذا الأدون.`,
				en: `Disable "${candidate.title}" first; it needs this pack.`,
			});
		}
	}
};
