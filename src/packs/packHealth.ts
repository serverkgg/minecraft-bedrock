import { type Bridge, BridgeDetailFormat, BridgeDetailTone, BridgeKind } from "@serverkgg/bridge";
import {
	BEHAVIOR_PACKS_DIRECTORY,
	extensionOf,
	nameOf,
	PACK_EXTENSIONS,
	PACK_STAGING,
	RESOURCE_PACKS_DIRECTORY,
	requireStopped,
	withoutExtension,
} from "../shared";
import { activeWorld, betaApisEnabled, enableBetaApis, readLevelExperiments } from "../worlds";
import { BetaApisRepair, type PackRepairSummary, packRepairActivity } from "./packActivity";
import { manifestFor } from "./packCompatibility";
import { inventoryPacks } from "./packDiscovery";
import { installPackSource } from "./packInstall";
import { PackKind, type PackManifest } from "./packManifest";
import { setPacksEnabled } from "./packMutation";
import { readWorldPacks } from "./packRegistry";
import { type PackRecord, readPackSidecar } from "./packSidecar";

const FIND_TIMEOUT_MS = 60_000;

const PACK_DIRECTORIES = [
	BEHAVIOR_PACKS_DIRECTORY,
	RESOURCE_PACKS_DIRECTORY,
];

export interface MissingDependency {
	pack: PackRecord;
	uuid: string;
}

export interface PackDiagnosis {
	world: string;
	archives: string[];
	unusable: string[];
	inactive: PackRecord[];
	missing: MissingDependency[];
	beta: PackRecord[];
	betaApis: boolean | null;
}

export const strayArchives = (output: string) => {
	return output
		.split("\n")
		.map((line) => line.trim())
		.filter((path) => {
			const directory = PACK_DIRECTORIES.find((candidate) => path.startsWith(`${candidate}/`));
			return (
				directory !== undefined
				&& !path.slice(directory.length + 1).includes("/")
				&& PACK_EXTENSIONS.includes(extensionOf(path))
			);
		})
		.sort();
};

export const installableListing = (listing: string) => {
	return listing.split("\n").some((line) => {
		const entry = line.trim();
		return /(?:^|\/)manifest\.json$/i.test(entry) || /\.(?:mcpack|mcaddon)$/i.test(entry);
	});
};

const archiveInstallable = async (context: Bridge.Context, path: string) => {
	const listing = await context.exec(
		[
			"unzip",
			"-Z1",
			"--",
			path,
		],
		{
			timeoutMs: FIND_TIMEOUT_MS,
		},
	);
	return listing.code === 0 && installableListing(listing.stdout);
};

export const packLoadState = (manifest: PackManifest | null, betaApis: boolean | null): Bridge.Text => {
	if (manifest === null) {
		return {
			ar: "ملفات ناقصة",
			en: "Missing files",
		};
	}
	if (manifest.betaModules.length > 0 && betaApis !== true) {
		return betaApis === false
			? {
					ar: "يحتاج Beta APIs · مقفلة على الماب",
					en: "Needs Beta APIs · off on this world",
				}
			: {
					ar: "يحتاج Beta APIs",
					en: "Needs Beta APIs",
				};
	}
	return {
		ar: "مركّب · التشغيل غير مؤكّد",
		en: "Installed · load unverified",
	};
};

export const diagnosePacks = async (context: Bridge.Context): Promise<PackDiagnosis> => {
	const world = await activeWorld(context);
	const found = await context.exec(
		[
			"find",
			...PACK_DIRECTORIES,
			"-maxdepth",
			"1",
			"-type",
			"f",
		],
		{
			timeoutMs: FIND_TIMEOUT_MS,
		},
	);
	const inventory = await inventoryPacks(context);
	const saved = await readPackSidecar(context);
	const active = new Set<string>();
	for (const kind of [
		PackKind.Behavior,
		PackKind.Resource,
	]) {
		for (const entry of await readWorldPacks(context, world, kind)) {
			active.add(entry.pack_id);
		}
	}
	const packs = Object.values(inventory.packs);
	const archives: string[] = [];
	const unusable: string[] = [];
	for (const path of strayArchives(found.stdout)) {
		((await archiveInstallable(context, path)) ? archives : unusable).push(path);
	}
	const beta: PackRecord[] = [];
	for (const pack of packs) {
		if (active.has(pack.uuid) && ((await manifestFor(context, pack))?.betaModules.length ?? 0) > 0) {
			beta.push(pack);
		}
	}
	return {
		world,
		archives,
		unusable,
		inactive: packs.filter((pack) => !active.has(pack.uuid) && saved.packs[pack.uuid] === undefined),
		missing: packs
			.filter((pack) => active.has(pack.uuid))
			.flatMap((pack) =>
				pack.dependencies
					.filter((uuid) => inventory.packs[uuid] === undefined)
					.map((uuid) => ({
						pack,
						uuid,
					})),
			),
		beta,
		betaApis: betaApisEnabled(await readLevelExperiments(context, world)),
	};
};

