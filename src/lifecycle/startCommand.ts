import { SERVER_BINARY, SOCKET_TABLES, TCP_LISTEN } from "../shared";

export const JOIN_PORT_WAIT_SECONDS = 75;

export const START_SCRIPT = [
	'port="$1"',
	'seconds="$2"',
	"shift 2",
	'suffix=":$(printf "%04X" "$port")"',
	"lingering() {",
	`\tcat "$@" 2>/dev/null | awk -v suffix="$suffix" 'substr($2, length($2) - 4) == suffix && $4 != "${TCP_LISTEN}" { found = 1 } END { exit found ? 0 : 1 }'`,
	"}",
	"waited=0",
	'if lingering "$@"; then',
	'\techo "Waiting up to $seconds seconds for port $port to close its last connections, because Bedrock cannot listen on it until they do"',
	'\twhile [ "$waited" -lt "$seconds" ] && lingering "$@"; do',
	"\t\tsleep 1",
	"\t\twaited=$((waited + 1))",
	"\tdone",
	"fi",
	`exec ./${SERVER_BINARY}`,
].join("\n");

export const startCommand = (port: number, seconds = JOIN_PORT_WAIT_SECONDS, tables = SOCKET_TABLES) => [
	"sh",
	"-c",
	START_SCRIPT,
	SERVER_BINARY,
	String(port),
	String(seconds),
	...tables,
];
