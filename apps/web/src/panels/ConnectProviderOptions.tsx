import {
	RiArrowRightLine as ArrowRight,
	RiKeyLine as KeyRound,
	RiLoginBoxLine as LogIn,
	RiSearchLine as Search,
} from "@remixicon/react";
import type { ProviderStatus } from "@thinkrail/contracts";
import type { MessageKey } from "@thinkrail/locales";
import { t as translate, useT } from "@thinkrail/locales/react";
import { Button } from "@thinkrail/ui/button";
import { SkeletonRows } from "@thinkrail/ui/skeleton";
import { cn } from "@thinkrail/ui/utils";
import { useEffect, useRef, useState } from "react";
import { toast } from "@/store";
import { getTransport } from "@/transport";
import { JetBrainsAiCard } from "./JetBrainsAiCard";
import { ProviderRow } from "./ProviderRow";
import type { ProviderAuth } from "./useProviderAuth";

const RECOMMENDED_PROVIDER = "anthropic";
const JETBRAINS_AI_SEARCH = "jetbrains ai central";

type Method = "oauth" | "api_key";

const RECOMMENDED_COPY = {
	oauth: {
		title: "panels.connectProvider.anthropicOauthTitle",
		detail: "panels.connectProvider.anthropicOauthDetail",
	},
	api_key: {
		title: "panels.connectProvider.anthropicApiKeyTitle",
		detail: "panels.connectProvider.anthropicApiKeyDetail",
	},
} as const satisfies Record<Method, { title: MessageKey; detail: MessageKey }>;

function methodsOf(provider: ProviderStatus): Method[] {
	return [
		...(provider.canOAuth ? (["oauth"] as const) : []),
		...(provider.canApiKey ? (["api_key"] as const) : []),
	];
}

export function connectedProviderName(provider: ProviderStatus): string {
	return provider.kind === "central" ? "JetBrains AI" : provider.name;
}

export async function announceProviderConnected(provider: ProviderStatus): Promise<void> {
	const models = await getTransport()
		.request("model.list", {})
		.catch(() => null);
	toast.success(
		models
			? translate("panels.connectProvider.modelsAvailable", { count: models.length })
			: translate("panels.connectProvider.agentCanRun"),
		translate("auth.login.connectedTitle", { provider: connectedProviderName(provider) }),
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
	const t = useT();
	const { report, failed, load, startLogin, rowBusy } = auth;
	const [search, setSearch] = useState("");
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
					{t("panels.connectProvider.loadFailed")}
				</p>
				<Button variant="outline" size="sm" onClick={() => void load()}>
					{t("common.retry")}
				</Button>
			</div>
		);
	}
	if (!report) return <SkeletonRows rows={3} />;

	const unconfigured = report.providers.filter(
		(p) => !p.configured && p.kind !== "central" && (p.canOAuth || p.canApiKey),
	);
	const recommended = unconfigured.find((p) => p.id === RECOMMENDED_PROVIDER);
	const query = search.trim().toLowerCase();
	const others = unconfigured
		.filter((p) =>
			query ? p.name.toLowerCase().includes(query) || p.id.includes(query) : p !== recommended,
		)
		.sort((a, b) => (b.canOAuth ? 1 : 0) - (a.canOAuth ? 1 : 0));
	const showJetBrains = !query || JETBRAINS_AI_SEARCH.includes(query);
	const connect = (p: ProviderStatus, method: Method) => void startLogin(p.id, method);

	return (
		<div data-testid="connect-provider-options" className="flex flex-col gap-12 text-left">
			{recommended ? (
				<section
					data-testid="connect-option-recommended"
					className="flex flex-col gap-8 rounded-sm border border-primary-muted bg-clip-padding bg-primary-subtle p-16"
				>
					<span className="self-start rounded-full border border-primary-muted bg-clip-padding bg-primary-subtle px-8 py-2 tr-text-label-pill text-primary">
						{t("panels.connectProvider.recommended")}
					</span>
					<span className="tr-title-card text-text-default">{recommended.name}</span>
					<MethodChoices
						provider={recommended}
						busy={rowBusy(recommended.id)}
						onPick={(method) => connect(recommended, method)}
					/>
				</section>
			) : null}

			<section
				data-testid="connect-provider-all"
				className="flex flex-col gap-8 rounded-sm border border-border-default bg-clip-padding bg-container-workspace-bg p-16"
			>
				<div className="relative">
					<Search className="pointer-events-none absolute top-1/2 left-8 size-14 -translate-y-1/2 text-text-muted" />
					<input
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder={
							recommended
								? t("panels.connectProvider.searchOthers")
								: t("panels.connectProvider.search")
						}
						aria-label={t("panels.connectProvider.searchLabel")}
						data-testid="connect-provider-search"
						className="h-32 w-full rounded-sm border border-control-border-default bg-control-bg pl-24 pr-8 tr-text-ui text-text-default placeholder:text-text-muted outline-none transition-colors focus:border-control-border-active"
					/>
				</div>
				<div data-testid="connect-provider-list" className="flex h-240 flex-col overflow-y-auto">
					{showJetBrains ? (
						<div className="border-border-muted border-b py-12">
							<JetBrainsAiCard
								status={report.jbcentral}
								install={report.jbcentralInstall}
								onChanged={load}
							/>
						</div>
					) : null}
					{others.map((p) => (
						<ProviderRow
							key={p.id}
							provider={p}
							busy={rowBusy(p.id)}
							onSignIn={() => connect(p, "oauth")}
							onApiKey={() => connect(p, "api_key")}
						/>
					))}
					{!showJetBrains && others.length === 0 ? (
						<p className="py-16 text-center text-text-muted tr-text-metadata">
							{t("panels.connectProvider.noMatch")}
						</p>
					) : null}
				</div>
			</section>

			<Button
				variant="ghost"
				size="sm"
				data-testid="connect-show-all"
				className="self-center text-primary"
				onClick={onShowAll}
			>
				{t("panels.connectProvider.showAll")}
				<ArrowRight className="size-14" />
			</Button>
		</div>
	);
}

function MethodChoices({
	provider,
	busy,
	onPick,
}: {
	provider: ProviderStatus;
	busy: boolean;
	onPick: (method: Method) => void;
}) {
	const t = useT();
	return (
		<div className="grid gap-8 sm:grid-cols-2">
			{methodsOf(provider).map((method) => {
				const Icon = method === "oauth" ? LogIn : KeyRound;
				return (
					<button
						key={method}
						type="button"
						data-testid="connect-method"
						data-method={method}
						data-provider={provider.id}
						disabled={busy}
						onClick={() => onPick(method)}
						className={cn(
							"flex min-w-0 items-start gap-8 rounded-sm border bg-clip-padding p-12 text-left transition-colors hover:bg-control-bg-hovered focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
							method === "oauth"
								? "border-primary-muted bg-container-workspace-bg"
								: "border-border-default bg-container-workspace-bg",
						)}
					>
						<Icon className="mt-2 size-16 shrink-0 text-primary" />
						<span className="min-w-0">
							<span className="block tr-title-card text-text-default">
								{t(RECOMMENDED_COPY[method].title)}
							</span>
							<span className="mt-2 block text-text-muted tr-text-metadata">
								{t(RECOMMENDED_COPY[method].detail)}
							</span>
						</span>
					</button>
				);
			})}
		</div>
	);
}
