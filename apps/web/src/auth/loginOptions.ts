const NOTE_COPY: Record<string, string> = {
	default: "Recommended",
	headless: "If the browser can't reach this computer — paste a code instead.",
};

export function loginSelectMessage(message: string): string {
	return message.trim().replace(/:$/, "");
}

export function loginOptionParts(label: string): {
	title: string;
	detail?: string;
	recommended: boolean;
} {
	const match = /^(.*\S)\s*\(([^()]+)\)$/.exec(label.trim());
	if (!match?.[1] || !match[2]) return { title: label.trim(), recommended: false };
	const note = match[2].trim();
	const known = NOTE_COPY[note.toLowerCase()];
	return {
		title: match[1],
		detail: known ?? note.charAt(0).toUpperCase() + note.slice(1),
		recommended: note.toLowerCase() === "default",
	};
}
