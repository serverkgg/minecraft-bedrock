import type { Bridge } from "@serverkgg/bridge";

const BYTE_UNITS = [
	"B",
	"KB",
	"MB",
	"GB",
	"TB",
];

export const formatByteSize = (bytes: number) => {
	let size = Math.max(bytes, 0);
	let unit = 0;

	while (size >= 1024 && unit < BYTE_UNITS.length - 1) {
		size /= 1024;
		unit += 1;
	}

	const rounded = unit === 0 ? Math.round(size) : Number(size.toFixed(size >= 10 ? 0 : 1));

	return `${rounded} ${BYTE_UNITS[unit]}`;
};

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
