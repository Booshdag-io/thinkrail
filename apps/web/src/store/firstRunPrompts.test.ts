import { expect, test } from "bun:test";
import { ONBOARDING_PROTOCOL_VERSION } from "@thinkrail/contracts";
import type { OnboardingWizardGate } from "./appStore";
import { selectFirstRunPromptsHeld } from "./selectors";

const coldStart = {
	protocolVersion: ONBOARDING_PROTOCOL_VERSION,
	onboardingWizard: "pending" as OnboardingWizardGate,
	onboardingDismissed: false,
	projects: [],
	recentProjects: [],
};

test("first-run prompts wait while the wizard is undecided on a cold start, or showing", () => {
	expect(selectFirstRunPromptsHeld(coldStart)).toBe(true);
	expect(selectFirstRunPromptsHeld({ ...coldStart, onboardingWizard: "shown" })).toBe(true);
	expect(
		selectFirstRunPromptsHeld({ ...coldStart, onboardingWizard: "shown", projects: [{}] }),
	).toBe(true);
});

test("first-run prompts are free once the wizard is decided against, done, or impossible", () => {
	expect(selectFirstRunPromptsHeld({ ...coldStart, onboardingWizard: "hidden" })).toBe(false);
	expect(selectFirstRunPromptsHeld({ ...coldStart, onboardingDismissed: true })).toBe(false);
	expect(
		selectFirstRunPromptsHeld({
			...coldStart,
			onboardingWizard: "shown",
			onboardingDismissed: true,
		}),
	).toBe(false);
	expect(selectFirstRunPromptsHeld({ ...coldStart, recentProjects: [{}] })).toBe(false);
	expect(selectFirstRunPromptsHeld({ ...coldStart, projects: [{}] })).toBe(false);
	expect(
		selectFirstRunPromptsHeld({ ...coldStart, protocolVersion: ONBOARDING_PROTOCOL_VERSION - 1 }),
	).toBe(false);
	expect(selectFirstRunPromptsHeld({ ...coldStart, protocolVersion: null })).toBe(false);
});
