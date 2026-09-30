import { describe, expect, test } from "bun:test";
import { BridgeUserError } from "@serverkgg/bridge";
import { ReleaseChannel } from "./channel";
import { type LinksResponse, linkOf, releaseOf, urlForVersion, versionFromUrl } from "./releases";

const PAYLOAD: LinksResponse = {
	result: {
		links: [
			{
				downloadType: "serverBedrockWindows",
				downloadUrl: "https://www.minecraft.net/bedrockdedicatedserver/bin-win/bedrock-server-1.26.45.1.zip",
			},
			{
				downloadType: "serverBedrockLinux",
				downloadUrl: "https://www.minecraft.net/bedrockdedicatedserver/bin-linux/bedrock-server-1.26.45.1.zip",
			},
			{
				downloadType: "serverBedrockPreviewLinux",
				downloadUrl: "https://www.minecraft.net/bedrockdedicatedserver/bin-linux-preview/bedrock-server-1.26.60.23.zip",
			},
			{
				downloadType: "serverJar",
				downloadUrl: "https://piston-data.mojang.com/v1/objects/823e/server.jar",
			},
		],
	},
};

describe("reading a build out of mojang's download list", () => {
	test("picks the linux server and never the windows one or the java jar", () => {
		expect(linkOf(PAYLOAD, ReleaseChannel.Release)).toContain("bin-linux/bedrock-server-1.26.45.1.zip");
	});

	test("picks the preview build for the preview channel", () => {
		expect(linkOf(PAYLOAD, ReleaseChannel.Preview)).toContain("bin-linux-preview/bedrock-server-1.26.60.23.zip");
	});

	test("reads the build number off the url, which is the only place it is published", () => {
		expect(versionFromUrl("https://x/bedrock-server-1.26.45.1.zip")).toBe("1.26.45.1");
		expect(versionFromUrl("https://x/bedrock-server-1.21.44.zip")).toBe("1.21.44");
	});

	test("answers null for a url that carries no build number, rather than guessing one", () => {
		expect(versionFromUrl("https://x/bedrock-server.zip")).toBeNull();
	});

	test("resolves the latest build when nothing is pinned", () => {
		const release = releaseOf(PAYLOAD, ReleaseChannel.Release, null);

		expect(release.version).toBe("1.26.45.1");
		expect(release.channel).toBe(ReleaseChannel.Release);
	});

	test("rewrites the url to the pinned build, so a server does not silently jump versions", () => {
		const release = releaseOf(PAYLOAD, ReleaseChannel.Release, "1.26.30.4");

		expect(release.version).toBe("1.26.30.4");
		expect(release.url).toContain("bedrock-server-1.26.30.4.zip");
		expect(urlForVersion("https://x/bedrock-server-1.26.45.1.zip", "1.21.0.3")).toBe(
			"https://x/bedrock-server-1.21.0.3.zip",
		);
	});

	test("refuses a pinned version that is not a build number, with a message the player can act on", () => {
		expect(() => releaseOf(PAYLOAD, ReleaseChannel.Release, "latest")).toThrow();
	});

	test("throws when the service lists no build for the channel at all", () => {
		expect(() =>
			releaseOf(
				{
					result: {
						links: [],
					},
				},
				ReleaseChannel.Release,
				null,
			),
		).toThrow();
	});
});

const failureOf = (run: () => unknown) => {
	try {
		run();
	} catch (error) {
		return error;
	}
	return null;
};

describe("telling the owner the download service has no build", () => {
	test("names the channel in both languages and keeps the raw reason for staff", () => {
		const failure = failureOf(() =>
			releaseOf(
				{
					result: {
						links: [],
					},
				},
				ReleaseChannel.Preview,
				null,
			),
		);

		expect(failure).toBeInstanceOf(BridgeUserError);
		expect(failure instanceof BridgeUserError ? failure.text : null).toEqual({
			ar: "خدمة تحميل موجانق ما فيها نسخة سيرفر بيدروك لقناة بريفيو الحين. جرّب بعد شوي.",
			en: "Mojang's download service has no Bedrock server build on the Preview channel right now. Try again in a bit.",
		});
		expect(failure instanceof Error && failure.cause instanceof Error ? failure.cause.message : "").toBe(
			"the download service listed no serverBedrockPreviewLinux build",
		);
	});

	test("says the same when the build url cannot be read, and keeps the url in the cause", () => {
		const failure = failureOf(() =>
			releaseOf(
				{
					result: {
						links: [
							{
								downloadType: "serverBedrockLinux",
								downloadUrl: "https://x/bedrock-server.zip",
							},
						],
					},
				},
				ReleaseChannel.Release,
				null,
			),
		);

		expect(failure instanceof BridgeUserError ? failure.text.en : "").toBe(
			"Mojang's download service has no Bedrock server build on the Release channel right now. Try again in a bit.",
		);
		expect(failure instanceof Error && failure.cause instanceof Error ? failure.cause.message : "").toBe(
			"the download service answered with an unreadable build url: https://x/bedrock-server.zip",
		);
	});
});
