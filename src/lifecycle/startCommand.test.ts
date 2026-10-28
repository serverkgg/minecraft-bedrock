import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SERVER_BINARY, SOCKET_TABLES } from "../shared";
import { JOIN_PORT_WAIT_SECONDS, START_SCRIPT, startCommand } from "./startCommand";

const HEADER =
	"  sl  local_address                         remote_address                        st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode";

const LISTENING =
	"   0: 00000000000000000000000000000000:4ABC 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 310794817 1 0000000000000000 100 0 0 10 0";

const TIME_WAIT =
	"   1: 0000000000000000FFFF00000100007F:4ABC 0000000000000000FFFF00000100007F:B3A2 06 00000000:00000000 03:00001234 00000000     0        0 0 3 0000000000000000";

const OTHER_PORT_TIME_WAIT =
	"   2: 0100007F:4ABD 0100007F:B3A3 06 00000000:00000000 03:00001234 00000000     0        0 0 3 0000000000000000";

const WAITING =
	"Waiting up to 5 seconds for port 19132 to close its last connections, because Bedrock cannot listen on it until they do";

let home = "";

const tableOf = (...lines: string[]) =>
	`${[
		HEADER,
		...lines,
	].join("\n")}\n`;

const writeTable = (contents: string) => {
	writeFileSync(join(home, "tcp6"), contents);
};

const start = async (
	seconds: number,
	tables = [
		join(home, "tcp6"),
	],
) => {
	const startedAt = performance.now();
	const shell = Bun.spawn(startCommand(19_132, seconds, tables), {
		cwd: home,
		stdout: "pipe",
	});
	const lines = (await new Response(shell.stdout).text()).trimEnd().split("\n");

	await shell.exited;

	return {
		pid: shell.pid,
		lines,
		seconds: (performance.now() - startedAt) / 1000,
	};
};

beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), "serverk-bedrock-start-"));
	writeFileSync(join(home, SERVER_BINARY), '#!/bin/sh\necho "started $$"\n');
	chmodSync(join(home, SERVER_BINARY), 0o755);
});

afterEach(() => {
	rmSync(home, {
		recursive: true,
		force: true,
	});
});

describe("startCommand", () => {
	it("runs the wrapper with the game port, the wait and both socket tables", () => {
		expect(startCommand(19_132)).toEqual([
			"sh",
			"-c",
			START_SCRIPT,
			SERVER_BINARY,
			"19132",
			String(JOIN_PORT_WAIT_SECONDS),
			...SOCKET_TABLES,
		]);
	});

	it("starts bedrock at once when only its own listener and other ports are in the table", async () => {
		writeTable(tableOf(LISTENING, OTHER_PORT_TIME_WAIT));

		const run = await start(5);

		expect(run.lines).toEqual([
			`started ${run.pid}`,
		]);
		expect(run.seconds).toBeLessThan(1);
	});

	it("waits while a closed connection still holds the game port, then starts bedrock", async () => {
		writeTable(tableOf(TIME_WAIT));
		setTimeout(() => {
			writeTable(tableOf());
		}, 1500);

		const run = await start(5);

		expect(run.lines).toEqual([
			WAITING,
			`started ${run.pid}`,
		]);
		expect(run.seconds).toBeGreaterThanOrEqual(1);
		expect(run.seconds).toBeLessThan(5);
	});

	it("starts bedrock anyway once the wait runs out", async () => {
		writeTable(tableOf(TIME_WAIT));

		const run = await start(1);

		expect(run.lines.at(-1)).toBe(`started ${run.pid}`);
		expect(run.seconds).toBeLessThan(3);
	});

	it("starts bedrock at once when the socket tables cannot be read", async () => {
		const run = await start(5, [
			join(home, "missing"),
		]);

		expect(run.lines).toEqual([
			`started ${run.pid}`,
		]);
	});
});
