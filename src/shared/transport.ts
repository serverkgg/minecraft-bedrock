export enum BedrockTransport {
	NetherNet = "nethernet",
	RakNet = "raknet",
}

const TRANSPORTS = new Set<string>(Object.values(BedrockTransport));

export const transportFrom = (declared: string | undefined): BedrockTransport => {
	const value = (declared ?? "").trim().toLowerCase();

	return TRANSPORTS.has(value) ? (value as BedrockTransport) : BedrockTransport.NetherNet;
};
