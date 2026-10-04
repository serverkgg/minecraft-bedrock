import { describe, expect, it } from "bun:test";
import { connectedPlayer, disconnectedPlayer, parseListNames, spawnedPlayer, withoutLogPrefix } from "./bedrockLog";

const CONNECTED = "[2026-09-12 19:04:11:288 INFO] Player connected: Meslzy, xuid: 2535412345678901";

const DISCONNECTED =
	"[2026-09-12 19:09:02:104 INFO] Player disconnected: Meslzy, xuid: 2535412345678901, pfid: a1b2c3d4";

const SPAWNED = "[2026-09-12 19:04:13:900 INFO] Player Spawned: Meslzy xuid: 2535412345678901, pfid: a1b2c3d4";

describe("reading a player off a bedrock log line", () => {
	it("takes the gamertag and the xuid off a connect line", () => {
		expect(connectedPlayer(CONNECTED)).toEqual({
			player: "Meslzy",
			xuid: "2535412345678901",
		});
	});

	it("still parses a disconnect line that carries the trailing pfid newer builds add", () => {
		expect(disconnectedPlayer(DISCONNECTED)).toEqual({
			player: "Meslzy",
			xuid: "2535412345678901",
		});
	});

	it("parses the spawn line, which separates the gamertag with a space and not a comma", () => {
		expect(spawnedPlayer(SPAWNED)).toEqual({
			player: "Meslzy",
			xuid: "2535412345678901",
		});
	});

	it("keeps a gamertag that contains spaces, because bedrock allows them", () => {
		const line = "[2026-09-12 19:04:11:288 INFO] Player connected: Abu Sultan, xuid: 25354123";

		expect(connectedPlayer(line)?.player).toBe("Abu Sultan");
	});

	it("stops at the xuid so a gamertag containing a comma cannot swallow it", () => {
		const line = "[2026-09-12 19:04:11:288 INFO] Player connected: Ali, the builder, xuid: 25354123";

		expect(connectedPlayer(line)).toEqual({
			player: "Ali, the builder",
			xuid: "25354123",
		});
	});

	it("answers null for a chat line that merely mentions a connect, rather than inventing a player", () => {
		expect(connectedPlayer("[2026-09-12 19:04:11:288 INFO] <Meslzy> Player connected: nobody")).toBeNull();
	});

	it("strips the bedrock timestamp prefix, which is not the java one", () => {
		expect(withoutLogPrefix("[2026-09-12 19:04:11:288 INFO] Server started.")).toBe("Server started.");
	});
});

describe("reading the roster off a list reply", () => {
	const header = "[2026-09-12 19:20:00:000 INFO] There are 3/10 players online:";

	it("takes the names off the line after the header, which is where bedrock prints them", () => {
		const text = [
			header,
			"[2026-09-12 19:20:00:001 INFO] Meslzy, Abu Sultan, Noura",
		].join("\n");

		expect(parseListNames(text, 3)).toEqual([
			"Meslzy",
			"Abu Sultan",
			"Noura",
		]);
	});

	it("also takes them off the header line itself, so the layout does not have to be confirmed first", () => {
		expect(parseListNames(`${header} Meslzy, Noura`, 2)).toEqual([
			"Meslzy",
			"Noura",
		]);
	});

	it("reassembles a name list that wrapped across several lines", () => {
		const text = [
			header,
			"[2026-09-12 19:20:00:001 INFO] Meslzy,",
			"[2026-09-12 19:20:00:002 INFO] Noura",
		].join("\n");

		expect(parseListNames(text, 2)).toEqual([
			"Meslzy",
			"Noura",
		]);
	});

	it("never returns more names than the header counted, so log noise cannot pad the roster", () => {
		const text = [
			header,
			"Meslzy, Noura, Ali, Sara, Omar",
		].join("\n");

		expect(parseListNames(text, 3)).toEqual([
			"Meslzy",
			"Noura",
			"Ali",
		]);
	});

	it("answers empty when no header is present at all", () => {
		expect(parseListNames("nothing to see here", 3)).toEqual([]);
	});
});
