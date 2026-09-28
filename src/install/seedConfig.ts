import type { Bridge, BridgePortBlock } from "@serverkgg/bridge";
import {
	ALLOWLIST_FILE,
	BEHAVIOR_PACKS_DIRECTORY,
	BedrockTransport,
	mergeProperties,
	PERMISSIONS_FILE,
	PROPERTY_KEYS,
	RESOURCE_PACKS_DIRECTORY,
	readProperties,
	WORLDS_DIRECTORY,
} from "../shared";

export const DEFAULT_LEVEL_NAME = "world";

const DEFAULTS: Record<string, string> = {
	[PROPERTY_KEYS.contentLogConsoleOutputEnabled]: "true",
	[PROPERTY_KEYS.allowCheats]: "false",
	[PROPERTY_KEYS.allowList]: "false",
	[PROPERTY_KEYS.chatRestriction]: "None",
	[PROPERTY_KEYS.clientSideChunkGeneration]: "true",
	[PROPERTY_KEYS.defaultPlayerPermissionLevel]: "member",
	[PROPERTY_KEYS.difficulty]: "easy",
	[PROPERTY_KEYS.disablePlayerInteraction]: "false",
	[PROPERTY_KEYS.forceGamemode]: "false",
	[PROPERTY_KEYS.gamemode]: "survival",
	[PROPERTY_KEYS.levelName]: DEFAULT_LEVEL_NAME,
	[PROPERTY_KEYS.levelSeed]: "",
	[PROPERTY_KEYS.maxPlayers]: "10",
	[PROPERTY_KEYS.maxThreads]: "8",
	[PROPERTY_KEYS.onlineMode]: "true",
	[PROPERTY_KEYS.playerIdleTimeout]: "30",
	[PROPERTY_KEYS.serverName]: "Serverk",
	[PROPERTY_KEYS.texturepackRequired]: "false",
	[PROPERTY_KEYS.tickDistance]: "4",
	[PROPERTY_KEYS.viewDistance]: "32",
};

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

const LOOPBACK_OCTET = 127;

const UNSPECIFIED = "0.0.0.0";

const OCTET_MAX = 255;

const udpAddressOf = (publicAddress: string | null) => {
	const octets = (IPV4.exec(publicAddress?.trim() ?? "") ?? []).slice(1).map(Number);

	if (octets.length === 0 || octets.some((octet) => octet > OCTET_MAX) || octets.at(0) === LOOPBACK_OCTET) {
		return "";
	}

	const address = octets.join(".");

	return address === UNSPECIFIED ? "" : address;
};

const udpPortsOf = (block: BridgePortBlock, publicAddress: string | null) => {
	const range = `${block.first}-${block.first + block.count - 1}`;

	return `${udpAddressOf(publicAddress)}:${range}:${range}`;
};

export const seedValues = (
	current: Record<string, string>,
	port: number,
	block: BridgePortBlock,
	publicAddress: string | null,
) => {
	const values: Record<string, string> = {
		[PROPERTY_KEYS.contentLogFileEnabled]: "false",
		[PROPERTY_KEYS.enableLanVisibility]: "true",
		[PROPERTY_KEYS.serverPort]: String(port),
		[PROPERTY_KEYS.serverPortV6]: String(port + 1),
		[PROPERTY_KEYS.serverUdpPorts]: udpPortsOf(block, publicAddress),
	};

	if ((current[PROPERTY_KEYS.transport] ?? "").trim().length === 0) {
		values[PROPERTY_KEYS.transport] = BedrockTransport.NetherNet;
	}

	for (const [key, value] of Object.entries(DEFAULTS)) {
		if (!Object.hasOwn(current, key)) {
			values[key] = value;
		}
	}

	return values;
};

export const seedConfig = async (context: Bridge.Context) => {
	await context.files.ensure(WORLDS_DIRECTORY, BEHAVIOR_PACKS_DIRECTORY, RESOURCE_PACKS_DIRECTORY);

	for (const file of [
		ALLOWLIST_FILE,
		PERMISSIONS_FILE,
	]) {
		if (!(await context.files.exists(file))) {
			await context.files.write(file, "[]\n");
		}
	}

	await mergeProperties(
		context,
		seedValues(
			await readProperties(context),
			context.port("game"),
			context.portBlock("media"),
			context.server.publicAddress,
		),
	);
};
