import { describe, expect, it } from "bun:test";
import {
	type KnownPlayer,
	knownPlayerOf,
	LEDGER_LIMIT,
	normalizePlayers,
	prunePlayers,
	rememberPlayer,
} from "./knownPlayers";

const ledger = () => new Map<string, KnownPlayer>();

describe("remembering the players the server has seen", () => {
	it("records a player the first time they connect", () => {
		const players = ledger();

		expect(rememberPlayer(players, "2535", "Meslzy", "2026-09-12T19:00:00Z")).toBe(true);
		expect(players.get("2535")?.name).toBe("Meslzy");
	});

	it("reports no change when a known player reconnects under the same name", () => {
		const players = ledger();

		rememberPlayer(players, "2535", "Meslzy", "2026-09-12T19:00:00Z");

		expect(rememberPlayer(players, "2535", "Meslzy", "2026-09-12T20:00:00Z")).toBe(false);
		expect(players.get("2535")?.lastSeen).toBe("2026-09-12T20:00:00Z");
	});

	it("keeps the old gamertag when a player renames, because the xuid is the identity", () => {
		const players = ledger();

		rememberPlayer(players, "2535", "Meslzy", "2026-09-12T19:00:00Z");
		rememberPlayer(players, "2535", "MeslzyGG", "2026-09-13T19:00:00Z");

		expect(players.get("2535")?.name).toBe("MeslzyGG");
		expect(players.get("2535")?.names).toEqual([
			"Meslzy",
		]);
	});
});

describe("resolving a player the operator typed", () => {
	const players = ledger();

	rememberPlayer(players, "2535", "Meslzy", "2026-09-12T19:00:00Z");
	rememberPlayer(players, "2535", "MeslzyGG", "2026-09-13T19:00:00Z");

	it("resolves by xuid", () => {
		expect(knownPlayerOf(players, "2535")?.name).toBe("MeslzyGG");
	});

	it("resolves by the current gamertag, whatever the case", () => {
		expect(knownPlayerOf(players, "meslzygg")?.xuid).toBe("2535");
	});

	it("still resolves by a gamertag the player used before, so an old allowlist entry is not orphaned", () => {
		expect(knownPlayerOf(players, "Meslzy")?.xuid).toBe("2535");
	});

	it("answers null for someone who has never joined, which is what blocks opping them offline", () => {
		expect(knownPlayerOf(players, "Stranger")).toBeNull();
	});
});

describe("keeping the ledger bounded", () => {
	const filled = () => {
		const players = ledger();

		for (let index = 0; index < LEDGER_LIMIT + 20; index += 1) {
			rememberPlayer(
				players,
				`x${index}`,
				`Player${index}`,
				`2026-09-${String((index % 28) + 1).padStart(2, "0")}T19:00:00Z`,
			);
		}

		return players;
	};

	it("prunes down to the cap, oldest first", () => {
		expect(prunePlayers(filled(), new Set()).size).toBe(LEDGER_LIMIT);
	});

	it("never prunes a player the allowlist or the operator list still points at", () => {
		const players = filled();
		const oldest = [
			...players.values(),
		]
			.sort((left, right) => left.lastSeen.localeCompare(right.lastSeen))
			.at(0);
		const kept = prunePlayers(
			players,
			new Set([
				oldest?.xuid ?? "",
			]),
		);

		expect(kept.has(oldest?.xuid ?? "")).toBe(true);
	});
});

describe("reading a ledger written by an older build", () => {
	it("drops entries with no xuid rather than throwing", () => {
		expect(
			normalizePlayers([
				{
					name: "Meslzy",
				},
				{
					xuid: "2535",
					name: "Meslzy",
				},
			]).size,
		).toBe(1);
	});

	it("answers empty for anything that is not a list", () => {
		expect(
			normalizePlayers({
				xuid: "2535",
			}).size,
		).toBe(0);
	});
});
