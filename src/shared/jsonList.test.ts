import { describe, expect, it } from "bun:test";
import { parseJsonList } from "./jsonList";

describe("reading the top-level json arrays bedrock configures itself with", () => {
	it("reads an array of objects, which is what allowlist.json and permissions.json are", () => {
		expect(parseJsonList('[{"name":"Meslzy"}]')).toEqual([
			{
				name: "Meslzy",
			},
		]);
	});

	it("answers empty for an object, because the codec the bridge ships cannot read these files", () => {
		expect(parseJsonList('{"name":"Meslzy"}')).toEqual([]);
	});

	it("answers empty for malformed json instead of throwing, so a corrupt file cannot brick the panel", () => {
		expect(parseJsonList("[{名")).toEqual([]);
	});

	it("answers empty for an empty file", () => {
		expect(parseJsonList("")).toEqual([]);
	});
});
