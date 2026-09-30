import type { Bridge } from "@serverkgg/bridge";
import { PLAYER_LEDGER_FILE } from "./paths";

export const LEDGER_LIMIT = 500;

const PREVIOUS_NAMES_LIMIT = 4;

export interface KnownPlayer {
	xuid: string;
	name: string;
	names: string[];
	firstSeen: string;
	lastSeen: string;
}

interface RawPlayer {
	xuid?: unknown;
	name?: unknown;
	names?: unknown;
	firstSeen?: unknown;
	lastSeen?: unknown;
}

const textOf = (value: unknown, fallback: string) => {
	return typeof value === "string" && value.length > 0 ? value : fallback;
};

export const normalizePlayers = (raw: unknown): Map<string, KnownPlayer> => {
	const players = new Map<string, KnownPlayer>();

	if (!Array.isArray(raw)) {
		return players;
	}

	for (const entry of raw as RawPlayer[]) {
		if (typeof entry?.xuid !== "string" || entry.xuid.length === 0) {
			continue;
		}

		const seen = textOf(entry.lastSeen, "");

		players.set(entry.xuid, {
			xuid: entry.xuid,
			name: textOf(entry.name, ""),
			names: Array.isArray(entry.names)
				? entry.names.filter((name): name is string => typeof name === "string").slice(0, PREVIOUS_NAMES_LIMIT)
				: [],
			firstSeen: textOf(entry.firstSeen, seen),
			lastSeen: seen,
		});
	}

	return players;
};

export const rememberPlayer = (players: Map<string, KnownPlayer>, xuid: string, name: string, at: string) => {
	const known = players.get(xuid);

	if (known === undefined) {
		players.set(xuid, {
			xuid,
			name,
			names: [],
			firstSeen: at,
			lastSeen: at,
		});

		return true;
	}

	const renamed = known.name !== name && name.length > 0;

	players.set(xuid, {
		...known,
		name: name.length > 0 ? name : known.name,
		names: renamed
			? [
					known.name,
					...known.names.filter((previous) => previous !== known.name),
				].slice(0, PREVIOUS_NAMES_LIMIT)
			: known.names,
		lastSeen: at,
	});

	return renamed;
};

export const prunePlayers = (players: Map<string, KnownPlayer>, referenced: Set<string>) => {
	if (players.size <= LEDGER_LIMIT) {
		return players;
	}

	const ordered = [
		...players.values(),
	].sort((left, right) => right.lastSeen.localeCompare(left.lastSeen));

	const kept = new Map<string, KnownPlayer>();

	for (const player of ordered) {
		if (kept.size < LEDGER_LIMIT || referenced.has(player.xuid)) {
			kept.set(player.xuid, player);
		}
	}

	return kept;
};

export const knownPlayerOf = (players: Map<string, KnownPlayer>, needle: string): KnownPlayer | null => {
	const trimmed = needle.trim();

	if (trimmed.length === 0) {
		return null;
	}

	const byXuid = players.get(trimmed);

	if (byXuid) {
		return byXuid;
	}

	const lowered = trimmed.toLowerCase();

	for (const player of players.values()) {
		if (player.name.toLowerCase() === lowered || player.names.some((name) => name.toLowerCase() === lowered)) {
			return player;
		}
	}

	return null;
};

export const readKnownPlayers = async (context: Bridge.Context) => {
	if (!(await context.files.exists(PLAYER_LEDGER_FILE))) {
		return new Map<string, KnownPlayer>();
	}

	try {
		return normalizePlayers(JSON.parse(await context.files.read(PLAYER_LEDGER_FILE)));
	} catch {
		context.log.warn("the known-player ledger was unreadable, starting a fresh one");

		return new Map<string, KnownPlayer>();
	}
};

export const writeKnownPlayers = async (context: Bridge.Context, players: Map<string, KnownPlayer>) => {
	const entries = [
		...players.values(),
	].sort((left, right) => right.lastSeen.localeCompare(left.lastSeen));

	await context.files.write(PLAYER_LEDGER_FILE, `${JSON.stringify(entries, null, 2)}\n`);
};

export const lookupKnownPlayer = async (context: Bridge.Context, needle: string): Promise<KnownPlayer | null> => {
	try {
		return knownPlayerOf(await readKnownPlayers(context), needle);
	} catch (error) {
		context.log.warn("could not read the known-player ledger, reporting the player by name only", {
			reason: error instanceof Error ? error.message : String(error),
		});

		return null;
	}
};
