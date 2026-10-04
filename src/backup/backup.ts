import { type Bridge, BridgeKind, BridgeUserError } from "@serverkgg/bridge";
import { holding, holdSave, resumeSave } from "./bedrockSave";

export const backup: Bridge.Backup = {
	kind: BridgeKind.Backup,
	settleSeconds: 0,

	async quiesce(context) {
		if (holding()) {
			throw new Error("a backup already owns the world save hold");
		}
		try {
			const snapshot = await holdSave(context);
			context.log("prepared the world file boundaries for the backup");
			return {
				snapshot,
			};
		} catch (error) {
			await resumeSave(context);

			context.log.error("could not freeze the world for a backup", {
				reason: error instanceof Error ? error.message : String(error),
			});

			throw new BridgeUserError({
				ar: "لم يستجب السيرفر أثناء تجهيز الماب للنسخ، جرب مرة ثانية. وإذا تكرر ذلك، وقّف السيرفر وخذ النسخة الاحتياطية وهو متوقف.",
				en: "The server didn't respond while it was preparing the world for the backup. Try again, and if it keeps happening, stop the server and take the backup while it's stopped.",
			});
		}
	},

	async release(context) {
		await resumeSave(context);
	},
};
