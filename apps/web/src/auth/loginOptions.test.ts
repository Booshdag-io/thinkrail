import { expect, test } from "bun:test";
import { loginOptionParts, loginSelectMessage } from "./loginOptions";

test("loginSelectMessage drops pi's terminal-style trailing colon", () => {
	expect(loginSelectMessage("Select Anthropic login method:")).toBe(
		"Select Anthropic login method",
	);
	expect(loginSelectMessage("Pick one")).toBe("Pick one");
});

test("loginOptionParts turns a trailing parenthetical into a detail or the recommended mark", () => {
	expect(loginOptionParts("Browser login (default)")).toEqual({
		title: "Browser login",
		recommended: true,
	});
	expect(loginOptionParts("Copy code login (headless)")).toEqual({
		title: "Copy code login",
		detail: "Headless",
		recommended: false,
	});
	expect(loginOptionParts("GitHub.com")).toEqual({ title: "GitHub.com", recommended: false });
	expect(loginOptionParts("(default)")).toEqual({ title: "(default)", recommended: false });
});
