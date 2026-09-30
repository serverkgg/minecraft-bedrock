import { describe, expect, test } from "bun:test";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import {
	BetaApisRepair,
	PackMove,
	packInstalledActivity,
	packMovedActivity,
	packRepairActivity,
	packsRemovedActivity,
	packsToggledActivity,
	UPLOAD_PROVIDER,
} from "./packActivity";
import { PackKind } from "./packManifest";
import type { PackRecord } from "./packSidecar";

const record = (uuid: string, title: string, kind: PackKind): PackRecord => ({
	uuid,
	kind,
	folder: `behavior_packs/${title}-${uuid}`,
	title,
	version: [
		1,
		2,
		0,
	],
	versionText: "1.2.0",
	bundle: "Dragons",
	order: 0,
	dependencies: [],
	provider: "curseforge",
	project: "42",
	file: "7",
	icon: null,
	pageUrl: null,
	installedAt: "2026-09-29T00:00:00.000Z",
});

const BEHAVIOR = record("a", "Dragons BP", PackKind.Behavior);

const RESOURCE = record("b", "Dragons RP", PackKind.Resource);

describe("reporting add-on changes", () => {
	test("an install names the add-on, its version, size and provider", () => {
		expect(
			packInstalledActivity(
				{
					packs: [
						BEHAVIOR,
					],
					betaApisOff: false,
				},
				{
					bundle: "dragons",
					provider: UPLOAD_PROVIDER,
					sizeBytes: 2048,
				},
			),
		).toEqual({
			name: BridgeEventName.ModInstalled,
			text: {
				ar: "تم تثبيت أدون Dragons BP (1.2.0)",
				en: "Installed add-on Dragons BP (1.2.0)",
			},
			subject: "Dragons BP",
			details: {
				provider: "upload",
				version: "1.2.0",
				sizeBytes: 2048,
				packs: 1,
			},
		});
	});

	test("an install of several packs is named after the bundle and notes Beta APIs being off", () => {
		const entry = packInstalledActivity(
			{
				packs: [
					BEHAVIOR,
					RESOURCE,
				],
				betaApisOff: true,
			},
			{
				bundle: "Dragons",
				provider: "curseforge",
				sizeBytes: 4096,
			},
		);
		expect(entry.subject).toBe("Dragons");
		expect(entry.details).toMatchObject({
			provider: "curseforge",
			packs: 2,
			betaApis: "off",
		});
	});

	test("enable, disable and remove name the pack and list the linked ones", () => {
		expect(
			packsToggledActivity(
				[
					BEHAVIOR,
					RESOURCE,
				],
				"Dragons BP",
				true,
			),
		).toEqual({
			name: BridgeEventName.ModEnabled,
			text: {
				ar: "تم تفعيل أدون Dragons BP",
				en: "Enabled add-on Dragons BP",
			},
			subject: "Dragons BP",
			details: {
				packs: 2,
				also: "Dragons RP",
			},
		});
		expect(
			packsToggledActivity(
				[
					BEHAVIOR,
				],
				"Dragons BP",
				false,
			).name,
		).toBe(BridgeEventName.ModDisabled);
		expect(
			packsRemovedActivity(
				[
					BEHAVIOR,
				],
				"Dragons BP",
			),
		).toMatchObject({
			name: BridgeEventName.ModRemoved,
			subject: "Dragons BP",
			details: {
				packs: 1,
			},
		});
	});

	test("a reorder is a settings change on the pack order", () => {
		expect(packMovedActivity("Dragons BP", PackMove.Up, 1)).toEqual({
			name: BridgeEventName.SettingsApplied,
			text: {
				ar: "تم نقل أدون Dragons BP لفوق في ترتيب التحميل، وصار رقم 1",
				en: "Moved add-on Dragons BP up the load order, now number 1",
			},
			subject: "Dragons BP",
			details: {
				target: "pack-order",
				pack: "Dragons BP",
				move: "up",
				position: 1,
			},
		});
	});

	test("a repair reports each outcome it counted", () => {
		expect(
			packRepairActivity({
				activated: 2,
				activationFailed: 0,
				installed: 1,
				installFailed: 1,
				betaApis: BetaApisRepair.TurnedOn,
			}),
		).toEqual({
			name: BridgeEventName.SettingsApplied,
			text: {
				ar: "تم إصلاح الأدونات وتفعيل Beta APIs (مثبّتة 1، مفعّلة 2، ما انصلحت 1)",
				en: "Repaired the add-ons and enabled Beta APIs (1 installed, 2 enabled, 1 not fixed)",
			},
			details: {
				target: "pack-repair",
				activated: 2,
				activationFailed: 0,
				installed: 1,
				installFailed: 1,
				betaApis: "turned-on",
			},
		});
		expect(
			packRepairActivity({
				activated: 0,
				activationFailed: 0,
				installed: 3,
				installFailed: 0,
				betaApis: BetaApisRepair.NotNeeded,
			}).text,
		).toEqual({
			ar: "تم إصلاح الأدونات (مثبّتة 3، مفعّلة 0)",
			en: "Repaired the add-ons (3 installed, 0 enabled)",
		});
	});
});
