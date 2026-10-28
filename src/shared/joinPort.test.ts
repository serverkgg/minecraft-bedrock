import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { listeningOn, readTcpSockets, SOCKET_TABLES, TCP_LISTEN, tcpSocketsOf } from "./joinPort";

const HEADER =
	"  sl  local_address                         remote_address                        st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode";

const LISTENING =
	"   0: 00000000000000000000000000000000:4ABC 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 310794817 1 0000000000000000 100 0 0 10 0";

const TIME_WAIT =
	"   1: 0000000000000000FFFF00000100007F:4ABC 0000000000000000FFFF00000100007F:B3A2 06 00000000:00000000 03:00001234 00000000     0        0 0 3 0000000000000000";

const OTHER_PORT =
	"   2: 0B00007F:9169 00000000:0000 0A 00000000:00000000 00:00000000 00000000 65534        0 310794818 1 0000000000000000 100 0 0 10 0";

const tablesWith = (...lines: string[]) =>
	[
		HEADER,
		...lines,
	].join("\n");

const socketsOf = (table: string) => {
	const reads: string[][] = [];
	const context = {
		exec: async (command: string[]) => {
			reads.push(command);

			return {
				code: 0,
				stdout: table,
				stderr: "",
			};
		},
	} as unknown as Bridge.Context;

	return {
		context,
		reads,
	};
};

describe("tcpSocketsOf", () => {
	it("reads the port and state of every socket and skips the header", () => {
		expect(tcpSocketsOf(tablesWith(LISTENING, TIME_WAIT, OTHER_PORT))).toEqual([
			{
				port: 19_132,
				state: TCP_LISTEN,
			},
			{
				port: 19_132,
				state: "06",
			},
			{
				port: 37_225,
				state: TCP_LISTEN,
			},
		]);
	});

	it("reads nothing from an empty or broken table", () => {
		expect(tcpSocketsOf("")).toEqual([]);
		expect(tcpSocketsOf("cat: /proc/net/tcp6: No such file or directory")).toEqual([]);
	});
});

describe("listeningOn", () => {
	it("finds the listener bedrock opens on the join port", () => {
		expect(listeningOn(tcpSocketsOf(tablesWith(LISTENING)), 19_132)).toBe(true);
	});

	it("reports no listener when only closed connections hold the port", () => {
		expect(listeningOn(tcpSocketsOf(tablesWith(TIME_WAIT, OTHER_PORT)), 19_132)).toBe(false);
	});
});

describe("readTcpSockets", () => {
	it("reads both socket tables in one command", async () => {
		const run = socketsOf(tablesWith(LISTENING));

		expect(await readTcpSockets(run.context)).toEqual([
			{
				port: 19_132,
				state: TCP_LISTEN,
			},
		]);
		expect(run.reads).toEqual([
			[
				"cat",
				...SOCKET_TABLES,
			],
		]);
	});
});
