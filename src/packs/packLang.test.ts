import { describe, expect, it } from "bun:test";
import { looksLocalized, parseLang } from "./packLang";

describe("reading a pack's .lang file", () => {
	it("reads key=value lines", () => {
		expect(parseLang("pack.name=Cool Addon").get("pack.name")).toBe("Cool Addon");
	});

	it("keeps an equals sign inside the value, splitting only on the first one", () => {
		expect(parseLang("pack.name=a=b").get("pack.name")).toBe("a=b");
	});

	it("drops the trailing ## comment bedrock allows", () => {
		expect(parseLang("pack.name=Cool Addon ##the title").get("pack.name")).toBe("Cool Addon");
	});

	it("ignores comment and blank lines", () => {
		expect(parseLang("#comment\n\npack.name=X").size).toBe(1);
	});
});

describe("deciding whether a header name needs resolving at all", () => {
	it("treats a dotted token as a localization key", () => {
		expect(looksLocalized("pack.name")).toBe(true);
	});

	it("treats a written-out name as the name itself, which is the common case", () => {
		expect(looksLocalized("My Cool Addon")).toBe(false);
		expect(looksLocalized("CoolAddon")).toBe(false);
	});
});
