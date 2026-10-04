import { type Bridge, BridgeUserError } from "@serverkgg/bridge";

const JOURNAL = ".serverk-transaction.json";
const RECOVERY = ".serverk-recovery-files";
interface Replacement {
	source: string;
	destination: string;
}
interface Entry {
	destination: string;
	backup: string;
	existed: boolean;
}

export const requireStopped = (context: Bridge.Context) => {
	if (context.server.running) {
		throw new BridgeUserError({
			ar: "وقّف السيرفر قبل تعديل المابات أو الإضافات لحماية ملفاتك.",
			en: "Stop the server before changing worlds or add-ons to protect your files.",
		});
	}
};

const safePath = (path: string) =>
	path.length > 0
	&& !path.startsWith("/")
	&& !path.includes("\\")
	&& path.split("/").every((part) => part.length > 0 && part !== "." && part !== "..");

export const recoverFileTransaction = async (context: Bridge.Context) => {
	if (!(await context.files.exists(JOURNAL))) {
		return;
	}
	const raw: unknown = JSON.parse(await context.files.read(JOURNAL));
	if (!Array.isArray(raw)) {
		throw new Error("invalid file transaction journal");
	}
	for (const value of raw.reverse()) {
		if (value === null || typeof value !== "object") {
			throw new Error("invalid file transaction entry");
		}
		const entry = value as Partial<Entry>;
		if (
			typeof entry.destination !== "string"
			|| !safePath(entry.destination)
			|| typeof entry.backup !== "string"
			|| !entry.backup.startsWith(`${RECOVERY}/`)
			|| !safePath(entry.backup)
			|| typeof entry.existed !== "boolean"
		) {
			throw new Error("unsafe file transaction entry");
		}
		if (await context.files.exists(entry.backup)) {
			await context.files.remove(entry.destination);
			await context.files.move(entry.backup, entry.destination);
		} else if (!entry.existed) {
			await context.files.remove(entry.destination);
		}
	}
	await context.files.remove(JOURNAL);
	await context.files.remove(RECOVERY);
};

export const publishFiles = async (context: Bridge.Context, replacements: Replacement[], removed: string[] = []) => {
	requireStopped(context);
	await recoverFileTransaction(context);
	const destinations = [
		...new Set([
			...replacements.map((entry) => entry.destination),
			...removed,
		]),
	];
	if (destinations.some((path) => !safePath(path)) || replacements.some((entry) => !safePath(entry.source))) {
		throw new Error("unsafe file transaction path");
	}
	const journal: Entry[] = [];
	for (const [index, destination] of destinations.entries()) {
		journal.push({
			destination,
			backup: `${RECOVERY}/${index}`,
			existed: await context.files.exists(destination),
		});
	}
	await context.files.remove(RECOVERY);
	await context.files.ensure(RECOVERY);
	await context.files.write(JOURNAL, JSON.stringify(journal));
	try {
		for (const entry of journal) {
			if (entry.existed) {
				await context.files.move(entry.destination, entry.backup);
			}
		}
		for (const entry of replacements) {
			const separator = entry.destination.lastIndexOf("/");
			if (separator > 0) {
				await context.files.ensure(entry.destination.slice(0, separator));
			}
			await context.files.move(entry.source, entry.destination);
		}
		await context.files.remove(JOURNAL);
	} catch (error) {
		await recoverFileTransaction(context);
		throw error;
	}
	await context.files.remove(RECOVERY);
};
