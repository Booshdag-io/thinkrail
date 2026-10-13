import {
	RiBracesLine as Braces,
	RiCheckboxCircleFill as CheckCircleFill,
	RiCheckboxCircleLine as CheckCircleLine,
	RiArrowDownSLine as ChevronDown,
	RiArrowRightSLine as ChevronRight,
	RiInfinityLine as InfinityMark,
	RiKey2Line as Key,
	RiPushpinFill as PinFill,
	RiPushpinLine as PinLine,
	RiRefreshLine as RefreshCw,
	RiSparkling2Line as Sparkles,
} from "@remixicon/react";
import {
	type ModelDefault,
	sameModel,
	type ThinkingLevel,
	type WireModel,
} from "@thinkrail/contracts";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@thinkrail/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@thinkrail/ui/popover";
import { IconTooltip } from "@thinkrail/ui/tooltip";
import { cn } from "@thinkrail/ui/utils";
import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import {
	CENTRAL_KIND_TAG,
	costLabel,
	describeAuth,
	EFFORT_BAR_HEIGHTS,
	formatContext,
	groupByProvider,
	kindLabel,
	type LevelTone,
	levelTone,
	litBars,
	modelKey,
	trailingLevel,
} from "./modelPicker";
import { ProviderGlyph } from "./ProviderGlyph";
import type { ModelPreferences } from "./useModelPreferences";

export interface ModelEffortPickerHandle {
	/** Opens the popover with the search prefilled — the `/model` slash command's entry. */
	open: (query?: string) => void;
}

/** The pre-session "Default" row: what the host would pick when the caller sends no explicit pair. */
export interface DefaultPairOption {
	/** The host's `model.default` answer, or `null` while it is still being asked. */
	resolved: ModelDefault | null;
	/** True while the held pair is the default rather than an explicit choice. */
	active: boolean;
	onSelect: () => void;
}

/** A model choice, carrying a level only when the user picked both at once (`opus high`). */
export interface ModelSelection {
	model: WireModel;
	level?: ThinkingLevel;
}

export interface ModelEffortPickerProps {
	models: WireModel[];
	current: WireModel | null;
	level: ThinkingLevel;
	onSelect: (selection: ModelSelection) => void;
	/** A level change for the current model alone. */
	onSelectLevel: (level: ThinkingLevel) => void;
	refreshing: boolean;
	onRefresh: (force: boolean) => void;
	preferences: ModelPreferences;
	defaultOption?: DefaultPairOption;
	container?: HTMLElement | null;
	className?: string;
}

function hasKindGlyph(model: WireModel): boolean {
	return model.auth !== undefined && model.auth.kind !== "other";
}

/** The connection-kind mark: key = API key, ∞ = subscription, { } = environment key, JCP = JetBrains AI. */
function KindGlyph({ model, className }: { model: WireModel; className?: string }) {
	switch (model.auth?.kind) {
		case "api-key":
			return <Key className={cn("size-12 shrink-0", className)} />;
		case "oauth":
			return <InfinityMark className={cn("size-12 shrink-0", className)} />;
		case "env":
			return <Braces className={cn("size-12 shrink-0", className)} />;
		case "central":
			return (
				<span
					className={cn(
						"inline-flex h-14 shrink-0 items-center rounded-sm border border-control-border-active px-2 tr-code-text-small leading-none",
						className,
					)}
				>
					{CENTRAL_KIND_TAG}
				</span>
			);
		default:
			return null;
	}
}

function EffortBars({
	level,
	levels,
	className,
}: {
	level: ThinkingLevel;
	levels: readonly ThinkingLevel[];
	className?: string;
}) {
	const lit = litBars(level, levels);
	return (
		<span aria-hidden className={cn("inline-flex h-12 shrink-0 items-end gap-2", className)}>
			{EFFORT_BAR_HEIGHTS.map((height, index) => (
				<span
					key={height}
					className={cn("w-2 rounded-xs bg-current", height, index >= lit && "opacity-30")}
				/>
			))}
		</span>
	);
}

