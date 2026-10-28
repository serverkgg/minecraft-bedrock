import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { BedrockTransport, PROPERTY_KEYS, SERVER_IDENTITY_KEY_FILE } from "../shared";
import { DEFAULT_LEVEL_NAME, seedConfig, seedValues } from "./seedConfig";

const BLOCK = {
	first: 20_000,
	count: 64,
};

const ADDRESS = "203.0.113.7";

const seeding = (properties: Record<string, string>, version: string, missing: string[] = []) => {
	const logs: string[] = [];
	const merged: Record<string, string>[] = [];
	const written: string[] = [];
	const remember = (message: string) => {
		logs.push(message);
	};
	const context = {
		files: {
			ensure: async () => {},
			exists: async (path: string) => !missing.includes(path),
			write: async (path: string) => {
				written.push(path);
			},
			read: async () =>
				JSON.stringify({
					channel: "release",
					version,
					label: version,
					files: [],
					packs: [],
				}),
		},
		codec: {
			properties: {
				read: async () => properties,
				merge: async (_file: string, values: Record<string, string>) => {
					merged.push(values);
				},
			},
		},
		port: () => 19_132,
		portBlock: () => BLOCK,
		server: {
			publicAddress: ADDRESS,
		},
		log: Object.assign(remember, {
			warn: remember,
			error: remember,
		}),
	} as unknown as Bridge.Context;

	return {
		context,
		logs,
		merged,
		written,
	};
};

describe("seeding server.properties", () => {
	it("forces the port onto whatever the platform allocated, overwriting what is already there", () => {
		const values = seedValues(
			{
				[PROPERTY_KEYS.serverPort]: "19999",
			},
			19_140,
			BLOCK,
			ADDRESS,
		);

		expect(values[PROPERTY_KEYS.serverPort]).toBe("19140");
	});

	it("binds the v6 port one above the game port, so a raknet server never collides with a mirrored 19133", () => {
		expect(seedValues({}, 19_140, BLOCK, ADDRESS)[PROPERTY_KEYS.serverPortV6]).toBe("19141");
	});

	it("leaves a value the player already set, so their settings survive every boot", () => {
		const values = seedValues(
			{
				[PROPERTY_KEYS.maxPlayers]: "40",
				[PROPERTY_KEYS.difficulty]: "hard",
			},
			19_132,
			BLOCK,
			ADDRESS,
		);

		expect(values[PROPERTY_KEYS.maxPlayers]).toBeUndefined();
		expect(values[PROPERTY_KEYS.difficulty]).toBeUndefined();
	});

	it("seeds a default only when the key is absent entirely", () => {
		const values = seedValues({}, 19_132, BLOCK, ADDRESS);

		expect(values[PROPERTY_KEYS.maxPlayers]).toBe("10");
		expect(values[PROPERTY_KEYS.gamemode]).toBe("survival");
	});

	it("writes booleans the way bedrock reads them, never as 1 and 0", () => {
		const values = seedValues({}, 19_132, BLOCK, ADDRESS);

		expect(values[PROPERTY_KEYS.onlineMode]).toBe("true");
		expect(values[PROPERTY_KEYS.allowList]).toBe("false");
	});

	it("turns the allowlist off when the key is absent, so an empty list cannot lock the owner out", () => {
		expect(seedValues({}, 19_132, BLOCK, ADDRESS)[PROPERTY_KEYS.allowList]).toBe("false");
	});

	it("renames the shipped level so no path carries the space in 'Bedrock level'", () => {
		expect(seedValues({}, 19_132, BLOCK, ADDRESS)[PROPERTY_KEYS.levelName]).toBe(DEFAULT_LEVEL_NAME);
	});

	it("never overrides an allowlist or a level name the player already chose", () => {
		const values = seedValues(
			{
				[PROPERTY_KEYS.allowList]: "true",
				[PROPERTY_KEYS.levelName]: "survival",
			},
			19_132,
			BLOCK,
			ADDRESS,
		);

		expect(values[PROPERTY_KEYS.allowList]).toBeUndefined();
		expect(values[PROPERTY_KEYS.levelName]).toBeUndefined();
	});

	it("seeds them again after a reset, which wipes the config but keeps the install stamp", () => {
		const values = seedValues({}, 19_132, BLOCK, ADDRESS);

		expect(values[PROPERTY_KEYS.allowList]).toBe("false");
		expect(values[PROPERTY_KEYS.levelName]).toBe(DEFAULT_LEVEL_NAME);
	});

	it("keeps the content log off, because it is enormous and the console is the log", () => {
		const values = seedValues(
			{
				[PROPERTY_KEYS.contentLogFileEnabled]: "true",
			},
			19_132,
			BLOCK,
			ADDRESS,
		);

		expect(values[PROPERTY_KEYS.contentLogFileEnabled]).toBe("false");
	});

	it("saves a server identity key before the first start, so players accept the server once", async () => {
		const run = seeding({}, "1.26.60.6", [
			SERVER_IDENTITY_KEY_FILE,
		]);

		await seedConfig(run.context);

		expect(run.written).toEqual([
			SERVER_IDENTITY_KEY_FILE,
		]);
	});

	it("keeps lan visibility on, because bedrock stops advertising itself to players without it", () => {
		const values = seedValues(
			{
				[PROPERTY_KEYS.enableLanVisibility]: "false",
			},
			19_132,
			BLOCK,
			ADDRESS,
		);

		expect(values[PROPERTY_KEYS.enableLanVisibility]).toBe("true");
	});
});

