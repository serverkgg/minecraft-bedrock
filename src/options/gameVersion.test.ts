import { describe, expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { gameVersion } from "./gameVersion";

describe("listing builds while the download service has none", () => {
	test("logs the raw cause beside the friendly reason and still offers the installed build", async () => {
		const warnings: Bridge.Values[] = [];
		const context = {
			variable: () => "release",
			net: {
				json: async () => ({
					result: {
						links: [],
					},
				}),
			},
			files: {
				exists: async () => false,
			},
			log: Object.assign(() => {}, {
				warn: (_message: string, fields: Bridge.Values) => {
					warnings.push(fields);
				},
				error: () => {},
			}),
			activity: {
				report: () => {},
			},
		} as unknown as Bridge.Context;
		const options = await gameVersion.list(context);
		expect(options).toHaveLength(1);
		expect(warnings).toEqual([
			{
				reason:
					"Mojang's download service has no Bedrock server build on the Release channel right now. Try again in a bit.",
				cause: "the download service listed no serverBedrockLinux build",
			},
		]);
	});
});
