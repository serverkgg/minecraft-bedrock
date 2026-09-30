import type { Bridge } from "@serverkgg/bridge";
import {
	connectedPlayer,
	disconnectedPlayer,
	LIST_HEADER,
	PLAYER_CONNECTED,
	PLAYER_DISCONNECTED,
	PLAYER_SPAWNED,
	parseListNames,
	spawnedPlayer,
} from "./bedrockLog";
import { COMMAND_TIMEOUT_MS } from "./console";

export interface BedrockPlayer {
	id: string;
	name: string;
	xuid: string;
	spawned: boolean;
}

const players = new Map<string, BedrockPlayer>();

const nameKey = (name: string) => `name:${name.toLowerCase()}`;

export const roster = {
	connect(xuid: string, name: string) {
		players.set(xuid, {
			id: xuid,
			name,
			xuid,
			spawned: players.get(xuid)?.spawned ?? false,
		});
	},

	spawn(xuid: string) {
		const player = players.get(xuid);

		if (player) {
			players.set(xuid, {
				...player,
				spawned: true,
			});
		}
	},

	disconnect(xuid: string) {
		players.delete(xuid);
	},

	replace(names: string[]) {
		const kept = new Map<string, BedrockPlayer>();

		for (const name of names) {
			const known = [
				...players.values(),
			].find((player) => player.name.toLowerCase() === name.toLowerCase());

			if (known) {
				kept.set(known.id, known);

				continue;
			}

			kept.set(nameKey(name), {
				id: nameKey(name),
				name,
				xuid: "",
				spawned: true,
			});
		}

		players.clear();

		for (const [id, player] of kept) {
			players.set(id, player);
		}
	},

	clear() {
		players.clear();
	},

	all() {
		return [
			...players.values(),
		];
	},

	find(needle: string) {
		const trimmed = needle.trim();
		const lowered = trimmed.toLowerCase();

		if (trimmed.length === 0) {
			return null;
		}

		return (
			[
				...players.values(),
			].find((player) => player.xuid === trimmed || player.name.toLowerCase() === lowered) ?? null
		);
	},

	online(needle: string) {
		return roster.find(needle) !== null;
	},
};

export const presenceOf = (player: BedrockPlayer): Bridge.Values => {
	return player.xuid.length === 0
		? {
				player: player.name,
			}
		: {
				player: player.name,
				xuid: player.xuid,
			};
};

let following = false;

export const watchRoster = (context: Bridge.Context) => {
	if (following) {
		return;
	}

	following = true;

	context.logs.follow(PLAYER_CONNECTED, (match) => {
		const player = connectedPlayer(match.at(0) ?? "");

		if (player) {
			roster.connect(player.xuid, player.player);
		}
	});

	context.logs.follow(PLAYER_SPAWNED, (match) => {
		const player = spawnedPlayer(match.at(0) ?? "");

		if (player) {
			roster.spawn(player.xuid);
		}
	});

	context.logs.follow(PLAYER_DISCONNECTED, (match) => {
		const player = disconnectedPlayer(match.at(0) ?? "");

		if (player) {
			roster.disconnect(player.xuid);
		}
	});
};

export const stopWatchingRoster = () => {
	following = false;
	roster.clear();
};

export interface RosterSample {
	online: number;
	max: number | null;
}

const TAIL_MARGIN = 8;

const POLL_INTERVAL_MS = 100;

const POLL_TIMEOUT_MS = 2000;

export const sampleRoster = async (context: Bridge.Context): Promise<RosterSample> => {
	const reply = await context.command("list", {
		expect: LIST_HEADER,
		timeoutMs: COMMAND_TIMEOUT_MS,
	});
	const online = Number(reply.groups.online ?? "0");
	const max = Number(reply.groups.max ?? "0");

	if (!Number.isFinite(online) || online === 0) {
		roster.replace([]);

		return {
			online: 0,
			max: Number.isFinite(max) && max > 0 ? max : null,
		};
	}

	const deadline = Date.now() + POLL_TIMEOUT_MS;

	for (;;) {
		const printed = await context.logs.tail(online + TAIL_MARGIN);
		const names = parseListNames(printed.join("\n"), online);

		if (names.length >= online || Date.now() >= deadline) {
			roster.replace(names);

			return {
				online,
				max: Number.isFinite(max) && max > 0 ? max : null,
			};
		}

		await Bun.sleep(POLL_INTERVAL_MS);
	}
};
