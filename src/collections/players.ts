import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { activityExcerpt, BridgeEventName } from "@serverkgg/bridge/protocol";
import { GAME_MODES, kickCommand, optionText, quoted, roster, sampleRoster, sanitizeMessage, send } from "../shared";

const REFRESH_SECONDS = 20;

const DEFAULT_KICK_REASON = "Kicked by an operator";

const textOf = (args: Bridge.Values, key: string, fallback: string) => {
	const value = args[key];

	return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
};

const givenText = (args: Bridge.Values, key: string) => {
	const value = args[key];

	return typeof value === "string" ? sanitizeMessage(value) : "";
};

export const playerDetails = (row: Bridge.Row): Bridge.Values => {
	const xuid = String(row.xuid ?? "");

	return xuid.length === 0
		? {
				player: String(row.name),
			}
		: {
				player: String(row.name),
				xuid,
			};
};

const onlineAtAction = (row: Bridge.Row) => {
	const xuid = String(row.xuid ?? "");

	return (xuid.length > 0 && roster.online(xuid)) || roster.online(String(row.name));
};

export const players: Bridge.Collection = {
	kind: BridgeKind.Collection,
	requiresRunning: true,
	refreshSeconds: REFRESH_SECONDS,

	async list(context) {
		await sampleRoster(context);

		return roster.all().map((player) => ({
			id: player.id,
			name: player.name,
			xuid: player.xuid,
		}));
	},

	actions: {
		async kick(context, row, args) {
			const reason = textOf(args, "reason", DEFAULT_KICK_REASON);
			const online = onlineAtAction(row);

			await send(context, kickCommand(row.xuid === "" ? String(row.name) : String(row.xuid), reason));

			context.emit(BridgeEventName.PlayerKicked, {
				player: String(row.name),
				reason,
			});

			const given = givenText(args, "reason");
			const player = String(row.name);

			if (!online) {
				return;
			}

			if (given.length === 0) {
				context.activity.report({
					name: BridgeEventName.PlayerKicked,
					text: {
						ar: `تم طرد ${player}`,
						en: `Kicked ${player}`,
					},
					subject: player,
					details: playerDetails(row),
				});

				return;
			}

			const excerpt = activityExcerpt(given);

			context.activity.report({
				name: BridgeEventName.PlayerKicked,
				text: {
					ar: `تم طرد ${player}، السبب: «${excerpt}»`,
					en: `Kicked ${player}, reason: "${excerpt}"`,
				},
				subject: player,
				details: {
					...playerDetails(row),
					reason: excerpt,
				},
			});
		},

		async op(context, row) {
			const player = String(row.name);
			const online = onlineAtAction(row);

			await send(context, `op ${quoted(player)}`);

			if (!online) {
				return;
			}

			context.activity.report({
				name: BridgeEventName.AccessGranted,
				text: {
					ar: `تمت إضافة ${player} لقائمة الأوبريتر`,
					en: `Added ${player} to the operator list`,
				},
				subject: player,
				details: {
					...playerDetails(row),
					list: "operators",
				},
			});
		},

		async deop(context, row) {
			const player = String(row.name);
			const online = onlineAtAction(row);

			await send(context, `deop ${quoted(player)}`);

			if (!online) {
				return;
			}

			context.activity.report({
				name: BridgeEventName.AccessRevoked,
				text: {
					ar: `تمت إزالة ${player} من قائمة الأوبريتر`,
					en: `Removed ${player} from the operator list`,
				},
				subject: player,
				details: {
					...playerDetails(row),
					list: "operators",
				},
			});
		},

		async gamemode(context, row, args) {
			const mode = textOf(args, "mode", "survival");
			const online = onlineAtAction(row);

			await send(context, `gamemode ${mode} ${quoted(String(row.name))}`);

			context.emit(BridgeEventName.GameModeChanged, {
				player: String(row.name),
				mode,
			});

			if (!online) {
				return;
			}

			const player = String(row.name);
			const label = optionText(GAME_MODES, mode);

			context.activity.report({
				name: BridgeEventName.PlayerChanged,
				text: {
					ar: `تم تغيير وضع اللعب لـ ${player} إلى ${label.ar}`,
					en: `Set ${player}'s game mode to ${label.en}`,
				},
				subject: player,
				details: {
					...playerDetails(row),
					mode,
				},
			});
		},

		async kill(context, row) {
			const player = String(row.name);
			const online = onlineAtAction(row);

			await send(context, `kill ${quoted(player)}`);

			if (!online) {
				return;
			}

			context.activity.report({
				name: BridgeEventName.PlayerChanged,
				text: {
					ar: `تم قتل ${player} داخل اللعبة`,
					en: `Killed ${player} in game`,
				},
				subject: player,
				details: {
					...playerDetails(row),
					action: "kill",
				},
			});
		},
	},
};
