import { describe, expect, it } from "bun:test";
import { type Bridge, BridgeUserError } from "@serverkgg/bridge";
import { BridgeEventName } from "@serverkgg/bridge/protocol";
import { install } from "./install";

const SECRET = "hunter2-super-secret";

const fixture = (
	binary: boolean,
	selected: string | null,
	unavailable = false,
	stamped = true,
	channel = "release",
	stampChannel = "release",
) => {
	let current = selected;
	const files = new Map<string, string>(
		stamped
			? [
					[
						".serverk-install.json",
						JSON.stringify({
							channel: stampChannel,
							version: "1.26.45.1",
							label: "1.26.45.1",
							files: [
								"bedrock_server",
							],
							packs: [],
						}),
					],
				]
			: [],
	);
	const reports: Bridge.Activity[] = [];
	const emitted: string[] = [];
	if (binary) {
		files.set("bedrock_server", "old binary");
	}
	const downloads: string[] = [];
	let lookups = 0;
	const context = {
		server: {
			running: false,
			publicAddress: null,
		},
		portBlock: () => ({
			first: 20_000,
			count: 64,
		}),
		variable: (name: string) => {
			if (name === "BEDROCK_CHANNEL") {
				return channel;
			}
			return name === "BEDROCK_VERSION" ? current : SECRET;
		},
		port: () => 19_132,
		emit: (event: string) => {
			emitted.push(event);
		},
		codec: {
			properties: {
				read: async () => ({}),
				merge: async () => {},
			},
		},
		net: {
			json: async () => {
				lookups++;
				return {
					result: {
						links: [
							{
								downloadType: "serverBedrockLinux",
								downloadUrl: "https://www.minecraft.net/bedrockdedicatedserver/bin-linux/bedrock-server-1.26.99.1.zip",
							},
							{
								downloadType: "serverBedrockPreviewLinux",
								downloadUrl:
									"https://www.minecraft.net/bedrockdedicatedserver/bin-linux-preview/bedrock-server-1.26.60.28.zip",
							},
						],
					},
				};
			},
		},
		log: Object.assign(() => {}, {
			warn: () => {},
			error: () => {},
		}),
		exec: async () => ({
			code: 0,
			stdout: "",
			stderr: "",
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
			move: async (source: string, target: string) => {
				const value = files.get(source);
				if (value === undefined) {
					throw new Error("missing staged file");
				}
				if (files.has(target)) {
					throw new Error("target exists");
				}
				files.set(target, value);
				files.delete(source);
			},
			download: async (path: string, url: string) => {
				downloads.push(url);
				if (unavailable) {
					throw new Error("download unavailable");
				}
				files.set(path, "archive");
			},
			extract: async (_path: string, destination: string) => {
				files.set(`${destination}/bedrock_server`, "new binary");
				return [
					`${destination}/bedrock_server`,
				];
			},
		},
		activity: {
			report: (entry: Bridge.Activity) => {
				reports.push(entry);
			},
		},
	} as unknown as Bridge.Context;
	return {
		context,
		files,
		reports,
		emitted,
		downloads,
		lookups: () => lookups,
		select: (value: string | null) => {
			current = value;
		},
	};
};

describe("restoring exact Bedrock builds", () => {
	it("ordinary automatic-selection restart does not look up or download latest", async () => {
		const run = fixture(true, null);
		await install.run(run.context);
		expect(run.lookups()).toBe(0);
		expect(run.downloads).toEqual([]);
		expect(run.files.get("bedrock_server")).toBe("old binary");
	});
	it("a restored stamp with no runtime reinstalls that concrete build", async () => {
		const run = fixture(false, null);
		await install.run(run.context);
		expect(run.downloads).toEqual([
			"https://www.minecraft.net/bedrockdedicatedserver/bin-linux/bedrock-server-1.26.45.1.zip",
		]);
		expect(JSON.parse(run.files.get(".serverk-install.json") ?? "{}").version).toBe("1.26.45.1");
	});
	it("an unavailable explicitly selected build fails without deleting the working runtime", async () => {
		const run = fixture(true, "1.26.90.1", true);
		await expect(install.run(run.context)).rejects.toThrow("We couldn't download Bedrock 1.26.90.1. Try again.");
		expect(run.files.get("bedrock_server")).toBe("old binary");
		expect(JSON.parse(run.files.get(".serverk-install.json") ?? "{}").version).toBe("1.26.45.1");
	});
});

describe("following the latest build through a delivered pin", () => {
	it("a delivered build installs exactly that build from the preview link on preview", async () => {
		const run = fixture(true, "1.26.70.21", false, true, "preview", "preview");
		await install.run(run.context);
		expect(run.downloads).toEqual([
			"https://www.minecraft.net/bedrockdedicatedserver/bin-linux-preview/bedrock-server-1.26.70.21.zip",
		]);
		expect(JSON.parse(run.files.get(".serverk-install.json") ?? "{}")).toMatchObject({
			channel: "preview",
			version: "1.26.70.21",
		});
	});

	it("a delivered build on release installs from the release link", async () => {
		const run = fixture(true, "1.26.52.3");
		await install.run(run.context);
		expect(run.downloads).toEqual([
			"https://www.minecraft.net/bedrockdedicatedserver/bin-linux/bedrock-server-1.26.52.3.zip",
		]);
	});

	it("an empty value after the update keeps the delivered build on the next container", async () => {
		const run = fixture(true, "1.26.52.3");
		await install.run(run.context);
		run.select(null);
		await install.run(run.context);
		expect(run.downloads).toEqual([
			"https://www.minecraft.net/bedrockdedicatedserver/bin-linux/bedrock-server-1.26.52.3.zip",
		]);
		expect(run.lookups()).toBe(1);
		expect(JSON.parse(run.files.get(".serverk-install.json") ?? "{}").version).toBe("1.26.52.3");
	});
});

describe("telling the owner what the install did", () => {
	it("reports the first install with its channel and build", async () => {
		const run = fixture(false, null, false, false);
		await install.run(run.context);
		expect(run.reports).toEqual([
			{
				name: BridgeEventName.GameInstalled,
				text: {
					ar: "تم تثبيت سيرفر بيدروك 1.26.99.1 على قناة الإصدار العادي",
					en: "Installed Bedrock server 1.26.99.1 on the Release channel",
				},
				subject: "1.26.99.1",
				details: {
					channel: "release",
					version: "1.26.99.1",
				},
			},
		]);
		expect(JSON.stringify(run.reports)).not.toContain(SECRET);
	});

	it("keeps the ServerUpdated event and reports the update with the channel and both builds", async () => {
		const run = fixture(true, "1.26.99.1");
		await install.run(run.context);
		expect(run.emitted).toEqual([
			BridgeEventName.ServerUpdated,
		]);
		expect(run.reports).toEqual([
			{
				name: BridgeEventName.ServerUpdated,
				text: {
					ar: "تم تحديث سيرفر بيدروك من 1.26.45.1 إلى 1.26.99.1 على قناة الإصدار العادي",
					en: "Updated Bedrock server from 1.26.45.1 to 1.26.99.1 on the Release channel",
				},
				subject: "1.26.99.1",
				details: {
					from: "1.26.45.1",
					to: "1.26.99.1",
					channel: "release",
				},
			},
		]);
	});

	it("reports a channel change with both channels and both builds, and keeps main's plain event behaviour", async () => {
		const run = fixture(true, null, false, true, "preview");
		await install.run(run.context);
		expect(JSON.parse(run.files.get(".serverk-install.json") ?? "{}")).toMatchObject({
			channel: "preview",
			version: "1.26.60.28",
		});
		expect(run.emitted).toEqual([]);
		expect(run.reports).toEqual([
			{
				name: BridgeEventName.ServerUpdated,
				text: {
					ar: "تم تحديث سيرفر بيدروك من 1.26.45.1 على قناة الإصدار العادي إلى 1.26.60.28 على قناة بريفيو",
					en: "Updated Bedrock server from 1.26.45.1 on the Release channel to 1.26.60.28 on the Preview channel",
				},
				subject: "1.26.60.28",
				details: {
					from: "1.26.45.1",
					to: "1.26.60.28",
					channel: "preview",
					previousChannel: "release",
				},
			},
		]);
		expect(JSON.stringify(run.reports)).not.toContain(SECRET);
	});

	it("reports nothing when the installed build is kept", async () => {
		const run = fixture(true, null);
		await install.run(run.context);
		expect(run.reports).toEqual([]);
	});

	it("turns a failed download into localized text and keeps the raw reason as the cause", async () => {
		const run = fixture(false, null, true, false);
		const failure = await install.run(run.context).then(
			() => null,
			(error: unknown) => error,
		);
		expect(failure).toBeInstanceOf(BridgeUserError);
		expect(failure instanceof BridgeUserError ? failure.text.ar : "").toBe(
			"تعذّر تنزيل Bedrock 1.26.99.1، جرب مرة ثانية.",
		);
		expect(failure instanceof Error && failure.cause instanceof Error ? failure.cause.message : "").toBe(
			"download unavailable",
		);
	});
});
