import {
	RiFolderOpenLine as FolderOpen,
	RiHome2Line as House,
	RiRocketLine as Rocket,
	RiSparkling2Line as Sparkles,
} from "@remixicon/react";
import { useT } from "@thinkrail/locales/react";
import { useEffect, useState } from "react";
import { PRODUCT_NAME } from "../constants/branding";
import { selectSupportsOnboarding, toast, useAppStore } from "../store";
import { errorText, getTransport } from "../transport";
import { AddProjectMenu } from "./AddProjectMenu";
import { enterDefaultWorkspace } from "./defaultWorkspace";
import { NewWorkspaceDialog } from "./NewWorkspaceDialog";
import { OnboardingWizard } from "./OnboardingWizard";
import { ProjectTrustNotice } from "./ProjectTrustNotice";
import { ProviderWarningBanner } from "./ProviderWarningBanner";
import { setupDialogRequest, type WorkspaceDialogRequest } from "./setupPrompt";
import { useHasProvider } from "./useHasProvider";
import { useOpenProject } from "./useOpenProject";
import { Card, CardSkeleton } from "./WelcomeCard";

export function WelcomePanel() {
	const t = useT();
	const projects = useAppStore((s) => s.projects);
	const recentProjects = useAppStore((s) => s.recentProjects);
	const selectedProjectId = useAppStore((s) => s.selectedProjectId);
	const protocolVersion = useAppStore((s) => s.protocolVersion);
	const supportsOnboarding = useAppStore(selectSupportsOnboarding);
	const onboardingDismissed = useAppStore((s) => s.onboardingDismissed);
	const hasProvider = useHasProvider();
	const [dialog, setDialog] = useState<WorkspaceDialogRequest | null>(null);
	const [hasSpecs, setHasSpecs] = useState<boolean | null>(null);
	const wizard = useAppStore((s) => s.onboardingWizard);
	const setWizard = useAppStore((s) => s.setOnboardingWizard);
	const [justConnected, setJustConnected] = useState(false);
	const coldStart = projects.length === 0 && recentProjects.length === 0;

	useEffect(() => {
		if (wizard !== "pending" || protocolVersion === null) return;
		if (!supportsOnboarding || onboardingDismissed || !coldStart || hasProvider === true) {
			setWizard("hidden");
		} else if (hasProvider === false) {
			setWizard("shown");
		}
	}, [
		wizard,
		setWizard,
		protocolVersion,
		supportsOnboarding,
		onboardingDismissed,
		coldStart,
		hasProvider,
	]);

	const finishOnboarding = (request: WorkspaceDialogRequest | null) => {
		setWizard("hidden");
		if (request) setDialog(request);
		getTransport()
			.request("settings.update", { config: { onboardingDismissed: true } })
			.catch((err) => toast.error(errorText(err), "Couldn't save that onboarding is done"));
	};

	const project = projects.find((p) => p.id === selectedProjectId) ?? projects[0] ?? null;

	useEffect(() => {
		const projectId = project?.id;
		if (!projectId) {
			setHasSpecs(null);
			return;
		}
		let cancelled = false;
		setHasSpecs(null);
		getTransport()
			.request("project.hasSpecs", { projectId })
			.then((r) => {
				if (!cancelled) setHasSpecs(r.hasSpecs);
			})
			.catch(() => {
				if (!cancelled) setHasSpecs(true);
			});
		return () => {
			cancelled = true;
		};
	}, [project?.id]);

	const { openProject, pickAndOpen, enterHostPath, startNewProject, dialogs } = useOpenProject(
		(opened, { setup }) => {
			useAppStore.getState().selectProject(opened.id, { reveal: true });
			if (setup) setDialog(setupDialogRequest(opened.id));
		},
	);
	const noProjects = project == null;
	const showWizard = wizard === "shown" && !onboardingDismissed;

	const projectFolderCard = (projectId: string) => (
		<Card
			icon={House}
			title={t("panels.welcome.projectFolderTitle")}
			subtitle={t("panels.welcome.projectFolderSubtitle")}
			onClick={() => void enterDefaultWorkspace(projectId)}
			className="motion-safe:animate-reveal"
		/>
	);

	const openProjectCard = (primary: boolean) => (
		<AddProjectMenu
			recentProjects={recentProjects}
			onOpen={() => void pickAndOpen()}
			onEnterHostPath={enterHostPath}
			onOpenRecent={(path) => void openProject(path)}
			align="start"
		>
			<Card
				cta={primary}
				primary={primary}
				icon={FolderOpen}
				title="Open project"
				subtitle="Choose a local folder or git repository to work in."
			/>
		</AddProjectMenu>
	);

	const noProjectCards = () =>
		supportsOnboarding ? (
			<>
				<Card
					cta
					primary
					icon={Sparkles}
					title="Start a new project"
					subtitle="Create an empty repo, then draft its spec with the agent."
					onClick={() => startNewProject({ offerSetup: true })}
				/>
				{openProjectCard(false)}
			</>
		) : (
			openProjectCard(true)
		);

	return (
		<div
			data-testid="welcome"
			className="flex h-full min-h-0 flex-col items-center justify-center overflow-auto px-24 py-24 text-center"
		>
			{showWizard ? (
				<OnboardingWizard onFinish={finishOnboarding} />
			) : (
				<>
					<h1
						data-testid="welcome-title"
						className="tr-brand-hero max-w-[640px] break-words text-primary"
					>
						{project ? project.name : justConnected ? "You're set" : PRODUCT_NAME}
					</h1>
					{noProjects && justConnected ? (
						<p data-testid="welcome-subtitle" className="mt-8 tr-text-reading text-text-muted">
							Pick a path to start — the connect step is out of the way.
						</p>
					) : null}

					<ProviderWarningBanner onConnected={() => setJustConnected(true)} />
					{project ? <ProjectTrustNotice projectId={project.id} /> : null}

					<div className="mt-24 flex flex-wrap justify-center gap-12">
						{noProjects && wizard === "pending" ? (
							<>
								<CardSkeleton />
								<CardSkeleton />
							</>
						) : noProjects ? (
							noProjectCards()
						) : hasSpecs === null ? (
							<>
								<CardSkeleton />
								<CardSkeleton />
							</>
						) : hasSpecs ? (
							<>
								<Card
									cta
									primary
									icon={Rocket}
									title="Start building"
									subtitle="Cut an isolated worktree + branch, then pair with the agent to build it."
									onClick={() => setDialog({ projectId: project.id, prompt: "" })}
									className="motion-safe:animate-reveal"
								/>
								{projectFolderCard(project.id)}
							</>
						) : (
							<>
								<Card
									cta
									primary
									icon={Sparkles}
									title="Set up project"
									tag="spec-first"
									subtitle="Draft the project's specs with the agent before building, starting from its goal."
									onClick={() => setDialog(setupDialogRequest(project.id))}
									className="motion-safe:animate-reveal"
								/>
								<Card
									icon={Rocket}
									title="Start building"
									subtitle="Cut an isolated worktree + branch and pair with the agent."
									onClick={() => setDialog({ projectId: project.id, prompt: "" })}
									className="motion-safe:animate-reveal"
								/>
								{projectFolderCard(project.id)}
							</>
						)}
					</div>
				</>
			)}

			{dialog ? (
				<NewWorkspaceDialog
					open
					projectId={dialog.projectId}
					initialPrompt={dialog.prompt}
					{...(dialog.note !== undefined ? { promptNote: dialog.note } : {})}
					onOpenChange={(o) => {
						if (!o) setDialog(null);
					}}
				/>
			) : null}
			{dialogs}
		</div>
	);
}
