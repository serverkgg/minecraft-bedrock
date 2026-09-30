import { describe, expect, test } from "bun:test";
import type { Bridge } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { broadcast } from "./broadcast";

const SECRET = "hunter2-super-secret";

const harness = () => {
	const commands: string[] = [];
	const reports: Bridge.Activity[] = [];
	const context = {
		server: {
			running: true,
			publicAddress: null,
		},
		variable: () => SECRET,
		command: async (input: string) => {
			commands.push(input);
			return {
				line: "",
				groups: {},
			};
		},
		log: Object.assign(() => {}, {
			warn: () => {},
			error: () => {},
		}),
		activity: {
			report: (entry: Bridge.Activity) => {
				reports.push(entry);
			},
		},
	} as unknown as Bridge.Context;
	return {
		context,
		commands,
		reports,
	};
};

describe("reporting a broadcast", () => {
	test("a chat message reports its text", async () => {
		const run = harness();
		await broadcast.actions.say?.(run.context, {
			message: "restart in 5 minutes",
		});
		expect(run.reports).toEqual([
			{
				name: BridgeEventName.BroadcastSent,
				text: {
					ar: "تم إرسال رسالة للاعبين: «restart in 5 minutes»",
					en: 'Sent a message to players: "restart in 5 minutes"',
				},
				details: {
					style: "chat",
				},
			},
		]);
		expect(JSON.stringify(run.reports)).not.toContain(SECRET);
	});

	test("a long title is cut to an 80 character excerpt", async () => {
		const run = harness();
		const message = "event ".repeat(40);
		await broadcast.actions.title?.(run.context, {
			message,
		});
		const entry = run.reports.at(0);
		const excerpt = (entry?.text.en ?? "").slice('Showed a title to players: "'.length, -1);
		expect(entry?.name).toBe(BridgeEventName.BroadcastSent);
		expect(entry?.details?.style).toBe("title");
		expect(excerpt.length).toBeLessThanOrEqual(80);
		expect(excerpt.endsWith("…")).toBe(true);
	});
});
