import {
	RiAlertLine as Alert,
	RiArrowLeftLine as ArrowLeft,
	RiArrowRightLine as ArrowRight,
	RiCheckLine as Check,
	RiCpuLine as Cpu,
	RiFileTextLine as FileText,
	RiFolderOpenLine as FolderOpen,
	RiGitBranchLine as GitBranch,
	RiRocketLine as Rocket,
	RiSparkling2Line as Sparkles,
} from "@remixicon/react";
import type { Project, ProviderStatus, WireModel } from "@thinkrail/contracts";
import { Button } from "@thinkrail/ui/button";
import { SkeletonRows } from "@thinkrail/ui/skeleton";
import { cn } from "@thinkrail/ui/utils";
import { useEffect, useState } from "react";
import { PRODUCT_NAME } from "@/constants/branding";
import { useAppStore } from "@/store";
import { getTransport } from "@/transport";
import { AddProjectMenu } from "./AddProjectMenu";
import { ConnectProviderOptions, connectedProviderName } from "./ConnectProviderOptions";
import { setupDialogRequest, type WorkspaceDialogRequest } from "./setupPrompt";
import { useOpenProject } from "./useOpenProject";
import { useProviderAuth } from "./useProviderAuth";
import { Card } from "./WelcomeCard";

type Step = "intro" | "connect" | "verify" | "project" | "build";

const INTRO_BEATS = [
	{
		icon: GitBranch,
		title: "Worktrees, not your working tree",
		detail: "Every task runs on its own branch, so main stays clean until you merge.",
	},
	{
		icon: FileText,
		title: "Specs are the ground truth",
		detail: "The agent reads and maintains your project's specs, so intent outlives the chat.",
	},
	{
		icon: Cpu,
		title: "A thin host, a real engine",
		detail: "The pi coding agent runs models and skills; ThinkRail gives it an IDE.",
	},
];

const STEPS: { id: Exclude<Step, "intro">; label: string }[] = [
	{ id: "connect", label: "Connect" },
	{ id: "verify", label: "Verify" },
	{ id: "project", label: "Project" },
	{ id: "build", label: "Build" },
];

export function OnboardingWizard({
	onFinish,
}: {
	onFinish: (request: WorkspaceDialogRequest | null) => void;
}) {
	const [step, setStep] = useState<Step>("intro");
	const [provider, setProvider] = useState<ProviderStatus | null>(null);
	const [project, setProject] = useState<Project | null>(null);
	const settingsOpen = useAppStore((s) => s.settingsOpen);
	const recentProjects = useAppStore((s) => s.recentProjects);
	const auth = useProviderAuth({ ownsLoginDialog: !settingsOpen && step === "connect" });
	const { openProject, pickAndOpen, enterHostPath, startNewProject, dialogs } = useOpenProject(
		(opened) => {
			useAppStore.getState().selectProject(opened.id, { reveal: true });
			setProject(opened);
			setStep("build");
		},
	);

	return (
		<div
			data-testid="onboarding-wizard"
			data-step={step}
			className="flex w-full max-w-[640px] flex-col items-center gap-24"
		>
			{step === "intro" ? (
				<div
					data-testid="onboarding-intro"
					className="flex flex-col items-center gap-24 text-center"
				>
					<div className="flex flex-col items-center gap-8">
						<span className="tr-text-eyebrow text-text-muted">Welcome to</span>
						<h1 data-testid="welcome-title" className="tr-brand-hero text-primary">
							{PRODUCT_NAME}
						</h1>
						<p className="tr-heading-sm text-text-default">
							The agentic IDE that gets better every time you use it.
						</p>
					</div>
					<ul className="grid w-full gap-12 sm:grid-cols-3">
						{INTRO_BEATS.map(({ icon: Icon, title, detail }) => (
							<li
								key={title}
								className="flex flex-col gap-8 rounded-sm border border-border-default bg-clip-padding bg-container-workspace-bg p-16 text-left"
							>
								<Icon className="size-16 text-primary" />
								<span className="tr-title-card text-text-default">{title}</span>
								<span className="text-text-muted tr-text-metadata">{detail}</span>
							</li>
						))}
					</ul>
					<Button data-testid="onboarding-start" onClick={() => setStep("connect")}>
						Get started
						<ArrowRight className="size-16" />
					</Button>
				</div>
			) : step === "connect" ? (
				<>
					<StepTitle
						step="connect"
						title="Connect a model"
						subtitle="Pick how the agent will run."
					/>
					<div className="w-full">
						<ConnectProviderOptions
							auth={auth}
							onShowAll={() => useAppStore.getState().openSettings("providers")}
							onConnected={(connected) => {
								useAppStore.getState().clearLogin();
								setProvider(connected);
								setStep("verify");
							}}
						/>
					</div>
				</>
			) : step === "verify" && provider ? (
				<VerifyStep
					provider={provider}
					onBack={() => setStep("connect")}
					onContinue={() => setStep("project")}
				/>
			) : step === "project" ? (
				<>
					<StepTitle
						step="project"
						title="Pick a project"
						subtitle="Start from nothing or open a folder you have."
					/>
					<div className="flex flex-wrap justify-center gap-12">
						<Card
							cta
							primary
							icon={Sparkles}
							title="Start a new project"
							subtitle="Create an empty repo, then draft its spec with the agent."
							onClick={() => startNewProject({ offerSetup: false })}
						/>
						<AddProjectMenu
							recentProjects={recentProjects}
							onOpen={() => void pickAndOpen()}
							onEnterHostPath={enterHostPath}
							onOpenRecent={(path) => void openProject(path)}
							align="start"
						>
							<Card
								icon={FolderOpen}
								title="Open a project"
								subtitle="Pick a local folder or git repository on the host."
							/>
						</AddProjectMenu>
					</div>
				</>
			) : step === "build" && project ? (
				<>
					<StepTitle
						step="build"
						title={`${project.name} is ready`}
						subtitle="Draft its specs with the agent first, or go straight to building."
					/>
					<div className="flex flex-wrap justify-center gap-12">
						<Card
							cta
							primary
							icon={Sparkles}
							title="Set up project"
							tag="spec-first"
							subtitle="Draft the project's specs with the agent before building, starting from its goal."
							onClick={() => onFinish(setupDialogRequest(project.id))}
						/>
						<Card
							icon={Rocket}
							title="Start building"
							subtitle="Cut an isolated worktree + branch and pair with the agent."
							onClick={() => onFinish({ projectId: project.id, prompt: "" })}
						/>
					</div>
				</>
			) : null}

			<Button
				variant="ghost"
				size="sm"
				data-testid="onboarding-skip"
				className="text-text-muted"
				onClick={() => onFinish(null)}
			>
				Skip setup
			</Button>
			{auth.loginDialog}
			{dialogs}
		</div>
	);
}

