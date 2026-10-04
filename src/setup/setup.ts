import { type Bridge, BridgeKind, BridgeSetupStepKind } from "@serverkgg/bridge";
import { GuideOpenTab } from "@serverkgg/bridge/guides";
import { PROPERTY_KEYS } from "../shared";

export const setup: Bridge.Setup = {
	kind: BridgeKind.Setup,
	steps: [
		{
			id: "identity",
			kind: BridgeSetupStepKind.Form,
			required: false,
			title: {
				ar: "سمّ سيرفرك",
				en: "Name your server",
			},
			help: {
				ar: "الاسم الذي يظهر للاعبين في قائمة السيرفرات لديهم.",
				en: "This is the name players see in their server list.",
			},
			tab: "settings",
			section: "world",
			fields: [
				PROPERTY_KEYS.serverName,
				PROPERTY_KEYS.maxPlayers,
				PROPERTY_KEYS.gamemode,
				PROPERTY_KEYS.difficulty,
			],
		},
		{
			id: "access",
			kind: BridgeSetupStepKind.Form,
			required: false,
			title: {
				ar: "من يستطيع الدخول",
				en: "Who can join",
			},
			help: {
				ar: "لسيرفر خاص، فعّل القائمة البيضاء وأضف أصحابك إليها. لا يوجد حظر في بيدروك، لذلك هذه هي الطريقة.",
				en: "For a private server, turn the allowlist on and add your friends to it. Bedrock has no ban, so this is your way.",
			},
			tab: "settings",
			section: "access",
			fields: [
				PROPERTY_KEYS.allowList,
				PROPERTY_KEYS.onlineMode,
			],
		},
		{
			id: "invite",
			kind: BridgeSetupStepKind.Open,
			required: false,
			title: {
				ar: "ادعُ أصحابك",
				en: "Invite your friends",
			},
			help: {
				ar: "في بيدروك، العنوان والمنفذ في خانتين منفصلتين. انسخهما من هنا وأرسلهما إلى أصحابك.",
				en: "On Bedrock, the address and the port are two separate fields. Copy them from here and send them to your friends.",
			},
			target: {
				tab: GuideOpenTab.Access,
			},
		},
	],
};
