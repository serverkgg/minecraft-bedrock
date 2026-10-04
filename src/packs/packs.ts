import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import {
	isUnder,
	nameOf,
	PACK_STAGING,
	relativeUploadPath,
	requireStopped,
	sizeForReport,
	withoutExtension,
} from "../shared";
import { activeWorld, betaApisEnabled, readLevelExperiments } from "../worlds";
import {
	PackMove,
	packInstalledActivity,
	packMovedActivity,
	packsRemovedActivity,
	packsToggledActivity,
	UPLOAD_PROVIDER,
} from "./packActivity";
import { manifestFor, type PackUsage, readPackUsage } from "./packCompatibility";
import { inventoryPacks } from "./packDiscovery";
import { packLoadState } from "./packHealth";
import { installPackSource } from "./packInstall";
import { PackKind } from "./packManifest";
import { packRemovalRefusal, removePacks, setPacksEnabled } from "./packMutation";
import { movePackEntry, readWorldPacks, writeWorldPacks } from "./packRegistry";
import type { PackSidecar } from "./packSidecar";

const oncePerContext = <Value>(read: (context: Bridge.Context) => Promise<Value>) => {
	const reads = new WeakMap<Bridge.Context, Promise<Value>>();

	return (context: Bridge.Context) => {
		const known = reads.get(context);

		if (known) {
			return known;
		}

		const value = read(context);

		reads.set(context, value);

		return value;
	};
};

const inventoryOnce = oncePerContext<PackSidecar>(inventoryPacks);

const usageOnce = oncePerContext<PackUsage>(readPackUsage);

export const packs: Bridge.Collection = {
	kind: BridgeKind.Collection,
	protectedActions: [
		"remove",
	],

	async list(context) {
		const sidecar = await inventoryOnce(context);
		const usage = await usageOnce(context);
		const world = await activeWorld(context);
		const betaApis = betaApisEnabled(await readLevelExperiments(context, world));
		const active = new Map<PackKind, string[]>();

		for (const kind of [
			PackKind.Behavior,
			PackKind.Resource,
		]) {
			active.set(
				kind,
				(await readWorldPacks(context, world, kind)).map((entry) => entry.pack_id),
			);
		}

		return await Promise.all(
			Object.values(sidecar.packs).map(async (pack) => {
				const listed = active.get(pack.kind) ?? [];
				const manifest = await manifestFor(context, pack);

				return {
					id: pack.uuid,
					name: pack.title,
					kind:
						pack.kind === PackKind.Behavior
							? {
									ar: "سلوك",
									en: "Behavior",
								}
							: {
									ar: "مظهر",
									en: "Resource",
								},
					version: pack.versionText,
					enabled: listed.includes(pack.uuid) ? "✓" : "",
					order: String(listed.indexOf(pack.uuid) + 1),
					worlds: (await usage.worldsUsing(pack)).join(", "),
					requirements:
						manifest?.requirements
							.map((entry) => `${entry.uuid ?? entry.module} ${entry.version?.text ?? ""}`)
							.join(", ") ?? "—",
					load: packLoadState(manifest, betaApis),
				};
			}),
		);
	},

	async add(context, input) {
		const relative = relativeUploadPath(input);

		if (relative === null || !isUnder(relative, PACK_STAGING)) {
			throw new BridgeUserError({
				ar: "تعذّرت قراءة الملف المرفوع، ارفعه مرة ثانية.",
				en: "We couldn't read the file you uploaded. Try uploading it again.",
			});
		}

		const bundle = withoutExtension(nameOf(relative));
		const sizeBytes = await sizeForReport(context, relative);
		const result = await installPackSource(context, {
			archive: relative,
			bundle,
		});

		context.activity.report(
			packInstalledActivity(result, {
				bundle,
				provider: UPLOAD_PROVIDER,
				sizeBytes,
			}),
		);
	},

	actions: {
		async enable(context, row) {
			const changed = await setPacksEnabled(
				context,
				[
					String(row.id),
				],
				true,
			);

			if (changed.length > 0) {
				context.activity.report(packsToggledActivity(changed, String(row.name), true));
			}
		},
		async disable(context, row) {
			const changed = await setPacksEnabled(
				context,
				[
					String(row.id),
				],
				false,
			);

			if (changed.length > 0) {
				context.activity.report(packsToggledActivity(changed, String(row.name), false));
			}
		},

		async moveUp(context, row) {
			await reorder(context, String(row.id), PackMove.Up);
		},

		async moveDown(context, row) {
			await reorder(context, String(row.id), PackMove.Down);
		},

		async remove(context, row) {
			const removed = await removePacks(context, [
				String(row.id),
			]);

			if (removed.length > 0) {
				context.activity.report(packsRemovedActivity(removed, String(row.name)));
			}
		},
	},

	async unavailable(context, row): Promise<Bridge.Unavailable> {
		const refusal = await packRemovalRefusal(
			await usageOnce(context),
			[
				String(row.id),
			],
			await inventoryOnce(context),
		);

		return refusal
			? {
					remove: refusal,
				}
			: {};
	},
};

const reorder = async (context: Bridge.Context, uuid: string, move: PackMove) => {
	requireStopped(context);
	const sidecar = await inventoryPacks(context);
	const pack = sidecar.packs[uuid];

	if (pack === undefined) {
		return;
	}

	const world = await activeWorld(context);
	const entries = await readWorldPacks(context, world, pack.kind);
	const moved = movePackEntry(entries, uuid, move === PackMove.Up ? -1 : 1);

	await writeWorldPacks(context, world, pack.kind, moved);

	const position = moved.findIndex((entry) => entry.pack_id === uuid);

	if (position !== entries.findIndex((entry) => entry.pack_id === uuid)) {
		context.activity.report(packMovedActivity(pack.title, move, position + 1));
	}
};
