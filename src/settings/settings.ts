import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { type InstallStamp, readInstallStamp } from "../install";
import {
	BedrockTransport,
	BOOLEAN_KEYS,
	booleanOf,
	flagOf,
	mergeProperties,
	NUMBER_KEYS,
	PROPERTY_KEYS,
	raknetRemoved,
	readProperties,
	transportFrom,
} from "../shared";

export const SETTINGS_KEYS: string[] = [
	PROPERTY_KEYS.allowCheats,
	PROPERTY_KEYS.allowList,
	PROPERTY_KEYS.chatRestriction,
	PROPERTY_KEYS.clientSideChunkGeneration,
	PROPERTY_KEYS.defaultPlayerPermissionLevel,
	PROPERTY_KEYS.difficulty,
	PROPERTY_KEYS.disableCustomSkins,
	PROPERTY_KEYS.disablePersona,
	PROPERTY_KEYS.disablePlayerInteraction,
	PROPERTY_KEYS.forceGamemode,
	PROPERTY_KEYS.gamemode,
	PROPERTY_KEYS.levelSeed,
	PROPERTY_KEYS.maxPlayers,
	PROPERTY_KEYS.maxThreads,
	PROPERTY_KEYS.onlineMode,
	PROPERTY_KEYS.playerIdleTimeout,
	PROPERTY_KEYS.serverName,
	PROPERTY_KEYS.texturepackRequired,
	PROPERTY_KEYS.tickDistance,
	PROPERTY_KEYS.transport,
	PROPERTY_KEYS.viewDistance,
];

export const readSettings = (properties: Record<string, string>): Bridge.Values => {
	const values: Bridge.Values = {};

	for (const key of SETTINGS_KEYS) {
		const raw = properties[key] ?? "";

		if (BOOLEAN_KEYS.includes(key)) {
			values[key] = booleanOf(raw);

			continue;
		}

		if (NUMBER_KEYS.includes(key)) {
			const parsed = Number(raw);

			values[key] = Number.isFinite(parsed) && raw.trim().length > 0 ? parsed : null;

			continue;
		}

		values[key] = raw;
	}

	return values;
};

export const writeSettings = (values: Bridge.Values): Record<string, string> => {
	const properties: Record<string, string> = {};

	for (const key of SETTINGS_KEYS) {
		if (!Object.hasOwn(values, key)) {
			continue;
		}

		const value = values[key] ?? null;

		if (BOOLEAN_KEYS.includes(key)) {
			properties[key] = flagOf(value);

			continue;
		}

		properties[key] = value === null ? "" : String(value);
	}

	return properties;
};

export const refuseRemovedTransport = (properties: Record<string, string>, stamp: InstallStamp | null) => {
	if (
		stamp === null
		|| !Object.hasOwn(properties, PROPERTY_KEYS.transport)
		|| transportFrom(properties[PROPERTY_KEYS.transport]) !== BedrockTransport.RakNet
		|| !raknetRemoved(stamp.version)
	) {
		return;
	}

	throw new BridgeUserError({
		ar: `أزالت Mojang طريقة RakNet في الإصدار 1.26.60، وسيرفرك على الإصدار ${stamp.label}. اترك طريقة الاتصال على NetherNet.`,
		en: `Mojang removed RakNet in 1.26.60, and your server is on ${stamp.label}. Keep the connection transport on NetherNet.`,
	});
};

export const settings: Bridge.Settings = {
	kind: BridgeKind.Settings,

	async read(context) {
		return readSettings(await readProperties(context));
	},

	async write(context, values) {
		const properties = writeSettings(values);

		refuseRemovedTransport(properties, await readInstallStamp(context));

		await mergeProperties(context, properties);
	},
};
