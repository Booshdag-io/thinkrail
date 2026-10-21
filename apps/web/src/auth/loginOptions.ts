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
	if (note.toLowerCase() === "default") return { title: match[1], recommended: true };
	return {
		title: match[1],
		detail: note.charAt(0).toUpperCase() + note.slice(1),
		recommended: false,
	};
}
