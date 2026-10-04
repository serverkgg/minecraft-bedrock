import type { Bridge } from "@serverkgg/bridge";
import { BridgeUserError } from "@serverkgg/bridge";
import { CHANNEL_TEXT, ReleaseChannel } from "./channel";

export const LINKS_URL = "https://net-secondary.web.minecraft-services.net/api/v1.0/download/links";

export const DOWNLOAD_TYPES: Record<ReleaseChannel, string> = {
	[ReleaseChannel.Preview]: "serverBedrockPreviewLinux",
	[ReleaseChannel.Release]: "serverBedrockLinux",
};

const CACHE_SECONDS = 1800;

const VERSION_FROM_URL = /bedrock-server-(?<version>\d+(?:\.\d+){2,3})\.zip$/;

export const VERSION_PATTERN = /^\d+(?:\.\d+){2,3}$/;

export interface DownloadLink {
	downloadType?: unknown;
	downloadUrl?: unknown;
}

export interface LinksResponse {
	result?: {
		links?: DownloadLink[];
	};
}

export interface Release {
	channel: ReleaseChannel;
	version: string;
	label: string;
	url: string;
}

export const versionFromUrl = (url: string): string | null => {
	return url.match(VERSION_FROM_URL)?.groups?.version ?? null;
};

export const urlForVersion = (url: string, version: string) => {
	return url.replace(VERSION_FROM_URL, `bedrock-server-${version}.zip`);
};

export const linkOf = (response: LinksResponse, channel: ReleaseChannel): string | null => {
	const wanted = DOWNLOAD_TYPES[channel];

	for (const link of response.result?.links ?? []) {
		if (link.downloadType === wanted && typeof link.downloadUrl === "string" && link.downloadUrl.length > 0) {
			return link.downloadUrl;
		}
	}

	return null;
};

const noBuild = (channel: ReleaseChannel, reason: string) => {
	const text = CHANNEL_TEXT[channel];

	return new BridgeUserError(
		{
			ar: `لا يتوفر حاليًا إصدار من سيرفر بيدروك لقناة ${text.ar} في خدمة التنزيل لدى Mojang. جرب مرة ثانية بعد لحظة.`,
			en: `Mojang's download service has no Bedrock server build on the ${text.en} channel right now. Try again in a moment.`,
		},
		{
			cause: new Error(reason),
		},
	);
};

export const releaseOf = (response: LinksResponse, channel: ReleaseChannel, pinned: string | null): Release => {
	const url = linkOf(response, channel);

	if (url === null) {
		throw noBuild(channel, `the download service listed no ${DOWNLOAD_TYPES[channel]} build`);
	}

	const latest = versionFromUrl(url);

	if (latest === null) {
		throw noBuild(channel, `the download service answered with an unreadable build url: ${url}`);
	}

	if (pinned === null) {
		return {
			channel,
			version: latest,
			label: latest,
			url,
		};
	}

	if (!VERSION_PATTERN.test(pinned)) {
		throw new BridgeUserError({
			ar: `رقم الإصدار «${pinned}» غير صحيح. يلزم أن يكون بالشكل 1.26.45.1`,
			en: `The version "${pinned}" isn't a valid build number. It has to look like 1.26.45.1`,
		});
	}

	return {
		channel,
		version: pinned,
		label: pinned,
		url: urlForVersion(url, pinned),
	};
};

export const resolveRelease = async (context: Bridge.Context, channel: ReleaseChannel, pinned: string | null) => {
	const response = await context.net.json<LinksResponse>(LINKS_URL, {
		cacheSeconds: CACHE_SECONDS,
	});

	return releaseOf(response, channel, pinned);
};
