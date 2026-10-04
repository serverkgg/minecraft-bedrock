import { describe, expect, it } from "bun:test";
import type { BridgeSection, BridgeSectionAction } from "@serverkgg/bridge";
import { BridgeLayout, BridgeSetupStepKind } from "@serverkgg/bridge";
import { BRIDGE_EVENT_NAMES } from "@serverkgg/bridge/protocol";
import { driver } from "./driver";

const modules = driver.modules ?? {};

const sections = (driver.panel?.tabs ?? []).flatMap((tab) => tab.sections);

const actionsOf = (section: BridgeSection): BridgeSectionAction[] => {
	return "actions" in section ? (section.actions ?? []) : [];
};

const tables = sections.flatMap((section) => {
	return section.layout === BridgeLayout.Table
		? [
				section,
			]
		: [];
});

const columnsOf = (module: string) => {
	return tables
		.filter((table) => table.module === module)
		.flatMap((table) => table.columns.map((column) => column.key));
};

const formSection = (tab: string, section: string) => {
	return (driver.panel?.tabs ?? [])
		.filter((candidate) => candidate.id === tab)
		.flatMap((candidate) => candidate.sections)
		.find((candidate) => candidate.id === section && candidate.layout === BridgeLayout.Form);
};

const commands = driver.terminal?.commands ?? [];

const RESERVED_MODULE_IDS = [
	"announce",
	"backup",
	"events",
	"install",
	"lifecycle",
	"pending",
	"query",
	"setup",
];

const ROOT = new URL("..", import.meta.url).pathname;

describe("validating the driver the way the platform does", () => {
	it("passes the same validateDriver run that happens at publish and at boot", () => {
		const result = Bun.spawnSync(
			[
				`${ROOT}node_modules/.bin/serverk-bridge`,
				"validate",
			],
			{
				cwd: ROOT,
				stdout: "pipe",
				stderr: "pipe",
			},
		);

		expect(`${result.stdout.toString()}${result.stderr.toString()}`).toContain("bedrock is valid");
		expect(result.exitCode).toBe(0);
	});
});

describe("assembling the bedrock driver", () => {
	it("declares the two capabilities the platform cannot boot without", () => {
		expect(driver.install).toBeDefined();
		expect(driver.lifecycle).toBeDefined();
	});

	it("keeps every panel section bound to a module the driver actually registers", () => {
		for (const section of sections) {
			const module = section.module;

			if (module === undefined) {
				continue;
			}

			expect(Object.keys(modules)).toContain(module);
		}
	});

	it("never registers a module id the runtime reserves for a top-level capability", () => {
		for (const id of RESERVED_MODULE_IDS) {
			expect(Object.keys(modules)).not.toContain(id);
		}
	});

	it("emits only event names the platform taxonomy carries", () => {
		const emitted = [
			...(driver.events?.patterns ?? []).map((pattern) => pattern.emit),
			...(driver.events?.emits ?? []),
		];

		for (const name of emitted) {
			expect(BRIDGE_EVENT_NAMES).toContain(name);
		}
	});
});

describe("refusing to promise what bedrock cannot do", () => {
	it("raises no ban, death or advancement event, because BDS reports none of them", () => {
		const emitted = [
			...(driver.events?.patterns ?? []).map((pattern) => pattern.emit),
			...(driver.events?.emits ?? []),
		];

		expect(emitted).not.toContain("player-banned");
		expect(emitted).not.toContain("player-died");
		expect(emitted).not.toContain("player-advanced");
	});

	it("offers no ban action and no per-dimension reset, because bedrock has neither", () => {
		const actionIds = sections.flatMap((section) => actionsOf(section).map((action) => action.id));

		expect(actionIds).not.toContain("ban");
		expect(actionIds).not.toContain("resetNether");
		expect(actionIds).not.toContain("resetEnd");
	});

	it("declares no pending module, because nothing about bedrock waits on a companion upload", () => {
		expect(driver.pending).toBeUndefined();
	});
});

describe("wiring the console the panel offers", () => {
	it("binds every command argument to a table column that is really rendered", () => {
		for (const command of commands) {
			for (const arg of command.args ?? []) {
				if (arg.module === undefined || arg.column === undefined) {
					continue;
				}

				expect(Object.keys(modules)).toContain(arg.module);
				expect(columnsOf(arg.module)).toContain(arg.column);
			}
		}
	});

	it("names every command once", () => {
		const names = commands.map((command) => command.name);

		expect(new Set(names).size).toBe(names.length);
	});

	it("writes every summary in both languages, because the console is customer-facing", () => {
		for (const command of commands) {
			expect(command.summary.ar.length).toBeGreaterThan(0);
			expect(command.summary.en.length).toBeGreaterThan(0);
		}
	});

	it("flags the commands that stop the server or destroy something", () => {
		for (const name of [
			"stop",
			"kick",
			"kill",
			"fill",
			"clear",
		]) {
			expect(commands.find((command) => command.name === name)?.danger).toBe(true);
		}
	});

	it("offers no say command, because bedrock has none — tellraw is the one that works", () => {
		expect(commands.map((command) => command.name)).not.toContain("say");
	});
});

describe("wiring the first-run setup", () => {
	it("points every form step at a form section this panel really declares", () => {
		for (const step of driver.setup?.steps ?? []) {
			if (step.kind !== BridgeSetupStepKind.Form) {
				continue;
			}

			const section = formSection(step.tab, step.section);

			expect(section).toBeDefined();

			const keys = (section?.layout === BridgeLayout.Form ? section.fields : []).map((entry) => entry.key);

			for (const field of step.fields ?? []) {
				expect(keys).toContain(field);
			}
		}
	});

	it("leaves every step optional, because a fresh bedrock server already runs", () => {
		for (const step of driver.setup?.steps ?? []) {
			expect(step.required).toBe(false);
		}
	});

	it("declares no driver step, so the flow needs no submit handler", () => {
		expect(driver.setup?.submit).toBeUndefined();
	});
});
