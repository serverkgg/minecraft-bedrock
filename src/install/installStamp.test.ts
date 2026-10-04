import { describe, expect, it } from "bun:test";
import { ReleaseChannel } from "./channel";
import { normalizeStamp } from "./installStamp";

describe("reading the install stamp back", () => {
	it("keeps what a previous install recorded", () => {
		const stamp = normalizeStamp({
			channel: "preview",
			version: "1.26.60.23",
			label: "1.26.60.23",
			files: [
				"bedrock_server",
				"behavior_packs",
			],
			packs: [
				"vanilla",
			],
		});

		expect(stamp).toEqual({
			channel: ReleaseChannel.Preview,
			version: "1.26.60.23",
			label: "1.26.60.23",
			files: [
				"bedrock_server",
				"behavior_packs",
			],
			packs: [
				"vanilla",
			],
		});
	});

	it("answers null for a stamp with no version, so a garbage file reinstalls instead of throwing", () => {
		expect(normalizeStamp(null)).toBeNull();
		expect(normalizeStamp({})).toBeNull();
		expect(
			normalizeStamp({
				version: "",
			}),
		).toBeNull();
		expect(
			normalizeStamp({
				version: 1126,
			}),
		).toBeNull();
	});

	it("falls back to the release channel when the stamp names one that no longer exists", () => {
		expect(
			normalizeStamp({
				version: "1.26.45.1",
				channel: "beta",
			})?.channel,
		).toBe(ReleaseChannel.Release);
	});

	it("falls back to the version when no label was recorded", () => {
		expect(
			normalizeStamp({
				version: "1.26.45.1",
			})?.label,
		).toBe("1.26.45.1");
	});

	it("drops non-strings out of the file list, because that list drives what an upgrade deletes", () => {
		expect(
			normalizeStamp({
				version: "1.26.45.1",
				files: [
					"bedrock_server",
					7,
					null,
				],
			})?.files,
		).toEqual([
			"bedrock_server",
		]);
	});
});

describe("resolving the installed build after restart or restore", () => {
	it("keeps an exact installed version when the selection is automatic", async () => {
		const { selectedInstallVersion } = await import("./install");
		const stamp = normalizeStamp({
			channel: "release",
			version: "1.26.45.1",
		});
		expect(selectedInstallVersion(null, ReleaseChannel.Release, stamp)).toBe("1.26.45.1");
	});
	it("only chooses latest for first install or a different channel", async () => {
		const { selectedInstallVersion } = await import("./install");
		const stamp = normalizeStamp({
			channel: "release",
			version: "1.26.45.1",
		});
		expect(selectedInstallVersion(null, ReleaseChannel.Preview, stamp)).toBeNull();
		expect(selectedInstallVersion(null, ReleaseChannel.Release, null)).toBeNull();
		expect(selectedInstallVersion("1.26.46.1", ReleaseChannel.Release, stamp)).toBe("1.26.46.1");
	});
});