function StepHeader({ current }: { current: Exclude<Step, "intro"> }) {
	const currentIndex = STEPS.findIndex((s) => s.id === current);
	return (
		<ol data-testid="onboarding-steps" className="flex items-center gap-8">
			{STEPS.map((s, index) => {
				const done = index < currentIndex;
				const active = index === currentIndex;
				return (
					<li
						key={s.id}
						data-step={s.id}
						data-state={done ? "done" : active ? "current" : "upcoming"}
						aria-current={active ? "step" : undefined}
						className="flex items-center gap-8"
					>
						{index > 0 ? (
							<span
								aria-hidden="true"
								className={cn("h-px w-24", done || active ? "bg-primary" : "bg-border-default")}
							/>
						) : null}
						<span
							className={cn(
								"grid size-20 place-items-center rounded-full border tr-text-caption",
								done
									? "border-primary bg-primary text-control-primary-text"
									: active
										? "border-primary text-primary"
										: "border-border-default text-text-muted",
							)}
						>
							{done ? <Check className="size-12" /> : index + 1}
						</span>
						<span
							className={cn("tr-text-metadata", active ? "text-text-default" : "text-text-muted")}
						>
							{s.label}
						</span>
					</li>
				);
			})}
		</ol>
	);
}

function StepTitle({
	step,
	title,
	subtitle,
}: {
	step: Exclude<Step, "intro">;
	title: string;
	subtitle: string;
}) {
	return (
		<div className="flex flex-col items-center gap-16 text-center">
			<div className="flex flex-col items-center gap-8">
				<h1 data-testid="welcome-title" className="tr-heading-xl break-words text-primary">
					{title}
				</h1>
				<p className="tr-text-reading text-text-muted">{subtitle}</p>
			</div>
			<StepHeader current={step} />
		</div>
	);
}

function VerifyStep({
	provider,
	onBack,
	onContinue,
}: {
	provider: ProviderStatus;
	onBack: () => void;
	onContinue: () => void;
}) {
	const [models, setModels] = useState<WireModel[] | null>(null);
	const [defaultModel, setDefaultModel] = useState<WireModel | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let cancelled = false;
		const transport = getTransport();
		Promise.all([transport.request("model.list", {}), transport.request("model.default", {})])
			.then(([list, fallback]) => {
				if (cancelled) return;
				setModels(list);
				setDefaultModel(fallback.model);
			})
			.catch(() => {
				if (!cancelled) setFailed(true);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const name = connectedProviderName(provider);
	const empty = models !== null && models.length === 0;

	return (
		<>
			<StepTitle
				step="verify"
				title={`${name} connected`}
				subtitle="Here's what the agent can run on."
			/>
			<div
				data-testid="onboarding-verify"
				className="flex w-full max-w-[420px] flex-col gap-8 rounded-sm border border-border-default bg-container-workspace-bg p-16 text-left"
			>
				{failed ? (
					<p className="text-text-muted tr-text-ui">
						Couldn't read the model list — the connection itself succeeded.
					</p>
				) : models === null ? (
					<SkeletonRows rows={2} />
				) : empty ? (
					<p
						data-testid="onboarding-no-models"
						className="flex items-start gap-8 text-feedback-warning tr-text-ui"
					>
						<Alert className="mt-2 size-16 shrink-0" />
						No models are available from {name} yet. Go back and pick another provider, or continue
						and connect one later in Settings.
					</p>
				) : (
					<>
						<p
							data-testid="onboarding-model-count"
							className="flex items-center gap-8 text-feedback-success tr-text-ui"
						>
							<Check className="size-16 shrink-0" />
							{models.length} models available
						</p>
						{defaultModel ? (
							<p className="text-text-muted tr-text-metadata">
								New chats start with{" "}
								<span className="tr-text-emphasis text-text-default">{defaultModel.name}</span>.
							</p>
						) : null}
					</>
				)}
			</div>
			<div className="flex gap-8">
				<Button variant="outline" data-testid="onboarding-back" onClick={onBack}>
					<ArrowLeft className="size-16" />
					Back
				</Button>
				<Button data-testid="onboarding-continue" onClick={onContinue}>
					Continue
				</Button>
			</div>
		</>
	);
}
