import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { removePacks } from "./packMutation";
import { packs } from "./packs";

const SHARED = "8f3a1b2c-0000-0000-0000-00000000000a";

const LONE = "8f3a1b2c-0000-0000-0000-00000000000b";

const JOURNAL = ".serverk-transaction.json";

const manifestOf = (uuid: string) => {
	return JSON.stringify({
		header: {
			uuid,
			name: uuid,
			version: [
				1,
				0,
				0,
			],
		},
		modules: [
			{
				type: "data",
			},
		],
	});
};

const registryOf = (...uuids: string[]) => {
	return JSON.stringify(
		uuids.map((uuid) => ({
			pack_id: uuid,
			version: [
				1,
				0,
				0,
			],
		})),
	);
};

const harness = (extra: Record<string, string> = {}) => {
	const files = new Map<string, string>([
		[
			`behavior_packs/shared/manifest.json`,
			manifestOf(SHARED),
		],
		[
			`behavior_packs/lone/manifest.json`,
			manifestOf(LONE),
		],
		[
			"worlds/world/world_behavior_packs.json",
			registryOf(SHARED, LONE),
		],
		[
			"worlds/other/world_behavior_packs.json",
			registryOf(SHARED),
		],
		...Object.entries(extra),
	]);
	const writes: string[] = [];
	const scans: string[][] = [];
	const context = {
		server: {
			running: false,
		},
		codec: {
			properties: {
				read: async () => ({
					"level-name": "world",
				}),
			},
		},
		exec: async (args: string[]) => {
			scans.push(args);
			return {
				code: 0,
				stdout: "worlds/world/level.dat\nworlds/other/level.dat",
				stderr: "",
			};
		},
		files: {
			exists: async (path: string) => files.has(path),
			read: async (path: string) => files.get(path) ?? "",
			list: async (
				_glob: string,
				options: {
					directory: string;
				},
			) =>
				[
					...files.keys(),
				]
					.filter((path) => path.startsWith(`${options.directory}/`) && path.endsWith("/manifest.json"))
					.map((path) => ({
						path,
					})),
			write: async (path: string) => {
				writes.push(`write ${path}`);
			},
			remove: async (path: string) => {
				writes.push(`remove ${path}`);
				files.delete(path);
			},
			move: async (from: string, to: string) => {
				writes.push(`move ${from} ${to}`);
			},
			ensure: async (path: string) => {
				writes.push(`ensure ${path}`);
			},
		},
		log: Object.assign(() => {}, {
			warn: () => {},
			error: () => {},
		}),
		activity: {
			report: () => {},
		},
	} as unknown as Bridge.Context;

	return {
		context,
		writes,
		scans,
	};
};

describe("refusing to remove a pack another world still uses", () => {
	it("the refusal comes before anything on disk changes", async () => {
		const run = harness();

		await expect(
			removePacks(run.context, [
				SHARED,
			]),
		).rejects.toThrow("This add-on is used by other worlds or add-ons: other. Remove those references first.");
		expect(run.writes).toEqual([]);
	});

	it("an interrupted change is rolled back first, and the refusal still follows", async () => {
		const run = harness({
			[JOURNAL]: JSON.stringify([
				{
					destination: "behavior_packs/half-written",
					backup: ".serverk-recovery-files/0",
					existed: false,
				},
			]),
		});

		await expect(
			removePacks(run.context, [
				SHARED,
			]),
		).rejects.toThrow("Remove those references first.");
		expect(run.writes).toEqual([
			"remove behavior_packs/half-written",
			`remove ${JOURNAL}`,
			"remove .serverk-recovery-files",
		]);
	});

	it("the panel greys out remove with the same sentence, and leaves a pack only this world uses alone", async () => {
		const run = harness();

		const shared = await packs.unavailable?.(run.context, {
			id: SHARED,
		});
		const lone = await packs.unavailable?.(run.context, {
			id: LONE,
		});

		expect(shared?.remove?.en).toBe(
			"This add-on is used by other worlds or add-ons: other. Remove those references first.",
		);
		expect(lone).toEqual({});
		expect(run.writes).toEqual([]);
	});

	it("one availability pass lists the worlds once, however many packs it answers for", async () => {
		const run = harness();

		const rows = await packs.list(run.context);
		const answers = await Promise.all(rows.map((row) => packs.unavailable?.(run.context, row)));

		expect(rows.length).toBeGreaterThan(1);
		expect(answers.map((answer) => Object.keys(answer ?? {}))).toEqual(
			rows.map((row) =>
				row.id === SHARED
					? [
							"remove",
						]
					: [],
			),
		);
		expect(run.scans.filter((args) => args.at(0) === "find")).toHaveLength(1);
	});
});