describe("seeding the nethernet transport", () => {
	it("seeds nethernet when the file carries no transport", () => {
		expect(seedValues({}, 19_132, BLOCK, ADDRESS)[PROPERTY_KEYS.transport]).toBe(BedrockTransport.NetherNet);
	});

	it("keeps a transport the owner already chose, so a switch back to raknet survives every boot", () => {
		const values = seedValues(
			{
				[PROPERTY_KEYS.transport]: BedrockTransport.RakNet,
			},
			19_132,
			BLOCK,
			ADDRESS,
		);

		expect(values[PROPERTY_KEYS.transport]).toBeUndefined();
	});

	it("maps the media block onto the public address, one host port per container port", () => {
		expect(seedValues({}, 19_132, BLOCK, ADDRESS)[PROPERTY_KEYS.serverUdpPorts]).toBe(
			"203.0.113.7:20000-20063:20000-20063",
		);
	});

	it("rewrites the media block on every boot, because the platform may move it", () => {
		const values = seedValues(
			{
				[PROPERTY_KEYS.serverUdpPorts]: ":20000-20063:20000-20063",
			},
			19_132,
			{
				first: 20_064,
				count: 64,
			},
			ADDRESS,
		);

		expect(values[PROPERTY_KEYS.serverUdpPorts]).toBe("203.0.113.7:20064-20127:20064-20127");
	});

	it("leaves the address empty when the machine has none published", () => {
		expect(seedValues({}, 19_132, BLOCK, null)[PROPERTY_KEYS.serverUdpPorts]).toBe(":20000-20063:20000-20063");
	});

	it("leaves the address empty for a loopback address, which no player can reach", () => {
		expect(seedValues({}, 19_132, BLOCK, "127.0.0.1")[PROPERTY_KEYS.serverUdpPorts]).toBe(":20000-20063:20000-20063");
	});

	it("leaves the address empty for a hostname, which the property does not accept", () => {
		expect(seedValues({}, 19_132, BLOCK, "play.serverk.gg")[PROPERTY_KEYS.serverUdpPorts]).toBe(
			":20000-20063:20000-20063",
		);
	});

	it("reseeds nethernet when the transport is present but blank", () => {
		expect(
			seedValues(
				{
					[PROPERTY_KEYS.transport]: " ",
				},
				19_132,
				BLOCK,
				ADDRESS,
			)[PROPERTY_KEYS.transport],
		).toBe(BedrockTransport.NetherNet);
	});

	it("leaves the address empty for the unspecified address, which names no machine", () => {
		expect(seedValues({}, 19_132, BLOCK, "0.0.0.0")[PROPERTY_KEYS.serverUdpPorts]).toBe(":20000-20063:20000-20063");
	});

	it("leaves the address empty for an ipv6 address, which the colon-separated property cannot carry", () => {
		expect(seedValues({}, 19_132, BLOCK, "2001:db8::1")[PROPERTY_KEYS.serverUdpPorts]).toBe(":20000-20063:20000-20063");
	});
});

describe("ending raknet at 1.26.60, which removed it", () => {
	const raknet = {
		[PROPERTY_KEYS.transport]: BedrockTransport.RakNet,
	};

	it("keeps raknet on a 1.26.52 build, which still speaks it", () => {
		expect(seedValues(raknet, 19_132, BLOCK, ADDRESS, "1.26.52.3")[PROPERTY_KEYS.transport]).toBeUndefined();
	});

	it("rewrites raknet to nethernet on a 1.26.60 build", () => {
		expect(seedValues(raknet, 19_132, BLOCK, ADDRESS, "1.26.60.1")[PROPERTY_KEYS.transport]).toBe(
			BedrockTransport.NetherNet,
		);
	});

	it("compares the build by number, so 1.26.100 counts as newer than 1.26.60", () => {
		expect(seedValues(raknet, 19_132, BLOCK, ADDRESS, "1.26.100.2")[PROPERTY_KEYS.transport]).toBe(
			BedrockTransport.NetherNet,
		);
	});

	it("logs one line when a boot moves a raknet server onto nethernet", async () => {
		const run = seeding(raknet, "1.26.60.1");

		await seedConfig(run.context);

		expect(run.merged.at(0)?.[PROPERTY_KEYS.transport]).toBe(BedrockTransport.NetherNet);
		expect(run.logs).toEqual([
			"moved the transport from raknet to nethernet, because minecraft removed raknet in 1.26.60",
		]);
	});

	it("logs nothing for a server already on nethernet", async () => {
		const run = seeding(
			{
				[PROPERTY_KEYS.transport]: BedrockTransport.NetherNet,
			},
			"1.26.60.1",
		);

		await seedConfig(run.context);

		expect(run.merged.at(0)?.[PROPERTY_KEYS.transport]).toBe(BedrockTransport.NetherNet);
		expect(run.logs).toEqual([]);
	});

	it("leaves a raknet server alone on a 1.26.52 build and logs nothing", async () => {
		const run = seeding(raknet, "1.26.52.3");

		await seedConfig(run.context);

		expect(run.merged.at(0)?.[PROPERTY_KEYS.transport]).toBeUndefined();
		expect(run.logs).toEqual([]);
	});
});
