import type { Bridge } from "@serverkgg/bridge";

export enum ReleaseChannel {
	Preview = "preview",
	Release = "release",
}

export const CHANNEL_VARIABLE = "BEDROCK_CHANNEL";

export const VERSION_VARIABLE = "BEDROCK_VERSION";

export const CHANNEL_LABELS: Record<ReleaseChannel, string> = {
	[ReleaseChannel.Preview]: "Preview",
	[ReleaseChannel.Release]: "Release",
};

export const CHANNEL_TEXT: Record<ReleaseChannel, Bridge.Text> = {
	[ReleaseChannel.Preview]: {
		ar: "بريفيو",
		en: "Preview",
	},
	[ReleaseChannel.Release]: {
		ar: "الإصدار العادي",
		en: "Release",
	},
};

const CHANNELS = new Set<string>(Object.values(ReleaseChannel));

export const channelFrom = (declared: string | null): ReleaseChannel => {
	const value = declared ?? "";

	return CHANNELS.has(value) ? (value as ReleaseChannel) : ReleaseChannel.Release;
};

export const channelOf = (context: Bridge.Context) => {
	return channelFrom(context.variable(CHANNEL_VARIABLE));
};

export const pinnedVersionOf = (context: Bridge.Context) => {
	const value = (context.variable(VERSION_VARIABLE) ?? "").trim();

	return value.length === 0 ? null : value;
};
