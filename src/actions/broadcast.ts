import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { activityExcerpt, BridgeEventName } from "@serverkgg/bridge/protocol";
import { rawTextCommand, sanitizeMessage, send, titleCommand } from "../shared";

const messageOf = (args: Bridge.Values) => {
	const value = args.message;

	if (typeof value !== "string" || value.trim().length === 0) {
		throw new BridgeUserError({
			ar: "اكتب الرسالة الأول.",
			en: "type the message first",
		});
	}

	return value;
};

export const broadcast: Bridge.Actions = {
	kind: BridgeKind.Actions,
	requiresRunning: true,

	actions: {
		async say(context, args) {
			const message = messageOf(args);

			await send(context, rawTextCommand(message));

			const excerpt = activityExcerpt(sanitizeMessage(message));

			context.activity.report({
				name: BridgeEventName.BroadcastSent,
				text: {
					ar: `تم إرسال رسالة للاعبين: «${excerpt}»`,
					en: `Sent a message to players: "${excerpt}"`,
				},
				details: {
					style: "chat",
				},
			});
		},

		async title(context, args) {
			const message = messageOf(args);

			await send(context, titleCommand(message));

			const excerpt = activityExcerpt(sanitizeMessage(message));

			context.activity.report({
				name: BridgeEventName.BroadcastSent,
				text: {
					ar: `تم عرض عنوان للاعبين: «${excerpt}»`,
					en: `Showed a title to players: "${excerpt}"`,
				},
				details: {
					style: "title",
				},
			});
		},
	},
};
