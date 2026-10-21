import { RiAlertLine as Alert, RiFolderOpenLine as FolderOpen } from "@remixicon/react";
import type { Project } from "@thinkrail/contracts";
import { Button } from "@thinkrail/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@thinkrail/ui/dialog";
import { Switch } from "@thinkrail/ui/switch";
import { useState } from "react";
import { errorText, getTransport } from "@/transport";

export const DEFAULT_PROJECT_PARENT = "~/thinkrail";

const PICK_TIMEOUT_MS = 30 * 60_000;
const FIELD_CLASS =
	"w-full min-w-0 rounded-sm border border-control-border-default bg-control-bg px-12 py-8 tr-text-ui text-text-default outline-none transition-colors placeholder:text-text-muted focus-visible:border-control-border-active";

export function projectFolderName(name: string): string {
	return name
		.trim()
		.toLowerCase()
		.replace(/[^\p{L}\p{N}._-]+/gu, "-")
		.replace(/^[-.]+|-+$/g, "");
}

export function joinHostPath(parent: string, folder: string): string {
	const separator = parent.includes("\\") && !parent.includes("/") ? "\\" : "/";
	return `${parent.replace(/[\\/]+$/, "")}${separator}${folder}`;
}

export function CreateProjectDialog({
	offerSetup,
	onClose,
	onCreated,
}: {
	offerSetup: boolean;
	onClose: () => void;
	onCreated: (project: Project, setup: boolean) => void;
}) {
	const [name, setName] = useState("");
	const [parent, setParent] = useState(DEFAULT_PROJECT_PARENT);
	const [setup, setSetup] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const folder = projectFolderName(name);
	const parentPath = parent.trim();
	const canCreate = folder !== "" && parentPath !== "" && !busy;

	const browse = async () => {
		try {
			const { path } = await getTransport().request(
				"dialog.selectDirectory",
				{},
				{ timeoutMs: PICK_TIMEOUT_MS },
			);
			if (path) setParent(path);
		} catch (err) {
			setError(
				errorText(err, "Couldn't open the folder picker on the host — type the path instead."),
			);
		}
	};

	const create = async () => {
		const runSetup = offerSetup && setup;
		setBusy(true);
		setError(null);
		try {
			const project = await getTransport().request("project.create", {
				parentPath,
				name: folder,
			});
			setBusy(false);
			onCreated(project, runSetup);
			onClose();
		} catch (err) {
			setBusy(false);
			setError(errorText(err, "Couldn't create the project."));
		}
	};

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !busy) onClose();
			}}
		>
			<DialogContent data-testid="create-project-dialog" className="max-w-[32rem] gap-12">
				<DialogHeader>
					<DialogTitle>Start a new project</DialogTitle>
					<DialogDescription>
						ThinkRail makes the folder on the computer running it and starts a git repository there.
					</DialogDescription>
				</DialogHeader>

				<form
					className="flex flex-col gap-12"
					onSubmit={(event) => {
						event.preventDefault();
						if (canCreate) void create();
					}}
				>
					<label htmlFor="create-project-name" className="flex flex-col gap-4">
						<span className="tr-title-compact text-text-default">Name</span>
						<input
							id="create-project-name"
							data-testid="create-project-name"
							autoFocus
							autoComplete="off"
							spellCheck={false}
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder="weather app"
							className={FIELD_CLASS}
						/>
					</label>

					<div className="flex flex-col gap-4">
						<label htmlFor="create-project-parent" className="tr-title-compact text-text-default">
							Location
						</label>
						<div className="flex gap-8">
							<input
								id="create-project-parent"
								data-testid="create-project-parent"
								autoComplete="off"
								spellCheck={false}
								value={parent}
								onChange={(event) => setParent(event.target.value)}
								className={FIELD_CLASS}
							/>
							<Button
								variant="outline"
								data-testid="create-project-browse"
								onClick={() => void browse()}
							>
								<FolderOpen className="size-16" />
								Browse
							</Button>
						</div>
						<span
							data-testid="create-project-path"
							className="truncate text-text-muted tr-text-metadata"
						>
							{folder ? joinHostPath(parentPath, folder) : "Name the project to see its folder."}
						</span>
					</div>

					{offerSetup ? (
						<div className="flex items-center gap-12">
							<span className="min-w-0 flex-1">
								<span className="block tr-title-compact text-text-default">
									Draft the specs with the agent
								</span>
								<span className="block text-text-muted tr-text-metadata">
									Opens a chat that runs the Set up project skill, starting from the project's goal.
								</span>
							</span>
							<Switch
								checked={setup}
								onCheckedChange={setSetup}
								label="Draft the specs with the agent"
								testId="create-project-setup"
							/>
						</div>
					) : null}

					{error ? (
						<p
							data-testid="create-project-error"
							className="flex items-start gap-8 text-feedback-error tr-text-ui"
						>
							<Alert className="mt-2 size-16 shrink-0" />
							<span className="min-w-0 whitespace-pre-wrap break-words">{error}</span>
						</p>
					) : null}

					<DialogFooter>
						<Button variant="outline" disabled={busy} onClick={onClose}>
							Cancel
						</Button>
						<Button type="submit" data-testid="create-project-submit" disabled={!canCreate}>
							{busy ? "Creating…" : "Create & open"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
