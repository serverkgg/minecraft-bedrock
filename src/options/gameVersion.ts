import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { CHANNEL_VARIABLE, channelOf, readInstallStamp, resolveRelease } from "../install";

const TTL_SECONDS = 1800;

const reasonOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const gameVersion: Bridge.Options = {
	kind: BridgeKind.Options,
	dependsOn: [
		CHANNEL_VARIABLE,
	],
	ttlSeconds: TTL_SECONDS,

	async list(context) {
		const channel = channelOf(context);
		const options: Bridge.Option[] = [
			{
				value: "",
				label: {
					ar: "تابع أحدث إصدار",
					en: "Follow the latest build",
				},
				help: {
					ar: "نحدّث السيرفر إلى كل إصدار جديد بعد أخذ نسخة احتياطية، وننتظر خلوه من اللاعبين. اختر رقم إصدار محددًا ليبقى السيرفر عليه.",
					en: "We move your server to each new build with a backup first, and wait until no one is playing. Pick a build number to keep your server on it.",
				},
			},
		];

		const seen = new Set<string>();

		try {
			const release = await resolveRelease(context, channel, null);

			seen.add(release.version);
			options.push({
				value: release.version,
				label: {
					ar: release.label,
					en: release.label,
				},
				latest: true,
			});
		} catch (error) {
			context.log.warn("could not reach the download service while listing builds", {
				reason: reasonOf(error),
				cause: error instanceof Error && error.cause !== undefined ? reasonOf(error.cause) : null,
			});
		}

		const stamp = await readInstallStamp(context);

		if (stamp !== null && stamp.channel === channel && !seen.has(stamp.version)) {
			options.push({
				value: stamp.version,
				label: {
					ar: stamp.label,
					en: stamp.label,
				},
			});
		}

		return options;
	},
};
