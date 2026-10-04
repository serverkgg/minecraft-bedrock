import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { DIFFICULTIES, optionText, send } from "../shared";

const choiceOf = (args: Bridge.Values, key: string, allowed: string[]) => {
	const value = args[key];

	if (typeof value !== "string" || !allowed.includes(value)) {
		throw new BridgeUserError({
			ar: "الخيار المحدد غير مدعوم.",
			en: "The server doesn't accept that choice.",
		});
	}

	return value;
};

const reportChange = (context: Bridge.Context, what: string, value: string, text: Bridge.Text) => {
	context.activity.report({
		name: BridgeEventName.GameplayChanged,
		text,
		details: {
			what,
			value,
		},
	});
};

export const gameplay: Bridge.Actions = {
	kind: BridgeKind.Actions,
	requiresRunning: true,

	actions: {
		async timeDay(context) {
			await send(context, "time set day");

			reportChange(context, "time", "day", {
				ar: "تم تحويل الوقت إلى النهار",
				en: "Set the time to day",
			});
		},

		async timeNight(context) {
			await send(context, "time set night");

			reportChange(context, "time", "night", {
				ar: "تم تحويل الوقت إلى الليل",
				en: "Set the time to night",
			});
		},

		async weatherClear(context) {
			await send(context, "weather clear");

			reportChange(context, "weather", "clear", {
				ar: "تم تغيير الطقس إلى صافٍ",
				en: "Set the weather to clear",
			});
		},

		async weatherRain(context) {
			await send(context, "weather rain");

			reportChange(context, "weather", "rain", {
				ar: "تم تغيير الطقس إلى مطر",
				en: "Set the weather to rain",
			});
		},

		async weatherThunder(context) {
			await send(context, "weather thunder");

			reportChange(context, "weather", "thunder", {
				ar: "تم تغيير الطقس إلى رعد وبرق",
				en: "Set the weather to thunder",
			});
		},

		async difficulty(context, args) {
			const difficulty = choiceOf(
				args,
				"difficulty",
				DIFFICULTIES.map((option) => option.value),
			);
			const label = optionText(DIFFICULTIES, difficulty);

			await send(context, `changesetting difficulty ${difficulty}`);

			reportChange(context, "difficulty", difficulty, {
				ar: `تم تغيير الصعوبة إلى ${label.ar}`,
				en: `Set the difficulty to ${label.en}`,
			});
		},

		async allowlistOn(context) {
			await send(context, "allowlist on");

			reportChange(context, "allowlist", "on", {
				ar: "تم تفعيل القائمة البيضاء",
				en: "Enabled the allowlist",
			});
		},

		async allowlistOff(context) {
			await send(context, "allowlist off");

			reportChange(context, "allowlist", "off", {
				ar: "تم إيقاف القائمة البيضاء",
				en: "Disabled the allowlist",
			});
		},

		async reloadPermissions(context) {
			await send(context, "permission reload");

			reportChange(context, "permissions", "reload", {
				ar: "تمت إعادة قراءة الصلاحيات",
				en: "Reloaded the permissions",
			});
		},
	},
};
