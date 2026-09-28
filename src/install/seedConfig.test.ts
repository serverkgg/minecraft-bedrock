import { describe, expect, test } from "bun:test";
import { BedrockTransport, PROPERTY_KEYS } from "../shared";
import { DEFAULT_LEVEL_NAME, seedValues } from "./seedConfig";

const BLOCK = {
	first: 20_000,
	count: 64,
};

const ADDRESS = "203.0.113.7";

describe("seeding server.properties", () => {
	test("forces the port onto whatever the platform allocated, overwriting what is already there", () => {
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

	test("binds the v6 port one above the game port, so a raknet server never collides with a mirrored 19133", () => {
		expect(seedValues({}, 19_140, BLOCK, ADDRESS)[PROPERTY_KEYS.serverPortV6]).toBe("19141");
	});

	test("leaves a value the player already set, so their settings survive every boot", () => {
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

	test("seeds a default only when the key is absent entirely", () => {
		const values = seedValues({}, 19_132, BLOCK, ADDRESS);

		expect(values[PROPERTY_KEYS.maxPlayers]).toBe("10");
		expect(values[PROPERTY_KEYS.gamemode]).toBe("survival");
	});

	test("writes booleans the way bedrock reads them, never as 1 and 0", () => {
		const values = seedValues({}, 19_132, BLOCK, ADDRESS);

		expect(values[PROPERTY_KEYS.onlineMode]).toBe("true");
		expect(values[PROPERTY_KEYS.allowList]).toBe("false");
	});

	test("turns the allowlist off when the key is absent, so an empty list cannot lock the owner out", () => {
		expect(seedValues({}, 19_132, BLOCK, ADDRESS)[PROPERTY_KEYS.allowList]).toBe("false");
	});

	test("renames the shipped level so no path carries the space in 'Bedrock level'", () => {
		expect(seedValues({}, 19_132, BLOCK, ADDRESS)[PROPERTY_KEYS.levelName]).toBe(DEFAULT_LEVEL_NAME);
	});

	test("never overrides an allowlist or a level name the player already chose", () => {
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

	test("seeds them again after a reset, which wipes the config but keeps the install stamp", () => {
		const values = seedValues({}, 19_132, BLOCK, ADDRESS);

		expect(values[PROPERTY_KEYS.allowList]).toBe("false");
		expect(values[PROPERTY_KEYS.levelName]).toBe(DEFAULT_LEVEL_NAME);
	});

	test("keeps the content log off, because it is enormous and the console is the log", () => {
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

	test("keeps lan visibility on, because bedrock stops advertising itself to players without it", () => {
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
	test("seeds nethernet when the file carries no transport", () => {
		expect(seedValues({}, 19_132, BLOCK, ADDRESS)[PROPERTY_KEYS.transport]).toBe(BedrockTransport.NetherNet);
	});

	test("keeps a transport the owner already chose, so a switch back to raknet survives every boot", () => {
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

	test("maps the media block onto the public address, one host port per container port", () => {
		expect(seedValues({}, 19_132, BLOCK, ADDRESS)[PROPERTY_KEYS.serverUdpPorts]).toBe(
			"203.0.113.7:20000-20063:20000-20063",
		);
	});

	test("rewrites the media block on every boot, because the platform may move it", () => {
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

	test("leaves the address empty when the machine has none published", () => {
		expect(seedValues({}, 19_132, BLOCK, null)[PROPERTY_KEYS.serverUdpPorts]).toBe(":20000-20063:20000-20063");
	});

	test("leaves the address empty for a loopback address, which no player can reach", () => {
		expect(seedValues({}, 19_132, BLOCK, "127.0.0.1")[PROPERTY_KEYS.serverUdpPorts]).toBe(":20000-20063:20000-20063");
	});

	test("leaves the address empty for a hostname, which the property does not accept", () => {
		expect(seedValues({}, 19_132, BLOCK, "play.serverk.gg")[PROPERTY_KEYS.serverUdpPorts]).toBe(
			":20000-20063:20000-20063",
		);
	});

	test("reseeds nethernet when the transport is present but blank", () => {
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

	test("leaves the address empty for the unspecified address, which names no machine", () => {
		expect(seedValues({}, 19_132, BLOCK, "0.0.0.0")[PROPERTY_KEYS.serverUdpPorts]).toBe(":20000-20063:20000-20063");
	});

	test("leaves the address empty for an ipv6 address, which the colon-separated property cannot carry", () => {
		expect(seedValues({}, 19_132, BLOCK, "2001:db8::1")[PROPERTY_KEYS.serverUdpPorts]).toBe(":20000-20063:20000-20063");
	});
});
