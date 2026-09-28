import { describe, expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { publishFiles, recoverFileTransaction, requireStopped } from "./fileTransaction";

const fixture = (initial: Record<string, string>, failOn?: string) => {
	const files = new Map(Object.entries(initial));
	const context = {
		server: {
			running: false,
			publicAddress: null,
		},
		portBlock: () => ({
			first: 20_000,
			count: 64,
		}),
		files: {
			exists: async (path: string) => files.has(path),
			read: async (path: string) => files.get(path) ?? "",
			write: async (path: string, value: string) => {
				files.set(path, value);
			},
			ensure: async () => {},
			remove: async (path: string) => {
				for (const key of files.keys()) {
					if (key === path || key.startsWith(`${path}/`)) {
						files.delete(key);
					}
				}
			},
			move: async (from: string, to: string) => {
				if (from === failOn) {
					throw new Error("disk full");
				}
				const value = files.get(from);
				if (value === undefined) {
					throw new Error(`missing ${from}`);
				}
				files.set(to, value);
				files.delete(from);
			},
		},
	} as unknown as Bridge.Context;
	return {
		context,
		files,
	};
};

describe("publishing a staged update", () => {
	test("restores all old files after a failure midway through replacement", async () => {
		const { context, files } = fixture(
			{
				binary: "old",
				config: "old-config",
				"stage/binary": "new",
				"stage/config": "new-config",
			},
			"stage/config",
		);
		await expect(
			publishFiles(context, [
				{
					source: "stage/binary",
					destination: "binary",
				},
				{
					source: "stage/config",
					destination: "config",
				},
			]),
		).rejects.toThrow("disk full");
		expect(files.get("binary")).toBe("old");
		expect(files.get("config")).toBe("old-config");
		expect(files.has(".serverk-transaction.json")).toBe(false);
	});
	test("recovers an interrupted operation before publishing another one", async () => {
		const { context, files } = fixture({
			binary: "half-installed",
			".serverk-recovery-files/0": "old",
			".serverk-transaction.json": JSON.stringify([
				{
					destination: "binary",
					backup: ".serverk-recovery-files/0",
					existed: true,
				},
			]),
		});
		await recoverFileTransaction(context);
		expect(files.get("binary")).toBe("old");
	});
	test("rejects a running server before moving files", async () => {
		const { context, files } = fixture({
			binary: "old",
			"stage/binary": "new",
		});
		context.server.running = true;
		expect(() => requireStopped(context)).toThrow();
		await expect(
			publishFiles(context, [
				{
					source: "stage/binary",
					destination: "binary",
				},
			]),
		).rejects.toThrow();
		expect(files.get("binary")).toBe("old");
	});
	test("rejects traversal destinations before journaling", async () => {
		const { context, files } = fixture({
			"stage/binary": "new",
		});
		await expect(
			publishFiles(context, [
				{
					source: "stage/binary",
					destination: "../binary",
				},
			]),
		).rejects.toThrow();
		expect(files.has(".serverk-transaction.json")).toBe(false);
	});
});
