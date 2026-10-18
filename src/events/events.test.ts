import { describe, expect, it } from "bun:test";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { events } from "./events";

const emitted = (line: string) => {
	return events.patterns.filter((pattern) => pattern.match.test(line)).map((pattern) => pattern.emit);
};

const PORT_IN_USE =
	"[2023-10-15 17:07:34:768 ERROR] Port [19132] may be in use by another process. Free up port and re-run program or adjust server.properties file to use alternate ports for server";

const PORT_IN_USE_UNSPACED =
	"[2023-10-05 12:37:19:452 ERROR] Port [19132] may be in use by another process.Free up port and re-run program or adjust server.properties file to use alternate ports for server";

describe("reading a port that is already taken", () => {
	it("raises the event on the line bedrock prints when its port is taken", () => {
		expect(emitted(PORT_IN_USE)).toContain(BridgeEventName.PortBindFailed);
	});

	it("raises it on the variant bedrock prints with no space after the full stop", () => {
		expect(emitted(PORT_IN_USE_UNSPACED)).toContain(BridgeEventName.PortBindFailed);
	});

	it("raises it whatever port the line names, including the v6 port", () => {
		expect(
			emitted(
				"[2023-10-15 17:07:34:768 ERROR] Port [20141] may be in use by another process. Free up port and re-run program or adjust server.properties file to use alternate ports for server",
			),
		).toContain(BridgeEventName.PortBindFailed);
	});

	it("still raises it on the generic socket wordings it matched before", () => {
		for (const line of [
			"failed to bind to port 19132",
			"bind: Address already in use",
			"Unable to bind the socket",
		]) {
			expect(emitted(line)).toContain(BridgeEventName.PortBindFailed);
		}
	});

	it("does not raise it on a line that only mentions a port", () => {
		expect(emitted("[2026-09-12 19:04:10:000 INFO] IPv4 supported, port: 19132: Used for gameplay")).not.toContain(
			BridgeEventName.PortBindFailed,
		);
	});
});

describe("reading a corrupt world", () => {
	it("raises the event on a leveldb corruption line", () => {
		expect(emitted("[2026-09-12 19:04:10:000 ERROR] Corruption: block checksum mismatch")).toContain(
			BridgeEventName.WorldCorrupt,
		);
	});

	it("raises it on an io error against a leveldb table file", () => {
		expect(
			emitted("[2026-09-12 19:04:10:000 ERROR] IO error: worlds/world/db/000123.ldb: No such file or directory"),
		).toContain(BridgeEventName.WorldCorrupt);
	});

	it("does not raise it on an io error that names no table file", () => {
		expect(emitted("[2026-09-12 19:04:10:000 ERROR] IO error: worlds/world/db/LOCK: Permission denied")).not.toContain(
			BridgeEventName.WorldCorrupt,
		);
	});
});

describe("reading a crash", () => {
	it("raises the event on each line a dying bedrock prints", () => {
		for (const line of [
			"terminate called after throwing an instance of 'std::runtime_error'",
			"Segmentation fault (core dumped)",
			"Received signal SIGSEGV",
			"Received signal SIGABRT",
			"what(): std::bad_alloc",
		]) {
			expect(emitted(line)).toContain(BridgeEventName.ServerCrashed);
		}
	});

	it("does not raise it on a clean stop", () => {
		expect(emitted("[2026-09-12 19:20:00:000 INFO] Server stop requested.")).not.toContain(
			BridgeEventName.ServerCrashed,
		);
	});
});
