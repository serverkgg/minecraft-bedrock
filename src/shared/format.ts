import type { Bridge } from "@serverkgg/bridge";

export const sizeForReport = async (context: Bridge.Context, path: string): Promise<number | null> => {
	try {
		return await context.files.size(path);
	} catch (error) {
		context.log.warn("could not measure an upload for its activity entry", {
			path,
			reason: error instanceof Error ? error.message : String(error),
		});

		return null;
	}
};
