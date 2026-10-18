import { compareVersion, versionParts } from "./version";

export enum BedrockTransport {
	NetherNet = "nethernet",
	RakNet = "raknet",
}

export const RAKNET_REMOVED_BUILD = [
	1,
	26,
	60,
];

const TRANSPORTS = new Set<string>(Object.values(BedrockTransport));

export const transportFrom = (declared: string | undefined): BedrockTransport => {
	const value = (declared ?? "").trim().toLowerCase();

	return TRANSPORTS.has(value) ? (value as BedrockTransport) : BedrockTransport.NetherNet;
};

export const raknetRemoved = (build: string | null) =>
	build !== null && compareVersion(versionParts(build), RAKNET_REMOVED_BUILD) >= 0;
