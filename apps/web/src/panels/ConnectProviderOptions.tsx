import {
	RiArrowRightLine as ArrowRight,
	RiChat3Line as Chat,
	RiKeyLine as KeyRound,
	type RemixiconComponentType,
} from "@remixicon/react";
import type { ProviderStatus } from "@thinkrail/contracts";
import { Button } from "@thinkrail/ui/button";
import { cn } from "@thinkrail/ui/utils";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { SkeletonRows } from "@/components/Skeleton";
import { toast } from "@/store";
import { getTransport } from "@/transport";
import { JetBrainsAiCard } from "./JetBrainsAiCard";
import { ProviderRow } from "./ProviderRow";
import type { ProviderAuth } from "./useProviderAuth";

const API_KEY_VISIBLE = 6;
const SUMMARY_NAMES = 4;

export function connectedProviderName(provider: ProviderStatus): string {
	return provider.kind === "central" ? "JetBrains AI" : provider.name;
}

export async function announceProviderConnected(provider: ProviderStatus): Promise<void> {
	const models = await getTransport()
		.request("model.list", {})
		.catch(() => null);
	toast.success(
		models ? `${models.length} models available` : "The agent can run now.",
		`${connectedProviderName(provider)} connected`,
	);
}

export function ConnectProviderOptions({
	auth,
	onShowAll,
	onConnected,
}: {
	auth: ProviderAuth;
	onShowAll: () => void;
	onConnected: (provider: ProviderStatus) => void;
}) {
	const { report, failed, load, startLogin, rowBusy } = auth;
	const [expanded, setExpanded] = useState<"subscription" | "api-key" | null>(null);
	const [showAllKeys, setShowAllKeys] = useState(false);
	const baseline = useRef<Set<string> | null>(null);

	useEffect(() => {
		if (!report) return;
		const configured = report.providers.filter((p) => p.configured);
		if (baseline.current === null) {
			baseline.current = new Set(configured.map((p) => p.id));
			return;
		}
		const known = baseline.current;
		const fresh = configured.find((p) => !known.has(p.id));
		if (!fresh) return;
		for (const p of configured) known.add(p.id);
		onConnected(fresh);
	}, [report, onConnected]);

	if (failed && !report) {
		return (
			<div data-testid="connect-provider-error" className="flex items-center gap-12">
				<p className="min-w-0 flex-1 text-text-muted tr-text-ui">
					Couldn't read the provider status from the host.
				</p>
				<Button variant="outline" size="sm" onClick={() => void load()}>
					Retry
				</Button>
			</div>
		);
	}
	if (!report) return <SkeletonRows rows={3} />;

	const unconfigured = report.providers.filter((p) => !p.configured);
	const subscriptions = unconfigured.filter((p) => p.canOAuth);
	const apiKeys = unconfigured.filter((p) => p.canApiKey);
	const shownKeys = showAllKeys ? apiKeys : apiKeys.slice(0, API_KEY_VISIBLE);
	const toggle = (option: "subscription" | "api-key") =>
		setExpanded((current) => (current === option ? null : option));
	const rows = (providers: ProviderStatus[]) =>
		providers.map((p) => (
			<ProviderRow
				key={p.id}
				provider={p}
				busy={rowBusy(p.id)}
				onSignIn={() => void startLogin(p.id, "oauth")}
				onApiKey={() => void startLogin(p.id, "api_key")}
			/>
		));

	return (
		<div data-testid="connect-provider-options" className="flex flex-col gap-12 text-left">
			<section
				data-testid="connect-option-jetbrains"
				className="flex flex-col gap-8 rounded-sm border border-primary-muted bg-clip-padding bg-primary-subtle p-16"
			>
				<span className="self-start rounded-full border border-primary-muted bg-clip-padding bg-primary-subtle px-8 py-2 tr-text-label-pill text-primary">
					Recommended
				</span>
				<JetBrainsAiCard
					status={report.jbcentral}
					install={report.jbcentralInstall}
					onChanged={load}
				/>
			</section>

			{subscriptions.length > 0 ? (
				<ConnectOption
					testId="connect-option-subscription"
					icon={Chat}
					title="Use my subscription"
					subtitle={`${summarize(subscriptions)} — no API key needed.`}
					actionLabel="Choose…"
					expanded={expanded === "subscription"}
					onToggle={() => toggle("subscription")}
				>
					{rows(subscriptions)}
				</ConnectOption>
			) : null}

			{apiKeys.length > 0 ? (
				<ConnectOption
					testId="connect-option-api-key"
					icon={KeyRound}
					title="Bring your own API key"
					subtitle={summarize(apiKeys)}
					actionLabel="Enter key"
					expanded={expanded === "api-key"}
					onToggle={() => toggle("api-key")}
				>
					{rows(shownKeys)}
					{shownKeys.length < apiKeys.length ? (
						<div className="pt-8">
							<Button
								variant="outline"
								size="sm"
								data-testid="connect-show-more-keys"
								onClick={() => setShowAllKeys(true)}
							>
								Show {apiKeys.length - shownKeys.length} more
							</Button>
						</div>
					) : null}
				</ConnectOption>
			) : null}

			<Button
				variant="ghost"
				size="sm"
				data-testid="connect-show-all"
				className="self-center text-primary"
				onClick={onShowAll}
			>
				See all providers & advanced settings
				<ArrowRight className="size-14" />
			</Button>
		</div>
	);
}

function summarize(providers: ProviderStatus[]): string {
	const names = providers.slice(0, SUMMARY_NAMES).map((p) => p.name);
	return providers.length > SUMMARY_NAMES ? `${names.join(", ")}…` : names.join(", ");
}

function ConnectOption({
	testId,
	icon: Icon,
	title,
	subtitle,
	actionLabel,
	expanded,
	onToggle,
	children,
}: {
	testId: string;
	icon: RemixiconComponentType;
	title: string;
	subtitle: string;
	actionLabel: string;
	expanded: boolean;
	onToggle: () => void;
	children: ReactNode;
}) {
	return (
		<section
			data-testid={testId}
			data-expanded={expanded}
			className={cn(
				"flex flex-col rounded-sm border bg-clip-padding bg-container-workspace-bg p-16",
				expanded ? "border-primary-muted" : "border-border-default",
			)}
		>
			<div className="flex items-center gap-12">
				<Icon className="size-20 shrink-0 text-text-muted" />
				<span className="min-w-0 flex-1">
					<span className="block tr-title-card text-text-default">{title}</span>
					<span className="mt-2 block truncate text-text-muted tr-text-metadata">{subtitle}</span>
				</span>
				<Button
					variant="outline"
					size="sm"
					aria-expanded={expanded}
					data-testid={`${testId}-toggle`}
					onClick={onToggle}
				>
					{actionLabel}
				</Button>
			</div>
			{expanded ? <div className="mt-8 flex flex-col">{children}</div> : null}
		</section>
	);
}
