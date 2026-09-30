import type { Bridge } from "@serverkgg/bridge";

export const GAME_MODES: Bridge.Option[] = [
	{
		value: "survival",
		label: {
			ar: "البقاء",
			en: "Survival",
		},
	},
	{
		value: "creative",
		label: {
			ar: "الإبداع",
			en: "Creative",
		},
	},
	{
		value: "adventure",
		label: {
			ar: "المغامرة",
			en: "Adventure",
		},
	},
];

export const DIFFICULTIES: Bridge.Option[] = [
	{
		value: "peaceful",
		label: {
			ar: "مسالم",
			en: "Peaceful",
		},
	},
	{
		value: "easy",
		label: {
			ar: "سهل",
			en: "Easy",
		},
	},
	{
		value: "normal",
		label: {
			ar: "عادي",
			en: "Normal",
		},
	},
	{
		value: "hard",
		label: {
			ar: "صعب",
			en: "Hard",
		},
	},
];

export const PERMISSION_LEVELS: Bridge.Option[] = [
	{
		value: "visitor",
		label: {
			ar: "زائر",
			en: "Visitor",
		},
	},
	{
		value: "member",
		label: {
			ar: "عضو",
			en: "Member",
		},
	},
	{
		value: "operator",
		label: {
			ar: "أوبريتر",
			en: "Operator",
		},
	},
];

export const optionText = (options: Bridge.Option[], value: string): Bridge.Text => {
	return (
		options.find((option) => option.value === value)?.label ?? {
			ar: value,
			en: value,
		}
	);
};
