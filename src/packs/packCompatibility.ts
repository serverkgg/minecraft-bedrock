import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { readInstallStamp } from "../install";
import { compareVersion, versionParts } from "../shared";
import { activeWorld, discoverWorlds } from "../worlds";
import { type PackKind, type PackManifest, type PackVersion, parsePackManifest } from "./packManifest";
import { readWorldPacks } from "./packRegistry";
import type { PackRecord } from "./packSidecar";

export const dependencySatisfied = (installed: PackVersion | undefined, declared: PackVersion | null) =>
	installed !== undefined && (declared === null || compareVersion(installed.parts, declared.parts) >= 0);

export interface PackCandidate {
	manifest: PackManifest;
	title: string;
}

export interface PresentPack {
	version: PackVersion;
	title: string;
}

export enum PackProblemKind {
	Engine = "engine",
	Missing = "missing",
	Older = "older",
}

export type PackProblem =
	| {
			kind: PackProblemKind.Engine;
			pack: string;
			engine: string;
	  }
	| {
			kind: PackProblemKind.Missing;
			pack: string;
			uuid: string;
			declared: string | null;
	  }
	| {
			kind: PackProblemKind.Older;
			pack: string;
			uuid: string;
			dependency: string;
			declared: string;
			installed: string;
	  };

export const packProblems = (
	candidate: PackCandidate,
	present: Map<string, PresentPack>,
	engine: string | null,
): PackProblem[] => {
	const { manifest, title } = candidate;
	const problems: PackProblem[] = [];
	if (
		manifest.minEngineVersion !== null
		&& engine !== null
		&& compareVersion(versionParts(engine), manifest.minEngineVersion.parts) < 0
	) {
		problems.push({
			kind: PackProblemKind.Engine,
			pack: title,
			engine: manifest.minEngineVersion.text,
		});
	}
	for (const dependency of manifest.requirements) {
		if (dependency.uuid === null) {
			continue;
		}
		const installed = present.get(dependency.uuid);
		if (dependencySatisfied(installed?.version, dependency.version)) {
			continue;
		}
		if (installed === undefined || dependency.version === null) {
			problems.push({
				kind: PackProblemKind.Missing,
				pack: title,
				uuid: dependency.uuid,
				declared: dependency.version?.text ?? null,
			});
			continue;
		}
		problems.push({
			kind: PackProblemKind.Older,
			pack: title,
			uuid: dependency.uuid,
			dependency: installed.title,
			declared: dependency.version.text,
			installed: installed.version.text,
		});
	}
	return problems;
};

const problemText = (problem: PackProblem): Bridge.Text => {
	switch (problem.kind) {
		case PackProblemKind.Engine:
			return {
				ar: `تتطلب «${problem.pack}» ماينكرافت ${problem.engine} أو أحدث.`,
				en: `"${problem.pack}" needs Minecraft ${problem.engine} or newer.`,
			};
		case PackProblemKind.Missing: {
			const wanted = problem.declared === null ? problem.uuid : `${problem.uuid} ${problem.declared}`;
			return {
				ar: `تتطلب «${problem.pack}» إضافة غير مثبّتة (${wanted}).`,
				en: `"${problem.pack}" needs a pack that is not installed (${wanted}).`,
			};
		}
		case PackProblemKind.Older:
			return {
				ar: `تتطلب «${problem.pack}» الإضافة «${problem.dependency}» بإصدار ${problem.declared} أو أحدث، والإصدار المثبّت ${problem.installed}.`,
				en: `"${problem.pack}" needs "${problem.dependency}" ${problem.declared} or newer, but ${problem.installed} is installed.`,
			};
	}
};

export const compatibilityRefusal = (problems: PackProblem[]): Bridge.Text => {
	const texts = problems.map(problemText);
	const sentences = (language: keyof Bridge.Text) =>
		[
			...new Set(texts.map((text) => text[language])),
		].join(" ");
	return {
		ar: `${sentences("ar")} ثبّت المتطلبات أولًا.`,
		en: `${sentences("en")} Install the requirements first.`,
	};
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

export const recordedCandidates = async (context: Bridge.Context, records: PackRecord[]) => {
	const candidates: PackCandidate[] = [];
	for (const record of records) {
		const manifest = await manifestFor(context, record);
		if (manifest !== null) {
			candidates.push({
				manifest,
				title: record.title,
			});
		}
	}
	return candidates;
};

export const assertCompatible = async (
	context: Bridge.Context,
	candidates: PackCandidate[],
	packs: Record<string, PackRecord>,
) => {
	const present = new Map<string, PresentPack>();
	for (const pack of Object.values(packs)) {
		const manifest = await manifestFor(context, pack);
		if (manifest !== null) {
			present.set(manifest.uuid, {
				version: manifest.version,
				title: pack.title,
			});
		}
	}
	for (const candidate of candidates) {
		present.set(candidate.manifest.uuid, {
			version: candidate.manifest.version,
			title: candidate.title,
		});
	}
	const engine = (await readInstallStamp(context))?.version ?? null;
	const problems = candidates.flatMap((candidate) => packProblems(candidate, present, engine));
	if (problems.length > 0) {
		throw new BridgeUserError(compatibilityRefusal(problems));
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
				ar: `الإضافة مستخدمة في مابات أو إضافات أخرى: ${users}. ألغِ ارتباطها أولًا.`,
				en: `This add-on is used by other worlds or add-ons: ${users}. Remove those references first.`,
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
				ar: `الإضافة تتطلب ملفًا مفقودًا: ${id}`,
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
				ar: `أوقف «${candidate.title}» أولًا، لأنها تتطلب هذه الإضافة.`,
				en: `Disable "${candidate.title}" first. It needs this add-on.`,
			});
		}
	}
};
