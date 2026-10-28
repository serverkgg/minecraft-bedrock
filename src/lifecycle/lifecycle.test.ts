import { describe, expect, it } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { lifecycle } from "./lifecycle";
import { startCommand } from "./startCommand";

describe("lifecycle", () => {
	it("starts bedrock through the wrapper that waits for the game port", async () => {
		const ports: string[] = [];
		const context = {
			port: (key: string) => {
				ports.push(key);

				return 19_133;
			},
		} as unknown as Bridge.Context;

		expect(await lifecycle.command(context)).toEqual(startCommand(19_133));
		expect(ports).toEqual([
			"game",
		]);
	});
});
