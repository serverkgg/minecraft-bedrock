import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { BedrockTransport, PROPERTY_KEYS, roster, stopWatchingRoster } from "../shared";
import { createQuery } from "./query";

let answering = true;

const connections: string[] = [];

const bedrock = Bun.serve({
	hostname: "127.0.0.1",
	port: 0,
	fetch(request) {
		connections.push(new URL(request.url).pathname);

		return new Response(null, {
			status: 200,
		});
	},
});

afterAll(() => {
	bedrock.stop(true);
});

interface Harness {
	context: Bridge.Context;
	warnings: string[];
	commands: string[];
	pings: number[];
	reads: string[][];
}

const unreachable = async () => {
	throw new Error("timed out");
};

const listenerOf = (port: number) =>
	`   0: 00000000000000000000000000000000:${port.toString(16).toUpperCase().padStart(4, "0")} 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 310794817 1 0000000000000000 100 0 0 10 0`;

const harness = (properties: Record<string, string>, listed = 0): Harness => {
	const warnings: string[] = [];
	const commands: string[] = [];
	const pings: number[] = [];
	const reads: string[][] = [];
	const context = {
		port: () => bedrock.port,
		codec: {
			properties: {
				read: async () => properties,
			},
		},
		logs: {
			follow: () => () => {},
			tail: async () => [],
		},
		exec: async (command: string[]) => {
			reads.push(command);

			return {
				code: 0,
				stdout: answering ? listenerOf(bedrock.port ?? 0) : "",
				stderr: "",
			};
		},
		command: async (input: string) => {
			commands.push(input);

			return {
				sent: input,
				line: `There are ${listed}/10 players online:`,
				groups: {
					online: String(listed),
					max: "10",
				},
			};
		},
		probe: {
			raknetPing: async (port: number) => {
				pings.push(port);

				return {
					players: {
						online: 0,
						max: 25,
					},
				};
			},
		},
		emit: () => {},
		log: Object.assign(() => {}, {
			warn: (message: string) => {
				warnings.push(message);
			},
			error: () => {},
		}),
		activity: {
			report: () => {},
		},
	} as unknown as Bridge.Context;

	return {
		context,
		warnings,
		commands,
		pings,
		reads,
	};
};

beforeEach(() => {
	stopWatchingRoster();
	answering = true;
	connections.length = 0;
});

describe("sampling a nethernet server", () => {
	it("finds the listener in the socket table and counts the roster off the log", async () => {
		const { context, pings, reads, warnings } = harness({
			[PROPERTY_KEYS.transport]: BedrockTransport.NetherNet,
			[PROPERTY_KEYS.maxPlayers]: "20",
		});
		roster.connect("2535400000000001", "Steve");

		const sample = await createQuery().sample(context);

		expect(reads).toHaveLength(1);
		expect(pings).toEqual([]);
		expect(warnings).toEqual([]);
		expect(sample).toEqual({
			online: 1,
			max: 20,
		});
	});

	it("never connects to the join port, because each connection bedrock closes keeps a restarted bedrock from listening for a minute", async () => {
		const { context } = harness({
			[PROPERTY_KEYS.transport]: BedrockTransport.NetherNet,
		});
		const query = createQuery();

		for (let index = 0; index < 4; index++) {
			await query.sample(context);
		}

		expect(connections).toEqual([]);
	});

	it("treats a file without a transport as nethernet, the transport seedConfig writes", async () => {
		const { context, pings, reads } = harness({});

		const sample = await createQuery().sample(context);

		expect(reads).toHaveLength(1);
		expect(pings).toEqual([]);
		expect(sample.max).toBeNull();
	});

	it("reconciles the roster with list every third sample, dropping a player the log never saw leave", async () => {
		const { context, commands } = harness(
			{
				[PROPERTY_KEYS.maxPlayers]: "10",
			},
			0,
		);
		const query = createQuery();
		roster.connect("2535400000000001", "Ghost");

		expect((await query.sample(context)).online).toBe(1);
		expect((await query.sample(context)).online).toBe(1);
		expect(commands).toEqual([]);

		expect((await query.sample(context)).online).toBe(0);
		expect(commands).toEqual([
			"list",
		]);
	});

	it("warns once while the probe keeps failing, and still answers from the roster", async () => {
		answering = false;
		const { context, warnings, commands } = harness({
			[PROPERTY_KEYS.maxPlayers]: "10",
		});
		context.probe.raknetPing = unreachable;
		const query = createQuery();
		roster.connect("2535400000000001", "Steve");

		for (let index = 0; index < 4; index++) {
			expect(await query.sample(context)).toEqual({
				online: 1,
				max: 10,
			});
		}

		expect(warnings).toHaveLength(1);
		expect(commands).toEqual([]);
	});

	it("warns again after the probe recovered and failed a second time", async () => {
		const { context, warnings } = harness({});
		context.probe.raknetPing = unreachable;
		const query = createQuery();

		answering = false;
		await query.sample(context);
		answering = true;
		await query.sample(context);
		answering = false;
		await query.sample(context);

		expect(warnings).toHaveLength(2);
	});
});

describe("reconciling the roster with list", () => {
	it("never runs list while the roster is empty, so an idle console stays quiet", async () => {
		const { context, commands } = harness({});
		const query = createQuery();

		for (let index = 0; index < 6; index++) {
			await query.sample(context);
		}

		expect(commands).toEqual([]);
	});

	it("keeps the sample when list fails, answering from the roster", async () => {
		const { context, warnings } = harness({
			[PROPERTY_KEYS.maxPlayers]: "10",
		});
		context.command = async () => {
			throw new Error("no reply");
		};
		const query = createQuery();
		roster.connect("2535400000000001", "Steve");

		await query.sample(context);
		await query.sample(context);

		expect(await query.sample(context)).toEqual({
			online: 1,
			max: 10,
		});
		expect(warnings).toHaveLength(1);
	});
});

describe("a nethernet server that does not listen on the join port", () => {
	it("tries the raknet ping, because a build pinned before nethernet runs raknet whatever the file says", async () => {
		answering = false;
		const { context, pings, warnings } = harness({
			[PROPERTY_KEYS.transport]: BedrockTransport.NetherNet,
			[PROPERTY_KEYS.maxPlayers]: "10",
		});

		const sample = await createQuery().sample(context);

		expect(pings).toEqual([
			context.port("game"),
		]);
		expect(warnings).toEqual([]);
		expect(sample).toEqual({
			online: 0,
			max: 25,
		});
	});
});

describe("sampling a raknet server", () => {
	it("keeps the raknet ping and takes the counts from the pong", async () => {
		const { context, pings, reads } = harness({
			[PROPERTY_KEYS.transport]: BedrockTransport.RakNet,
			[PROPERTY_KEYS.maxPlayers]: "10",
		});

		const sample = await createQuery().sample(context);

		expect(pings).toEqual([
			context.port("game"),
		]);
		expect(reads).toEqual([]);
		expect(sample).toEqual({
			online: 0,
			max: 25,
		});
	});

	it("falls back to the roster and max-players when the ping fails, warning once", async () => {
		const { context, warnings } = harness({
			[PROPERTY_KEYS.transport]: BedrockTransport.RakNet,
			[PROPERTY_KEYS.maxPlayers]: "10",
		});
		context.probe.raknetPing = unreachable;
		const query = createQuery();

		await query.sample(context);

		expect(await query.sample(context)).toEqual({
			online: 0,
			max: 10,
		});
		expect(warnings).toHaveLength(1);
	});
});
