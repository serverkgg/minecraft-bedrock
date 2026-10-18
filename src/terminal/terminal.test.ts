import { describe, expect, it } from "bun:test";
import { BridgeTerminalLevel } from "@serverkgg/bridge";
import { bridgeTerminalRuleSchema } from "@serverkgg/bridge/wire";
import { terminal } from "./terminal";

const levelOf = (line: string) => {
	return (terminal.rules ?? []).find((rule) => rule.match.test(line))?.level ?? null;
};

const PACK_ISSUES_HEADER = "The following issues were found when loading packs:";

const MISSING_MANIFEST = "Unable to find manifest in pack.";

const BETA_APIS_PLUGIN =
	"[2026-09-13 18:02:11:417 ERROR] [Scripting] Plugin [Sky Islands - 1.0.0] - requesting dependency on beta APIs [@minecraft/server - 2.10.0-beta], but the Beta APIs experiment is not enabled.";

const ASSUMED_SCRIPT_ERRORS = [
	"[2026-09-13 18:02:11:417 ERROR] [Scripting] TypeError: cannot read property 'getComponent' of undefined    at <anonymous> (scripts/main.js:14)",
	"[2026-09-13 18:02:11:417 ERROR] [Scripting] ReferenceError: 'playerData' is not defined    at onTick (scripts/main.js:31)",
	"[2026-09-13 18:02:11:417 ERROR] [Scripting] SyntaxError: unexpected token in expression: ')'    at scripts/main.js:7",
];

describe("colouring the lines bedrock prints for a broken add-on", () => {
	it("warns on the header bedrock prints before the packs it could not load", () => {
		expect(levelOf(PACK_ISSUES_HEADER)).toBe(BridgeTerminalLevel.Warn);
		expect(levelOf(`[2026-09-13 18:02:10:902 ERROR] ${PACK_ISSUES_HEADER}`)).toBe(BridgeTerminalLevel.Warn);
	});

	it("warns on the line for a pack that carries no manifest", () => {
		expect(levelOf(MISSING_MANIFEST)).toBe(BridgeTerminalLevel.Warn);
		expect(levelOf(`[2026-09-13 18:02:10:902 ERROR] ${MISSING_MANIFEST}`)).toBe(BridgeTerminalLevel.Warn);
	});

	it("warns on a script error, in the shape we assume bedrock prints it, before the generic error rule", () => {
		for (const line of ASSUMED_SCRIPT_ERRORS) {
			expect(levelOf(line)).toBe(BridgeTerminalLevel.Warn);
		}
	});

	it("keeps the beta apis line an error, because the add-on cannot run until the owner turns the experiment on", () => {
		expect(levelOf(BETA_APIS_PLUGIN)).toBe(BridgeTerminalLevel.Error);
	});

	it("does not warn on a script line that carries no error", () => {
		expect(levelOf("[2026-09-13 18:02:11:417 INFO] [Scripting] Sky Islands loaded")).toBeNull();
	});
});

describe("colouring the rest of the bedrock console", () => {
	it("still reads a world corruption line as an error first", () => {
		expect(levelOf("[2026-09-12 19:04:10:000 INFO] Corruption: block checksum mismatch")).toBe(
			BridgeTerminalLevel.Error,
		);
	});

	it("reads the level bedrock stamps on a line", () => {
		expect(levelOf("[2026-09-12 19:04:10:000 ERROR] Exiting program")).toBe(BridgeTerminalLevel.Error);
		expect(levelOf("[2026-09-12 19:04:10:000 WARN] Something the owner should look at")).toBe(BridgeTerminalLevel.Warn);
	});

	it("reads a player joining as info", () => {
		expect(levelOf("[2026-09-12 19:04:11:288 INFO] Player connected: Meslzy, xuid: 2535412345678901")).toBe(
			BridgeTerminalLevel.Info,
		);
	});

	it("sends every rule across the wire the way the panel reads it", () => {
		for (const rule of terminal.rules ?? []) {
			expect(
				bridgeTerminalRuleSchema.safeParse({
					match: rule.match.source,
					flags: rule.match.flags,
					level: rule.level,
				}).success,
			).toBe(true);
		}
	});
});
