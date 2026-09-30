import { type Bridge, BridgeKind } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { recoverFileTransaction } from "../shared";
import { CHANNEL_LABELS, CHANNEL_TEXT, channelOf, pinnedVersionOf, type ReleaseChannel } from "./channel";
import { gameInstalled, installGame } from "./installGame";
import { type InstallStamp, readInstallStamp } from "./installStamp";
import { type Release, resolveRelease } from "./releases";
import { seedConfig } from "./seedConfig";

const reasonOf = (error: unknown) => {
	return error instanceof Error ? error.message : String(error);
};

export const selectedInstallVersion = (selected: string | null, channel: ReleaseChannel, stamp: InstallStamp | null) =>
	selected ?? (stamp?.channel === channel ? stamp.version : null);

const install: Bridge.Install = {
	kind: BridgeKind.Install,
	async run(context) {
		await recoverFileTransaction(context);
		const stamp = await readInstallStamp(context);
		const channel = channelOf(context);
		const pinned = selectedInstallVersion(pinnedVersionOf(context), channel, stamp);
		const installed = await gameInstalled(context);

		if (stamp !== null && stamp.channel === channel && pinned === stamp.version && installed) {
			await seedConfig(context);

			return;
		}

		let release: Release;

		try {
			release = await resolveRelease(context, channel, pinned);
		} catch (error) {
			if (stamp !== null && stamp.channel === channel && installed && (pinned === null || pinned === stamp.version)) {
				context.log.warn("could not reach the download service, keeping the installed build", {
					reason: reasonOf(error),
					cause: error instanceof Error && error.cause !== undefined ? reasonOf(error.cause) : null,
					version: stamp.version,
				});

				await seedConfig(context);

				return;
			}

			throw error;
		}

		if (stamp !== null && stamp.version === release.version && stamp.channel === channel && installed) {
			await seedConfig(context);

			return;
		}

		await installGame(context, release, stamp?.files ?? [], stamp?.packs ?? []);

		await seedConfig(context);

		const channelText = CHANNEL_TEXT[release.channel];

		if (stamp === null) {
			context.activity.report({
				name: BridgeEventName.GameInstalled,
				text: {
					ar: `تم تثبيت سيرفر بيدروك ${release.label} على قناة ${channelText.ar}`,
					en: `Installed Bedrock server ${release.label} on the ${channelText.en} channel`,
				},
				subject: release.label,
				details: {
					channel: release.channel,
					version: release.version,
				},
			});
		}

		if (stamp !== null && stamp.channel === release.channel && stamp.version !== release.version) {
			context.emit(BridgeEventName.ServerUpdated, {
				from: stamp.label,
				to: release.label,
			});

			context.activity.report({
				name: BridgeEventName.ServerUpdated,
				text: {
					ar: `تم تحديث سيرفر بيدروك من ${stamp.label} إلى ${release.label} على قناة ${channelText.ar}`,
					en: `Updated Bedrock server from ${stamp.label} to ${release.label} on the ${channelText.en} channel`,
				},
				subject: release.label,
				details: {
					from: stamp.label,
					to: release.label,
					channel: release.channel,
				},
			});
		}

		if (stamp !== null && stamp.channel !== release.channel) {
			const previousText = CHANNEL_TEXT[stamp.channel];

			context.activity.report({
				name: BridgeEventName.ServerUpdated,
				text: {
					ar: `تم تحديث سيرفر بيدروك من ${stamp.label} على قناة ${previousText.ar} إلى ${release.label} على قناة ${channelText.ar}`,
					en: `Updated Bedrock server from ${stamp.label} on the ${previousText.en} channel to ${release.label} on the ${channelText.en} channel`,
				},
				subject: release.label,
				details: {
					from: stamp.label,
					to: release.label,
					channel: release.channel,
					previousChannel: stamp.channel,
				},
			});
		}

		return;
	},
	async describe(context) {
		const stamp = await readInstallStamp(context);

		return {
			version: stamp?.label ?? null,
			variant: CHANNEL_LABELS[channelOf(context)],
			build: null,
		};
	},
};

export { install };
