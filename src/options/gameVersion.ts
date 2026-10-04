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
					ar: "احتفظ بالإصدار المثبّت",
					en: "Keep installed build",
				},
				help: {
					ar: "نختار الأحدث عند التثبيت الأول فقط. للتحديث، اختر رقم الإصدار الجديد من القائمة.",
					en: "We pick the latest only on the first install. To update, pick the new build number from the list.",
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
