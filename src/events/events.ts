import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { SERVER_CRASHED, SERVER_STARTED, WORLD_SAVED } from "../shared";

const PORT_BIND_FAILED =
	/Port \[\d+\] may be in use by another process|failed to bind to port|address already in use|unable to bind/i;

const WORLD_CORRUPT = /Corruption:|Level is corrupt|IO error:.*\.ldb/;

export const events: Bridge.Events = {
	kind: BridgeKind.Events,
	patterns: [
		{
			match: SERVER_STARTED,
			emit: BridgeEventName.ServerStarted,
		},
		{
			match: WORLD_SAVED,
			emit: BridgeEventName.WorldSaved,
		},
		{
			match: SERVER_CRASHED,
			emit: BridgeEventName.ServerCrashed,
		},
		{
			match: PORT_BIND_FAILED,
			emit: BridgeEventName.PortBindFailed,
		},
		{
			match: WORLD_CORRUPT,
			emit: BridgeEventName.WorldCorrupt,
		},
	],
	emits: [
		BridgeEventName.PlayerJoined,
		BridgeEventName.PlayerLeft,
		BridgeEventName.PlayerKicked,
		BridgeEventName.ServerStopping,
		BridgeEventName.ServerUpdated,
	],
};
