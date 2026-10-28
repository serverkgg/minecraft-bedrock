import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { createRosterSync } from "@serverkgg/bridge/presence";
import {
	type BedrockPlayer,
	BedrockTransport,
	listeningOn,
	PROPERTY_KEYS,
	presenceOf,
	readProperties,
	readTcpSockets,
	roster,
	sampleRoster,
	transportFrom,
	watchRoster,
} from "../shared";

const REFRESH_SECONDS = 20;

const RECONCILE_EVERY = 3;

const maxOf = (properties: Record<string, string>) => {
	const raw = (properties[PROPERTY_KEYS.maxPlayers] ?? "").trim();
	const parsed = Number(raw);

	return raw.length > 0 && Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const reasonOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const createQuery = (): Bridge.Query => {
	const sync = createRosterSync<BedrockPlayer>({
		id: (player) => player.id,
		presenceOf,
	});
	let samples = 0;
	let warned = false;

	const unreachable = (context: Bridge.Context, error: unknown) => {
		if (warned) {
			return;
		}

		warned = true;
		context.log.warn("bedrock answered neither the nethernet nor the raknet probe, counting the roster off the log", {
			reason: reasonOf(error),
		});
	};

	const reconcile = async (context: Bridge.Context) => {
		try {
			await sampleRoster(context);
		} catch (error) {
			context.log.warn("bedrock did not answer list, keeping the roster from the log", {
				reason: reasonOf(error),
			});
		}
	};

	const fromRoster = (context: Bridge.Context, max: number | null): Bridge.Sample => {
		sync.sync(context, roster.all());

		return {
			online: roster.all().length,
			max,
		};
	};

	const sampleRakNet = async (context: Bridge.Context, max: number | null): Promise<Bridge.Sample> => {
		let pong: Awaited<ReturnType<Bridge.Context["probe"]["raknetPing"]>>;

		try {
			pong = await context.probe.raknetPing(context.port("game"));
		} catch (error) {
			unreachable(context, error);

			return fromRoster(context, max);
		}

		warned = false;

		if (roster.all().length !== pong.players.online) {
			await reconcile(context);
		}

		sync.sync(context, roster.all());

		return {
			online: pong.players.online,
			max: pong.players.max,
		};
	};

	const listening = async (context: Bridge.Context) => {
		try {
			return listeningOn(await readTcpSockets(context), context.port("game"));
		} catch {
			return false;
		}
	};

	const sampleNetherNet = async (context: Bridge.Context, max: number | null): Promise<Bridge.Sample> => {
		if (!(await listening(context))) {
			return await sampleRakNet(context, max);
		}

		warned = false;
		samples++;

		if (samples % RECONCILE_EVERY === 0 && roster.all().length > 0) {
			await reconcile(context);
		}

		return fromRoster(context, max);
	};

	return {
		kind: BridgeKind.Query,
		refreshSeconds: REFRESH_SECONDS,

		async sample(context) {
			watchRoster(context);

			const properties = await readProperties(context);
			const max = maxOf(properties);

			if (transportFrom(properties[PROPERTY_KEYS.transport]) === BedrockTransport.RakNet) {
				return await sampleRakNet(context, max);
			}

			return await sampleNetherNet(context, max);
		},
	};
};

export const query = createQuery();
