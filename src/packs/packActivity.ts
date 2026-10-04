import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import type { PackRecord } from "./packSidecar";

export const UPLOAD_PROVIDER = "upload";

export enum PackMove {
	Down = "down",
	Up = "up",
}

export enum BetaApisRepair {
	AlreadyOn = "already-on",
	Failed = "failed",
	NotNeeded = "not-needed",
	TurnedOn = "turned-on",
	Unreadable = "unreadable",
}

export interface PackInstallResult {
	packs: PackRecord[];
	betaApisOff: boolean;
}

export interface PackInstallSource {
	bundle: string;
	provider: string;
	sizeBytes: number | null;
}

export interface PackRepairSummary {
	activated: number;
	activationFailed: number;
	installed: number;
	installFailed: number;
	betaApis: BetaApisRepair;
}

export const packsTitle = (packs: PackRecord[], fallback: string) => {
	const [first] = packs;

	if (packs.length === 1 && first !== undefined) {
		return first.title;
	}

	return first?.bundle ?? fallback;
};

const packsDetails = (packs: PackRecord[], title: string): Bridge.Values => {
	const also = packs.filter((pack) => pack.title !== title).map((pack) => pack.title);

	return also.length === 0
		? {
				packs: packs.length,
			}
		: {
				packs: packs.length,
				also: also.join(", "),
			};
};

export const packInstalledActivity = (result: PackInstallResult, source: PackInstallSource): Bridge.Activity => {
	const title = packsTitle(result.packs, source.bundle);
	const version = result.packs.at(0)?.versionText ?? "";
	const named = version.length === 0 ? title : `${title} (${version})`;

	return {
		name: BridgeEventName.ModInstalled,
		text: {
			ar: `تم تثبيت إضافة ${named}`,
			en: `Installed add-on ${named}`,
		},
		subject: title,
		details: {
			provider: source.provider,
			version,
			...(source.sizeBytes === null
				? {}
				: {
						sizeBytes: source.sizeBytes,
					}),
			packs: result.packs.length,
			...(result.betaApisOff
				? {
						betaApis: "off",
					}
				: {}),
		},
	};
};

export const packsToggledActivity = (packs: PackRecord[], title: string, enabled: boolean): Bridge.Activity => {
	return {
		name: enabled ? BridgeEventName.ModEnabled : BridgeEventName.ModDisabled,
		text: enabled
			? {
					ar: `تم تفعيل إضافة ${title}`,
					en: `Enabled add-on ${title}`,
				}
			: {
					ar: `تم إيقاف إضافة ${title}`,
					en: `Disabled add-on ${title}`,
				},
		subject: title,
		details: packsDetails(packs, title),
	};
};

export const packsRemovedActivity = (packs: PackRecord[], title: string): Bridge.Activity => {
	return {
		name: BridgeEventName.ModRemoved,
		text: {
			ar: `تمت إزالة إضافة ${title}`,
			en: `Removed add-on ${title}`,
		},
		subject: title,
		details: packsDetails(packs, title),
	};
};

export const packMovedActivity = (title: string, move: PackMove, position: number): Bridge.Activity => {
	return {
		name: BridgeEventName.SettingsApplied,
		text:
			move === PackMove.Up
				? {
						ar: `تم نقل إضافة ${title} إلى الأعلى في ترتيب التحميل، وأصبحت رقم ${position}`,
						en: `Moved add-on ${title} up the load order, now number ${position}`,
					}
				: {
						ar: `تم نقل إضافة ${title} إلى الأسفل في ترتيب التحميل، وأصبحت رقم ${position}`,
						en: `Moved add-on ${title} down the load order, now number ${position}`,
					},
		subject: title,
		details: {
			target: "pack-order",
			pack: title,
			move,
			position,
		},
	};
};

export const packRepairActivity = (summary: PackRepairSummary): Bridge.Activity => {
	const failed = summary.activationFailed + summary.installFailed;
	const turnedOn = summary.betaApis === BetaApisRepair.TurnedOn;
	const counts = {
		ar: `مثبّتة ${summary.installed}، مفعّلة ${summary.activated}${failed > 0 ? `، تعذّر إصلاح ${failed}` : ""}`,
		en: `${summary.installed} installed, ${summary.activated} enabled${failed > 0 ? `, ${failed} not fixed` : ""}`,
	};

	return {
		name: BridgeEventName.SettingsApplied,
		text: turnedOn
			? {
					ar: `تم إصلاح الإضافات وتفعيل Beta APIs (${counts.ar})`,
					en: `Repaired the add-ons and enabled Beta APIs (${counts.en})`,
				}
			: {
					ar: `تم إصلاح الإضافات (${counts.ar})`,
					en: `Repaired the add-ons (${counts.en})`,
				},
		details: {
			target: "pack-repair",
			activated: summary.activated,
			activationFailed: summary.activationFailed,
			installed: summary.installed,
			installFailed: summary.installFailed,
			betaApis: summary.betaApis,
		},
	};
};
