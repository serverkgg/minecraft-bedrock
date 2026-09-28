import { describe, expect, test } from "bun:test";
import { BedrockTransport, PROPERTY_KEYS } from "../shared";
import { readSettings, SETTINGS_KEYS, writeSettings } from "./settings";

describe("reading the settings form out of server.properties", () => {
	test("answers every declared key even for a file that carries none of them", () => {
		const values = readSettings({});

		for (const key of SETTINGS_KEYS) {
			expect(Object.hasOwn(values, key)).toBe(true);
		}
	});

	test("reads bedrock's true and false strings as booleans", () => {
		const values = readSettings({
			[PROPERTY_KEYS.allowCheats]: "true",
			[PROPERTY_KEYS.onlineMode]: "false",
		});

		expect(values[PROPERTY_KEYS.allowCheats]).toBe(true);
		expect(values[PROPERTY_KEYS.onlineMode]).toBe(false);
	});

	test("answers null for a number the file does not carry, rather than zero", () => {
		expect(readSettings({})[PROPERTY_KEYS.maxPlayers]).toBeNull();
		expect(
			readSettings({
				[PROPERTY_KEYS.maxPlayers]: "40",
			})[PROPERTY_KEYS.maxPlayers],
		).toBe(40);
	});

	test("reads the transport as the string bedrock wrote", () => {
		expect(
			readSettings({
				[PROPERTY_KEYS.transport]: BedrockTransport.RakNet,
			})[PROPERTY_KEYS.transport],
		).toBe(BedrockTransport.RakNet);
	});
});

describe("writing the settings form back", () => {
	test("refuses a key the form does not own, so the port cannot be rewritten", () => {
		const properties = writeSettings({
			[PROPERTY_KEYS.serverPort]: 1234,
			[PROPERTY_KEYS.serverPortV6]: 1235,
			[PROPERTY_KEYS.levelName]: "somewhere-else",
			[PROPERTY_KEYS.contentLogFileEnabled]: true,
			[PROPERTY_KEYS.maxPlayers]: 20,
		});

		expect(properties[PROPERTY_KEYS.serverPort]).toBeUndefined();
		expect(properties[PROPERTY_KEYS.serverPortV6]).toBeUndefined();
		expect(properties[PROPERTY_KEYS.levelName]).toBeUndefined();
		expect(properties[PROPERTY_KEYS.contentLogFileEnabled]).toBeUndefined();
		expect(properties[PROPERTY_KEYS.maxPlayers]).toBe("20");
	});

	test("writes booleans the way bedrock reads them, never as 1 and 0", () => {
		const properties = writeSettings({
			[PROPERTY_KEYS.allowList]: true,
			[PROPERTY_KEYS.allowCheats]: false,
		});

		expect(properties[PROPERTY_KEYS.allowList]).toBe("true");
		expect(properties[PROPERTY_KEYS.allowCheats]).toBe("false");
	});

	test("leaves out a key the form did not submit, so a partial save cannot blank the rest", () => {
		expect(
			Object.keys(
				writeSettings({
					[PROPERTY_KEYS.difficulty]: "hard",
				}),
			),
		).toEqual([
			PROPERTY_KEYS.difficulty,
		]);
	});

	test("writes the transport the owner picked", () => {
		expect(
			writeSettings({
				[PROPERTY_KEYS.transport]: BedrockTransport.NetherNet,
			})[PROPERTY_KEYS.transport],
		).toBe(BedrockTransport.NetherNet);
	});
});
