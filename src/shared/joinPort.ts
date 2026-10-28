import type { Bridge } from "@serverkgg/bridge";

export const SOCKET_TABLES = [
	"/proc/net/tcp",
	"/proc/net/tcp6",
];

export const TCP_LISTEN = "0A";

export interface TcpSocket {
	port: number;
	state: string;
}

const HEX_PORT = /^[0-9A-F]{4}$/i;

export const tcpSocketsOf = (tables: string): TcpSocket[] =>
	tables.split("\n").flatMap((line) => {
		const fields = line.trim().split(/\s+/);
		const port = fields.at(1)?.split(":").at(-1) ?? "";
		const state = fields.at(3) ?? "";

		if (fields.at(0) === "sl" || !HEX_PORT.test(port) || state.length === 0) {
			return [];
		}

		return [
			{
				port: Number.parseInt(port, 16),
				state: state.toUpperCase(),
			},
		];
	});

export const readTcpSockets = async (context: Bridge.Context) => {
	const result = await context.exec([
		"cat",
		...SOCKET_TABLES,
	]);

	return tcpSocketsOf(result.stdout);
};

export const listeningOn = (sockets: TcpSocket[], port: number) =>
	sockets.some((socket) => socket.port === port && socket.state === TCP_LISTEN);