const TONE_TEXT: Record<LevelTone, string> = {
	cool: "text-feedback-info",
	accent: "text-primary",
	hot: "text-feedback-warning",
};

/** The visible effort levels (off is hidden but preserved if the model supports it). */
const VISIBLE_LEVELS: readonly ThinkingLevel[] = ["minimal", "low", "medium", "high"];

/** The effort segmented control with the same style as ToggleSegment in Settings. */
function EffortSegmentedControl({
	level,
	levels,
	onSelectLevel,
}: {
	level: ThinkingLevel;
	levels: readonly ThinkingLevel[];
	onSelectLevel: (level: ThinkingLevel) => void;
}) {
	// Filter to visible levels that the model supports
	const visibleLevels = useMemo(() => VISIBLE_LEVELS.filter((l) => levels.includes(l)), [levels]);

	// If the current level is "off" (hidden but valid), show it as an indicator but not selectable
	const showsOffIndicator = level === "off" && levels.includes("off");

	return (
		<div
			data-testid="thinking-section"
			className="flex shrink-0 flex-col gap-8 border-border-default border-t px-12 py-8"
		>
			<span className="text-text-muted tr-text-metadata">Effort</span>
			<div className="flex items-center gap-4">
				{showsOffIndicator ? (
					<span className="rounded-sm bg-control-bg-selected px-8 py-2 text-text-default tr-text-metadata capitalize">
						off
					</span>
				) : null}
				{visibleLevels.map((candidate) => {
					const active = candidate === level;
					return (
						<button
							key={candidate}
							type="button"
							aria-pressed={active}
							data-testid="thinking-option"
							data-level={candidate}
							onClick={() => onSelectLevel(candidate)}
							className={cn(
								"rounded-sm px-8 py-2 tr-text-metadata capitalize outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary",
								active
									? "bg-control-bg-selected text-text-default"
									: "text-text-muted hover:bg-control-bg-hovered hover:text-text-default",
							)}
						>
							{candidate}
						</button>
					);
				})}
			</div>
		</div>
	);
}

function RowMeta({ model, withProvider }: { model: WireModel; withProvider: boolean }) {
	const kind = kindLabel(model);
	const cost = costLabel(model);
	return (
		<span className="flex min-w-0 items-center gap-4 truncate text-text-muted tr-text-metadata">
			{withProvider ? <span className="shrink-0">{model.provider}</span> : null}
			{kind ? (
				<>
					{withProvider ? <span aria-hidden>·</span> : null}
					<KindGlyph model={model} />
					<span className="truncate">{kind}</span>
				</>
			) : null}
			{cost ? (
				<>
					{withProvider || kind ? <span aria-hidden>·</span> : null}
					<span className="shrink-0">{cost} per M</span>
				</>
			) : null}
			{withProvider || kind || cost ? <span aria-hidden>·</span> : null}
			<span className="shrink-0">{formatContext(model.contextWindow)}</span>
		</span>
	);
}

/** Maps provider IDs to display names for readability. */
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
	openai: "OpenAI",
	anthropic: "Anthropic",
	google: "Google",
	mistral: "Mistral",
	groq: "Groq",
	together: "Together",
	perplexity: "Perplexity",
	fireworks: "Fireworks",
	deepseek: "DeepSeek",
	cohere: "Cohere",
	xai: "xAI",
};

function getProviderDisplayName(provider: string): string {
	return PROVIDER_DISPLAY_NAMES[provider.toLowerCase()] ?? provider;
}

