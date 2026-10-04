import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import {
	knownPlayerOf,
	optionText,
	PERMISSION_LEVELS,
	PERMISSIONS_FILE,
	quoted,
	readJsonList,
	readKnownPlayers,
	roster,
	send,
	writeJsonList,
} from "../shared";

export enum PermissionLevel {
	Member = "member",
	Operator = "operator",
	Visitor = "visitor",
}

const LEVELS = new Set<string>(Object.values(PermissionLevel));

export interface PermissionEntry {
	permission: PermissionLevel;
	xuid: string;
}

interface RawEntry {
	permission?: unknown;
	xuid?: unknown;
}

export const normalizePermissions = (entries: unknown[]): PermissionEntry[] => {
	const listed: PermissionEntry[] = [];

	for (const entry of entries as RawEntry[]) {
		if (typeof entry?.xuid !== "string" || entry.xuid.length === 0) {
			continue;
		}

		const permission =
			typeof entry.permission === "string" && LEVELS.has(entry.permission)
				? (entry.permission as PermissionLevel)
				: PermissionLevel.Member;

		listed.push({
			permission,
			xuid: entry.xuid,
		});
	}

	return listed;
};

export const withPermission = (entries: PermissionEntry[], xuid: string, permission: PermissionLevel) => {
	const without = entries.filter((entry) => entry.xuid !== xuid);

	return [
		...without,
		{
			permission,
			xuid,
		},
	];
};

export const withoutPermission = (entries: PermissionEntry[], xuid: string) => {
	return entries.filter((entry) => entry.xuid !== xuid);
};

const readPermissions = async (context: Bridge.Context) => {
	return normalizePermissions(await readJsonList(context, PERMISSIONS_FILE));
};

const levelOf = (args: Bridge.Values) => {
	const value = args.level;

	return typeof value === "string" && LEVELS.has(value) ? (value as PermissionLevel) : PermissionLevel.Operator;
};

const operatorDetails = (xuid: string, level: string): Bridge.Values => {
	return xuid.length === 0
		? {
				list: "operators",
				level,
			}
		: {
				list: "operators",
				level,
				xuid,
			};
};

const displayOf = (row: Bridge.Row) => {
	const name = String(row.name ?? "");

	return name.length > 0 ? name : String(row.xuid);
};

const reportGranted = (context: Bridge.Context, player: string, xuid: string) => {
	context.activity.report({
		name: BridgeEventName.AccessGranted,
		text: {
			ar: `تمت إضافة ${player} إلى قائمة الأوبريتر`,
			en: `Added ${player} to the operator list`,
		},
		subject: player,
		details: operatorDetails(xuid, PermissionLevel.Operator),
	});
};

export const operators: Bridge.Collection = {
	kind: BridgeKind.Collection,

	async list(context) {
		const players = await readKnownPlayers(context);

		return (await readPermissions(context)).map((entry) => ({
			id: entry.xuid,
			name: players.get(entry.xuid)?.name ?? "",
			xuid: entry.xuid,
			permission: entry.permission,
		}));
	},

	async add(context, input) {
		const needle = input.trim();

		if (needle.length === 0) {
			throw new BridgeUserError({
				ar: "اكتب اسم اللاعب (الـ Gamertag) أولًا.",
				en: "Enter the player's gamertag first.",
			});
		}

		if (context.server.running) {
			const online = roster.find(needle);

			await send(context, `op ${quoted(needle)}`);

			if (online !== null) {
				reportGranted(context, online.name.length > 0 ? online.name : needle, online.xuid);
			}

			return;
		}

		const known = knownPlayerOf(await readKnownPlayers(context), needle);
		const player = known !== null && known.name.length > 0 ? known.name : needle;

		if (known === null) {
			throw new BridgeUserError({
				ar: "لا يمكن جعله أوبريتر والسيرفر متوقف، لأن معرّفه (XUID) لا يُعرف إلا بعد دخوله السيرفر مرة واحدة. شغّل السيرفر واطلب منه الدخول مرة واحدة، ثم اجعله أوبريتر متى أردت.",
				en: "We can't make them an operator while the server is stopped, because we only learn a player's XUID after they join once. Start the server, let them join once, and then you can make them an operator any time.",
			});
		}

		await writeJsonList(
			context,
			PERMISSIONS_FILE,
			withPermission(await readPermissions(context), known.xuid, PermissionLevel.Operator),
		);

		reportGranted(context, player, known.xuid);
	},

	actions: {
		async setPermission(context, row, args) {
			const level = levelOf(args);

			await writeJsonList(
				context,
				PERMISSIONS_FILE,
				withPermission(await readPermissions(context), String(row.xuid), level),
			);

			if (context.server.running) {
				await send(context, "permission reload");
			}

			const player = displayOf(row);
			const label = optionText(PERMISSION_LEVELS, level);

			context.activity.report({
				name: BridgeEventName.PlayerChanged,
				text: {
					ar: `تم تغيير صلاحية ${player} إلى ${label.ar}`,
					en: `Set ${player}'s permission to ${label.en}`,
				},
				subject: player,
				details: operatorDetails(String(row.xuid), level),
			});
		},

		async remove(context, row) {
			const name = String(row.name);

			if (context.server.running && name.length > 0) {
				const online = roster.online(String(row.xuid ?? "")) || roster.online(name);

				await send(context, `deop ${quoted(name)}`);

				if (!online) {
					return;
				}
			} else {
				await writeJsonList(
					context,
					PERMISSIONS_FILE,
					withoutPermission(await readPermissions(context), String(row.xuid)),
				);

				if (context.server.running) {
					await send(context, "permission reload");
				}
			}

			const player = displayOf(row);

			context.activity.report({
				name: BridgeEventName.AccessRevoked,
				text: {
					ar: `تمت إزالة ${player} من قائمة الأوبريتر`,
					en: `Removed ${player} from the operator list`,
				},
				subject: player,
				details: operatorDetails(String(row.xuid), String(row.permission ?? "")),
			});
		},
	},
};
