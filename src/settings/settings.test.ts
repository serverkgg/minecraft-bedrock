import { describe, expect, it } from "bun:test";
import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { type InstallStamp, ReleaseChannel } from "../install";
import { BedrockTransport, PROPERTY_KEYS } from "../shared";
import { readSettings, refuseRemovedTransport, SETTINGS_KEYS, settings, writeSettings } from "./settings";

const stampOf = (version: string): InstallStamp => ({
	channel: ReleaseChannel.Release,
	version,
	label: version,
	files: [],
	packs: [],
});

const raknet = {
	[PROPERTY_KEYS.transport]: BedrockTransport.RakNet,
};

describe("reading the settings form out of server.properties", () => {
	it("answers every declared key even for a file that carries none of them", () => {
		const values = readSettings({});

		for (const key of SETTINGS_KEYS) {
			expect(Object.hasOwn(values, key)).toBe(true);
		}
	});

	it("reads bedrock's true and false strings as booleans", () => {
		const values = readSettings({
			[PROPERTY_KEYS.allowCheats]: "true",
			[PROPERTY_KEYS.onlineMode]: "false",
		});

		expect(values[PROPERTY_KEYS.allowCheats]).toBe(true);
		expect(values[PROPERTY_KEYS.onlineMode]).toBe(false);
	});

	it("answers null for a number the file does not carry, rather than zero", () => {
		expect(readSettings({})[PROPERTY_KEYS.maxPlayers]).toBeNull();
		expect(
			readSettings({
				[PROPERTY_KEYS.maxPlayers]: "40",
			})[PROPERTY_KEYS.maxPlayers],
		).toBe(40);
	});

	it("reads the transport as the string bedrock wrote", () => {
		expect(
			readSettings({
				[PROPERTY_KEYS.transport]: BedrockTransport.RakNet,
			})[PROPERTY_KEYS.transport],
		).toBe(BedrockTransport.RakNet);
	});
});

describe("writing the settings form back", () => {
	it("refuses a key the form does not own, so the port cannot be rewritten", () => {
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

	it("writes booleans the way bedrock reads them, never as 1 and 0", () => {
		const properties = writeSettings({
			[PROPERTY_KEYS.allowList]: true,
			[PROPERTY_KEYS.allowCheats]: false,
		});

		expect(properties[PROPERTY_KEYS.allowList]).toBe("true");
		expect(properties[PROPERTY_KEYS.allowCheats]).toBe("false");
	});

	it("leaves out a key the form did not submit, so a partial save cannot blank the rest", () => {
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

	it("writes the transport the owner picked", () => {
		expect(
			writeSettings({
				[PROPERTY_KEYS.transport]: BedrockTransport.NetherNet,
			})[PROPERTY_KEYS.transport],
		).toBe(BedrockTransport.NetherNet);
	});
});

describe("refusing raknet on a build that removed it", () => {
	it("lets a 1.26.52 server switch to raknet, which it still speaks", () => {
		expect(() => refuseRemovedTransport(raknet, stampOf("1.26.52.3"))).not.toThrow();
	});

	it("refuses raknet on a 1.26.60 server and names the build it runs", () => {
		expect(() => refuseRemovedTransport(raknet, stampOf("1.26.60.1"))).toThrow(BridgeUserError);
		expect(() => refuseRemovedTransport(raknet, stampOf("1.26.60.1"))).toThrow(/1\.26\.60\.1/);
	});

	it("refuses raknet on a build past 1.26.60 that a string compare would call older", () => {
		expect(() => refuseRemovedTransport(raknet, stampOf("1.26.100.2"))).toThrow(BridgeUserError);
	});

	it("lets a 1.26.60 server save nethernet or a form that leaves the transport out", () => {
		expect(() =>
			refuseRemovedTransport(
				{
					[PROPERTY_KEYS.transport]: BedrockTransport.NetherNet,
				},
				stampOf("1.26.60.1"),
			),
		).not.toThrow();
		expect(() =>
			refuseRemovedTransport(
				{
					[PROPERTY_KEYS.maxPlayers]: "20",
				},
				stampOf("1.26.60.1"),
			),
		).not.toThrow();
	});

	it("does not refuse before a build is installed, when there is no build to judge", () => {
		expect(() => refuseRemovedTransport(raknet, null)).not.toThrow();
	});

	it("writes nothing when the form asks a 1.26.60 server for raknet", async () => {
		const merged: Record<string, string>[] = [];
		const context = {
			files: {
				exists: async () => true,
				read: async () => JSON.stringify(stampOf("1.26.60.1")),
			},
			codec: {
				properties: {
					merge: async (_file: string, values: Record<string, string>) => {
						merged.push(values);
					},
				},
			},
		} as unknown as Bridge.Context;

		await expect(settings.write?.(context, raknet)).rejects.toThrow(BridgeUserError);
		expect(merged).toEqual([]);
	});
});