export const repairable = (diagnosis: PackDiagnosis) => {
	return (
		diagnosis.archives.length > 0
		|| diagnosis.inactive.length > 0
		|| (diagnosis.beta.length > 0 && diagnosis.betaApis === false)
	);
};

const reasonOf = (error: unknown) => {
	return error instanceof Error ? error.message : String(error);
};

const repairBetaApis = async (context: Bridge.Context): Promise<BetaApisRepair> => {
	const repaired = await diagnosePacks(context);
	if (repaired.beta.length === 0) {
		return BetaApisRepair.NotNeeded;
	}
	if (repaired.betaApis === null) {
		context.log.warn("repair left Beta APIs alone because the world's level file could not be read", {
			world: repaired.world,
		});
		return BetaApisRepair.Unreadable;
	}
	try {
		await enableBetaApis(context, repaired.world);
	} catch (error) {
		context.log.warn("repair could not turn on Beta APIs", {
			world: repaired.world,
			reason: reasonOf(error),
		});
		return BetaApisRepair.Failed;
	}
	return repaired.betaApis ? BetaApisRepair.AlreadyOn : BetaApisRepair.TurnedOn;
};

export const repairPacks = async (context: Bridge.Context): Promise<PackRepairSummary> => {
	requireStopped(context);
	const diagnosis = await diagnosePacks(context);
	let activated = 0;
	let activationFailed = 0;
	let installed = 0;
	let installFailed = 0;
	for (const pack of diagnosis.inactive) {
		try {
			await setPacksEnabled(
				context,
				[
					pack.uuid,
				],
				true,
			);
			activated += 1;
			context.log("repair activated an add-on that was never activated", {
				pack: pack.title,
			});
		} catch (error) {
			activationFailed += 1;
			context.log.warn("repair could not activate an add-on", {
				pack: pack.title,
				reason: reasonOf(error),
			});
		}
	}
	for (const archive of diagnosis.archives) {
		const staged = `${PACK_STAGING}/${nameOf(archive)}`;
		await context.files.remove(PACK_STAGING);
		await context.files.ensure(PACK_STAGING);
		await context.files.move(archive, staged);
		try {
			const result = await installPackSource(context, {
				archive: staged,
				bundle: withoutExtension(nameOf(archive)),
			});
			installed += 1;
			context.log("repair installed an add-on file that was uploaded through Files", {
				file: archive,
				packs: result.packs.map((pack) => pack.title).join(", "),
			});
		} catch (error) {
			installFailed += 1;
			if (await context.files.exists(staged)) {
				await context.files.move(staged, archive);
			}
			await context.files.remove(PACK_STAGING);
			context.log.warn("repair could not install an add-on file and left it where it was", {
				file: archive,
				reason: reasonOf(error),
			});
		}
	}
	return {
		activated,
		activationFailed,
		installed,
		installFailed,
		betaApis: await repairBetaApis(context),
	};
};

const listed = (items: string[]) => {
	return items.length === 0 ? "—" : items.join("\n");
};

const betaBlocked = (diagnosis: PackDiagnosis) => {
	return diagnosis.beta.length > 0 && diagnosis.betaApis !== true;
};

const betaAdvice = (diagnosis: PackDiagnosis) => {
	if (!betaBlocked(diagnosis)) {
		return null;
	}
	return diagnosis.betaApis === false
		? {
				ar: "بعض أدوناتك تحتاج Beta APIs وهي مقفلة على الماب. اضغط «صلّح الأدونات» ونفعّلها لك.",
				en: "Some of your add-ons need Beta APIs, which is off for this world. Press Repair add-ons and we turn it on.",
			}
		: {
				ar: "بعض أدوناتك تحتاج Beta APIs، وما قدرنا نقرأ إعدادات الماب. افتح الماب على جهازك، فعّل Beta APIs من Experiments، صدّر الماب وارفعها من تبويب المابات.",
				en: "Some of your add-ons need Beta APIs, and we could not read this world's settings. Open the world on your device, turn on Beta APIs under Experiments, export the world and upload it from the Worlds tab.",
			};
};

