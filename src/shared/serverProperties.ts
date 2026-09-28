import type { Bridge } from "@serverkgg/bridge";
import { CONFIG_FILE } from "./paths";

export const PROPERTY_KEYS = {
	allowCheats: "allow-cheats",
	allowList: "allow-list",
	chatRestriction: "chat-restriction",
	clientSideChunkGeneration: "client-side-chunk-generation-enabled",
	contentLogConsoleOutputEnabled: "content-log-console-output-enabled",
	contentLogFileEnabled: "content-log-file-enabled",
	defaultPlayerPermissionLevel: "default-player-permission-level",
	difficulty: "difficulty",
	disableCustomSkins: "disable-custom-skins",
	disablePersona: "disable-persona",
	disablePlayerInteraction: "disable-player-interaction",
	enableLanVisibility: "enable-lan-visibility",
	forceGamemode: "force-gamemode",
	gamemode: "gamemode",
	levelName: "level-name",
	levelSeed: "level-seed",
	maxPlayers: "max-players",
	maxThreads: "max-threads",
	onlineMode: "online-mode",
	playerIdleTimeout: "player-idle-timeout",
	serverName: "server-name",
	serverPort: "server-port",
	serverPortV6: "server-portv6",
	serverUdpPorts: "server-udp-ports",
	texturepackRequired: "texturepack-required",
	tickDistance: "tick-distance",
	transport: "transport",
	viewDistance: "view-distance",
} as const;

export const BOOLEAN_KEYS: string[] = [
	PROPERTY_KEYS.allowCheats,
	PROPERTY_KEYS.allowList,
	PROPERTY_KEYS.clientSideChunkGeneration,
	PROPERTY_KEYS.contentLogFileEnabled,
	PROPERTY_KEYS.contentLogConsoleOutputEnabled,
	PROPERTY_KEYS.disableCustomSkins,
	PROPERTY_KEYS.disablePersona,
	PROPERTY_KEYS.disablePlayerInteraction,
	PROPERTY_KEYS.forceGamemode,
	PROPERTY_KEYS.onlineMode,
	PROPERTY_KEYS.texturepackRequired,
];

export const NUMBER_KEYS: string[] = [
	PROPERTY_KEYS.maxPlayers,
	PROPERTY_KEYS.maxThreads,
	PROPERTY_KEYS.playerIdleTimeout,
	PROPERTY_KEYS.serverPort,
	PROPERTY_KEYS.serverPortV6,
	PROPERTY_KEYS.tickDistance,
	PROPERTY_KEYS.viewDistance,
];

export const readProperties = async (context: Bridge.Context): Promise<Record<string, string>> => {
	const values = await context.codec.properties.read(CONFIG_FILE);
	const properties: Record<string, string> = {};

	for (const [key, value] of Object.entries(values)) {
		properties[key] = value === null ? "" : String(value);
	}

	return properties;
};

export const mergeProperties = async (context: Bridge.Context, values: Record<string, string>) => {
	await context.codec.properties.merge(CONFIG_FILE, values);
};

export const booleanOf = (value: string | undefined) => {
	return (value ?? "").trim().toLowerCase() === "true";
};

export const flagOf = (value: Bridge.Value) => {
	if (typeof value === "boolean") {
		return value ? "true" : "false";
	}

	return booleanOf(String(value ?? "")) ? "true" : "false";
};