export const ModelEffortPicker = forwardRef<ModelEffortPickerHandle, ModelEffortPickerProps>(
	function ModelEffortPicker(
		{
			models,
			current,
			level,
			onSelect,
			onSelectLevel,
			refreshing,
			onRefresh,
			preferences,
			defaultOption,
			container,
			className,
		},
		handleRef,
	) {
		const [open, setOpen] = useState(false);
		const [query, setQuery] = useState("");
		const [showAll, setShowAll] = useState(false);
		const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());

		const openWith = (next: string) => {
			setQuery(next);
			setOpen(true);
			onRefresh(false);
		};

		useImperativeHandle(handleRef, () => ({ open: (q = "") => openWith(q) }));

		const close = () => {
			setOpen(false);
			setQuery("");
			// Don't reset showAll or expandedProviders to preserve user's navigation state
		};

		const groups = useMemo(() => groupByProvider(models), [models]);

		// Create a set of pinned and recent model keys to avoid duplicates
		const pinnedKeys = useMemo(
			() => new Set(preferences.favorites.map(modelKey)),
			[preferences.favorites],
		);
		const recentKeys = useMemo(
			() => new Set(preferences.recents.map(modelKey)),
			[preferences.recents],
		);

		const shortlist = preferences.favorites.length > 0 || preferences.recents.length > 0;
		const isSearching = query.trim() !== "";
		const folded = shortlist && !showAll && !isSearching;

		const toggleProvider = (provider: string) => {
			setExpandedProviders((prev) => {
				const next = new Set(prev);
				if (next.has(provider)) {
					next.delete(provider);
				} else {
					next.add(provider);
				}
				return next;
			});
		};

		const pickModel = (model: WireModel) => {
			const typedLevel = trailingLevel(query, model);
			if (typedLevel) {
				onSelect({ model, level: typedLevel });
				close();
				return;
			}
			if (sameModel(model, current) && !defaultOption?.active) {
				close();
				return;
			}
			onSelect({ model });
			setQuery("");
		};

		const renderModel = (model: WireModel, section: string) => {
			const pinned = preferences.isFavorite(model);
			const isCurrent = !defaultOption?.active && sameModel(model, current);
			const isDefaultModel = preferences.isDefault(model, level);
			return (
				<CommandItem
					key={`${section}:${modelKey(model)}`}
					value={`${section}:${modelKey(model)}`}
					keywords={[model.name, model.id, model.provider, ...model.thinkingLevels]}
					data-testid="model-option"
					data-model-id={model.id}
					data-provider={model.provider}
					title={describeAuth(model) ?? undefined}
					onSelect={() => pickModel(model)}
					className={cn(
						"group/row items-start gap-8 py-4",
						isCurrent && "bg-primary-subtle data-[selected=true]:bg-primary-subtle",
					)}
				>
					<ProviderGlyph provider={model.provider} className="mt-2 size-12 text-text-muted" />
					<span className="flex min-w-0 flex-1 flex-col">
						<span className="truncate">{model.name}</span>
						<RowMeta model={model} withProvider={section !== "all"} />
					</span>
					{preferences.supported ? (
						<span className="mt-2 flex shrink-0 items-center gap-4">
							{/* Set as default action */}
							<IconTooltip label={isDefaultModel ? "Default for new chats" : "Set as default"}>
								<button
									type="button"
									data-testid="model-set-default"
									data-default={isDefaultModel}
									aria-label={
										isDefaultModel ? "Default for new chats" : `Set ${model.name} as default`
									}
									disabled={isDefaultModel}
									onClick={(event) => {
										event.stopPropagation();
										if (!isDefaultModel) {
											preferences.setDefault(model, level);
										}
									}}
									className={cn(
										"flex size-16 shrink-0 items-center justify-center rounded-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary",
										isDefaultModel
											? "text-primary"
											: "text-text-subtle opacity-0 hover:bg-control-bg-hovered group-hover/row:opacity-100 group-data-[selected=true]/row:opacity-100 focus-visible:opacity-100",
									)}
								>
									{isDefaultModel ? (
										<CheckCircleFill className="size-12" />
									) : (
										<CheckCircleLine className="size-12" />
									)}
								</button>
							</IconTooltip>
							{/* Pin/unpin action */}
							<IconTooltip label={pinned ? "Unpin" : "Pin"}>
								<button
									type="button"
									data-testid="model-pin-toggle"
									data-pinned={pinned}
									aria-label={pinned ? `Unpin ${model.name}` : `Pin ${model.name}`}
									aria-pressed={pinned}
									onClick={(event) => {
										event.stopPropagation();
										preferences.toggleFavorite(model);
									}}
									className={cn(
										"flex size-16 shrink-0 items-center justify-center rounded-sm outline-none transition-colors hover:bg-control-bg-hovered focus-visible:ring-2 focus-visible:ring-primary",
										pinned
											? "text-primary"
											: "text-text-subtle opacity-0 group-hover/row:opacity-100 group-data-[selected=true]/row:opacity-100 focus-visible:opacity-100",
									)}
								>
									{pinned ? <PinFill className="size-12" /> : <PinLine className="size-12" />}
								</button>
							</IconTooltip>
						</span>
					) : null}
				</CommandItem>
			);
		};

		const effortLevels = current?.thinkingLevels ?? [];
		const following = defaultOption?.active ? defaultOption.resolved : null;
		const pillModel = defaultOption?.active ? (following?.model ?? null) : current;
		const pillLevel = following?.thinkingLevel ?? level;

		return (
			<Popover open={open} onOpenChange={(next) => (next ? openWith("") : close())}>
				<PopoverTrigger
					data-testid="model-selector"
					data-open={open}
					className={cn(
						"flex h-32 min-w-0 items-center gap-8 rounded-sm px-8 tr-text-ui text-text-default outline-none transition-colors hover:bg-control-bg-hovered focus-visible:ring-2 focus-visible:ring-primary data-[open=true]:bg-control-bg-selected",
						className,
					)}
				>
					{defaultOption?.active ? (
						<Sparkles className="size-14 shrink-0 text-text-muted" />
					) : pillModel ? (
						<ProviderGlyph provider={pillModel.provider} className="size-14 text-text-muted" />
					) : null}
					<span className="truncate">
						{defaultOption?.active ? "Default" : (pillModel?.name ?? "Select model")}
					</span>
					{pillModel ? (
						<>
							{defaultOption?.active ? (
								<span className="truncate text-text-muted tr-text-metadata">{pillModel.name}</span>
							) : null}
							<span
								data-testid="thinking-selector"
								data-level={pillLevel}
								className="flex shrink-0 items-center gap-4 text-text-muted tr-text-metadata capitalize"
							>
								<EffortBars
									level={pillLevel}
									levels={pillModel.thinkingLevels}
									className={TONE_TEXT[levelTone(pillLevel)]}
								/>
								{pillLevel}
							</span>
							{hasKindGlyph(pillModel) ? (
								<IconTooltip label={describeAuth(pillModel)} wrapTrigger>
									<KindGlyph model={pillModel} className="text-text-muted" />
								</IconTooltip>
							) : null}
						</>
					) : null}
					<ChevronDown className="size-14 shrink-0 text-text-muted" />
				</PopoverTrigger>
				<PopoverContent
					align="start"
					container={container}
					className="flex max-h-[var(--radix-popover-content-available-height)] w-[min(360px,calc(100vw-16px))] flex-col p-0"
				>
					<Command className="min-h-0 flex-1 bg-transparent">
						<div className="flex items-center border-border-default border-b">
							<CommandInput
								placeholder="Search models… (append a level: opus high)"
								value={query}
								onValueChange={setQuery}
								className="flex-1 border-none"
							/>
							<IconTooltip label={refreshing ? "Updating catalog…" : "Refresh catalog"}>
								<button
									type="button"
									data-testid="model-refresh"
									data-refreshing={refreshing}
									disabled={refreshing}
									onClick={() => onRefresh(true)}
									className="mr-8 flex size-24 shrink-0 items-center justify-center rounded-sm text-text-muted outline-none transition-colors hover:bg-control-bg-hovered hover:text-text-default focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default disabled:text-text-subtle disabled:hover:bg-transparent"
								>
									<RefreshCw className={cn("size-14", refreshing && "animate-spin")} />
								</button>
							</IconTooltip>
						</div>
						<CommandList className="max-h-[340px] min-h-0 flex-1">
							<CommandEmpty>No models found.</CommandEmpty>
							{defaultOption ? (
								<CommandGroup>
									<CommandItem
										value="default:pair"
										keywords={["default"]}
										data-testid="model-option-default"
										onSelect={() => {
											defaultOption.onSelect();
											close();
										}}
										className={cn(
											"items-start gap-8 py-4",
											defaultOption.active &&
												"bg-primary-subtle data-[selected=true]:bg-primary-subtle",
										)}
									>
										<Sparkles className="mt-2 size-12 shrink-0 text-text-muted" />
										<span className="flex min-w-0 flex-1 flex-col">
											<span>Default</span>
											<span className="truncate text-text-muted tr-text-metadata">
												{defaultOption.resolved?.model
													? `Follows Settings → Models · ${defaultOption.resolved.model.name} · ${defaultOption.resolved.thinkingLevel}`
													: "Follows Settings → Models"}
											</span>
										</span>
									</CommandItem>
								</CommandGroup>
							) : null}
							{preferences.favorites.length > 0 ? (
								<CommandGroup heading="Pinned">
									{preferences.favorites.map((m) => renderModel(m, "pinned"))}
								</CommandGroup>
							) : null}
							{preferences.recents.length > 0 ? (
								<CommandGroup heading="Recent">
									{preferences.recents.map((m) => renderModel(m, "recent"))}
								</CommandGroup>
							) : null}
							{folded ? (
								<CommandGroup>
									<CommandItem
										value="all:models"
										data-testid="model-show-all"
										onSelect={() => setShowAll(true)}
										className="items-start gap-8 py-4 text-text-muted"
									>
										<ChevronRight className="mt-2 size-12 shrink-0" />
										<span className="flex min-w-0 flex-1 flex-col">
											<span>All models</span>
											<span className="truncate tr-text-metadata">
												{groups.map((g) => getProviderDisplayName(g.provider)).join(" · ")} ·{" "}
												{models.length}
											</span>
										</span>
									</CommandItem>
								</CommandGroup>
							) : isSearching ? (
								// When searching, show all matching models without provider grouping
								groups.map((group) => group.models.map((m) => renderModel(m, "all")))
							) : (
								// Expanded view with collapsible provider groups
								<>
									{shortlist ? (
										<CommandGroup>
											<CommandItem
												value="all:collapse"
												data-testid="model-collapse-all"
												onSelect={() => setShowAll(false)}
												className="items-start gap-8 py-4 text-text-muted"
											>
												<ChevronDown className="mt-2 size-12 shrink-0" />
												<span>All models</span>
											</CommandItem>
										</CommandGroup>
									) : null}
									{groups.map((group) => {
										const isExpanded = expandedProviders.has(group.provider);
										// Filter out models already shown in Pinned or Recent
										const uniqueModels = group.models.filter(
											(m) => !pinnedKeys.has(modelKey(m)) && !recentKeys.has(modelKey(m)),
										);
										// If all models are already shown elsewhere, still show the provider but with indication
										const displayName = getProviderDisplayName(group.provider);
										return (
											<CommandGroup key={group.provider}>
												<CommandItem
													value={`provider:${group.provider}`}
													data-testid="provider-group-header"
													data-provider={group.provider}
													onSelect={() => toggleProvider(group.provider)}
													className="items-center gap-8 py-4"
												>
													{isExpanded ? (
														<ChevronDown className="size-12 shrink-0 text-text-muted" />
													) : (
														<ChevronRight className="size-12 shrink-0 text-text-muted" />
													)}
													<span className="flex min-w-0 flex-1 items-center gap-8">
														<span className="truncate">{displayName}</span>
														<span className="text-text-subtle tr-text-metadata">
															{group.models.length}
														</span>
													</span>
													{group.auth ? (
														<span className="truncate text-text-subtle tr-text-metadata">
															{group.auth}
														</span>
													) : null}
												</CommandItem>
												{isExpanded ? uniqueModels.map((m) => renderModel(m, "all")) : null}
											</CommandGroup>
										);
									})}
								</>
							)}
						</CommandList>
					</Command>
					{current && effortLevels.length > 0 ? (
						<EffortSegmentedControl
							level={level}
							levels={effortLevels}
							onSelectLevel={onSelectLevel}
						/>
					) : null}
				</PopoverContent>
			</Popover>
		);
	},
);