const badges = (diagnosis: PackDiagnosis): Bridge.DetailBadge[] => {
	const found: Bridge.DetailBadge[] = [];
	if (diagnosis.archives.length > 0) {
		found.push({
			label: {
				ar: `${diagnosis.archives.length} ملف أدون ما تركّب`,
				en: `${diagnosis.archives.length} add-on files never installed`,
			},
			tone: BridgeDetailTone.Warning,
		});
	}
	if (diagnosis.unusable.length > 0) {
		found.push({
			label: {
				ar: `${diagnosis.unusable.length} ملف مو أدون`,
				en: `${diagnosis.unusable.length} files are not add-ons`,
			},
			tone: BridgeDetailTone.Neutral,
		});
	}
	if (diagnosis.inactive.length > 0) {
		found.push({
			label: {
				ar: `${diagnosis.inactive.length} أدون مو مفعّل`,
				en: `${diagnosis.inactive.length} packs not active`,
			},
			tone: BridgeDetailTone.Warning,
		});
	}
	if (diagnosis.missing.length > 0) {
		found.push({
			label: {
				ar: `${diagnosis.missing.length} متطلب ناقص`,
				en: `${diagnosis.missing.length} missing required packs`,
			},
			tone: BridgeDetailTone.Danger,
		});
	}
	if (betaBlocked(diagnosis)) {
		found.push({
			label: {
				ar: "فيه أدونات تحتاج Beta APIs",
				en: "Some add-ons need Beta APIs",
			},
			tone: BridgeDetailTone.Warning,
		});
	}
	if (found.length === 0) {
		found.push({
			label: {
				ar: "الأدونات سليمة",
				en: "Add-ons look healthy",
			},
			tone: BridgeDetailTone.Success,
		});
	}
	return found;
};

const betaApisLabel = (betaApis: boolean | null) => {
	if (betaApis === null) {
		return {
			ar: "ما قدرنا نقرأها",
			en: "Unknown",
		};
	}
	return betaApis
		? {
				ar: "مفعّلة",
				en: "On",
			}
		: {
				ar: "مقفلة",
				en: "Off",
			};
};

const stats = (diagnosis: PackDiagnosis): Bridge.DetailStat[] => {
	return [
		{
			key: "archives",
			label: {
				ar: "ملفات ما تركّبت",
				en: "Files not installed",
			},
			value: listed(diagnosis.archives.map(nameOf)),
			format: BridgeDetailFormat.Text,
		},
		{
			key: "unusable",
			label: {
				ar: "ملفات مو أدونات",
				en: "Files that are not add-ons",
			},
			value: listed(diagnosis.unusable.map(nameOf)),
			format: BridgeDetailFormat.Text,
		},
		{
			key: "inactive",
			label: {
				ar: "أدونات مو مفعّلة",
				en: "Packs not active",
			},
			value: listed(diagnosis.inactive.map((pack) => pack.title)),
			format: BridgeDetailFormat.Text,
		},
		{
			key: "missing",
			label: {
				ar: "متطلبات ناقصة",
				en: "Missing required packs",
			},
			value: listed(diagnosis.missing.map((entry) => `${entry.pack.title} → ${entry.uuid}`)),
			format: BridgeDetailFormat.Text,
		},
		{
			key: "beta",
			label: {
				ar: "تحتاج Beta APIs",
				en: "Need Beta APIs",
			},
			value: listed(diagnosis.beta.map((pack) => pack.title)),
			format: BridgeDetailFormat.Text,
		},
		{
			key: "betaApis",
			label: {
				ar: "Beta APIs على الماب",
				en: "Beta APIs on this world",
			},
			value: betaApisLabel(diagnosis.betaApis),
			format: BridgeDetailFormat.Text,
		},
	];
};

export const packHealth: Bridge.Detail = {
	kind: BridgeKind.Detail,
	protectedActions: [
		"repair",
	],

	async read(context) {
		const diagnosis = await diagnosePacks(context);

		return {
			id: "pack-health",
			title: {
				ar: "فحص الأدونات",
				en: "Add-on check",
			},
			subtitle: {
				ar: `الماب المفعّلة: ${diagnosis.world}`,
				en: `Active world: ${diagnosis.world}`,
			},
			description: betaAdvice(diagnosis),
			image: null,
			badges: badges(diagnosis),
			stats: stats(diagnosis),
			links: [],
			stale: false,
			actions: repairable(diagnosis)
				? [
						"repair",
					]
				: [],
		};
	},

	actions: {
		async repair(context) {
			context.activity.report(packRepairActivity(await repairPacks(context)));
			return null;
		},
	},
};
