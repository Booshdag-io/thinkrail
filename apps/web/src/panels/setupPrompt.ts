export const SETUP_PROMPT = "/skill:setting-up-a-project ";

export const SETUP_NOTE =
	"Runs the setting-up-a-project skill — the agent drafts your project's specs, starting from its goal, before building.";

export type WorkspaceDialogRequest = { projectId: string; prompt: string; note?: string };

export function setupDialogRequest(projectId: string): WorkspaceDialogRequest {
	return { projectId, prompt: SETUP_PROMPT, note: SETUP_NOTE };
}
