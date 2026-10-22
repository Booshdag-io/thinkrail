import type {
	SearchContext,
	SearchGroup,
	SearchKind,
	SearchPreviewResult,
	SearchPreviewTarget,
	SearchQueryResult,
	WsParams,
} from "@thinkrail/contracts";
import { useEffect, useState } from "react";
import { useAppStore } from "../store";
import { getTransport } from "../transport";

export const HOST_SEARCH = {
	debounceMs: 100,
	indexingPollMs: 300,
	maxIndexingPolls: 20,
} as const;

let nextSeq = 1;

export interface HostSearchInput {
	readonly enabled: boolean;
	readonly text: string;
	readonly kinds: readonly SearchKind[];
	readonly context: SearchContext;
}

export interface HostSearchState {
	readonly groups: readonly SearchGroup[] | null;
	readonly pending: boolean;
}

export const IDLE_HOST_SEARCH: HostSearchState = { groups: null, pending: false };

export function sameHostInput(a: HostSearchInput, b: HostSearchInput): boolean {
	return (
		a.enabled === b.enabled &&
		a.text === b.text &&
		a.kinds.join(",") === b.kinds.join(",") &&
		a.context.projectId === b.context.projectId &&
		a.context.workspaceId === b.context.workspaceId
	);
}

export function isActiveHostInput(input: HostSearchInput): boolean {
	return input.enabled && input.text.trim().length > 0 && input.kinds.length > 0;
}

export interface HostSearchControllerDeps {
	readonly request: (params: WsParams<"search.query">) => Promise<SearchQueryResult>;
	readonly generation: () => number;
	readonly emit: (state: HostSearchState) => void;
	readonly schedule?: (run: () => void, ms: number) => () => void;
	readonly nextSeq?: () => number;
}

export interface HostSearchController {
	/** The palette's current query; `null` or an inactive input clears the host results. */
	update(input: HostSearchInput | null): void;
	dispose(): void;
}

const defaultSchedule = (run: () => void, ms: number) => {
	const timer = setTimeout(run, ms);
	return () => clearTimeout(timer);
};

export function createHostSearchController(deps: HostSearchControllerDeps): HostSearchController {
	const schedule = deps.schedule ?? defaultSchedule;
	const seqOf = deps.nextSeq ?? (() => nextSeq++);
	let current: HostSearchInput | null = null;
	let issued: { input: HostSearchInput; seq: number; generation: number } | null = null;
	let inFlight = false;
	let queued: HostSearchInput | null = null;
	let cancelDebounce: (() => void) | null = null;
	let cancelPoll: (() => void) | null = null;
	let polls = 0;
	let disposed = false;

	const issue = async (request: HostSearchInput): Promise<void> => {
		if (inFlight) {
			queued = request;
			return;
		}
		const seq = seqOf();
		const generation = deps.generation();
		issued = { input: request, seq, generation };
		inFlight = true;
		const result = await deps
			.request({
				seq,
				query: request.text,
				kinds: [...request.kinds],
				context: request.context,
			})
			.catch(() => null);
		inFlight = false;
		if (disposed) return;
		const next = queued;
		queued = null;
		if (next) {
			void issue(next);
			return;
		}
		if (!issued || issued.seq !== seq || deps.generation() !== generation) return;
		if (current === null || !sameHostInput(current, request)) return;
		if (result === null) {
			deps.emit({ groups: [], pending: false });
			return;
		}
		if (result.superseded) return;
		const indexing = result.groups.some((group) => group.state === "indexing");
		const keepPolling = indexing && polls < HOST_SEARCH.maxIndexingPolls;
		deps.emit({ groups: result.groups, pending: keepPolling });
		if (keepPolling) {
			polls += 1;
			cancelPoll = schedule(() => {
				cancelPoll = null;
				if (issued?.seq === seq) void issue(request);
			}, HOST_SEARCH.indexingPollMs);
		}
	};

	return {
		update(input) {
			cancelDebounce?.();
			cancelDebounce = null;
			cancelPoll?.();
			cancelPoll = null;
			const active = input !== null && isActiveHostInput(input);
			if (!active) {
				current = null;
				issued = null;
				queued = null;
				deps.emit(IDLE_HOST_SEARCH);
				return;
			}
			if (
				current &&
				sameHostInput(current, input) &&
				issued &&
				issued.generation === deps.generation()
			) {
				return;
			}
			current = input;
			polls = 0;
			deps.emit({ groups: null, pending: true });
			cancelDebounce = schedule(() => {
				cancelDebounce = null;
				void issue(input);
			}, HOST_SEARCH.debounceMs);
		},
		dispose() {
			disposed = true;
			cancelDebounce?.();
			cancelPoll?.();
		},
	};
}

export function useHostSearch(input: HostSearchInput): HostSearchState {
	const generation = useAppStore((s) => s.welcomeGeneration);
	const [state, setState] = useState<HostSearchState>(IDLE_HOST_SEARCH);
	const [controller] = useState(() =>
		createHostSearchController({
			request: (params) => getTransport().request("search.query", params),
			generation: () => useAppStore.getState().welcomeGeneration,
			emit: setState,
		}),
	);
	useEffect(() => () => controller.dispose(), [controller]);
	useEffect(() => {
		controller.update(input);
	}, [controller, input, generation]);
	return state;
}

const previewCache = new Map<string, Promise<SearchPreviewResult>>();
const PREVIEW_CACHE_LIMIT = 50;

export function loadHostPreview(target: SearchPreviewTarget): Promise<SearchPreviewResult> {
	const key = JSON.stringify(target);
	const cached = previewCache.get(key);
	if (cached) return cached;
	const promise = getTransport()
		.request("search.preview", target)
		.catch((): SearchPreviewResult => ({ kind: "unavailable", reason: "missing" }));
	previewCache.set(key, promise);
	if (previewCache.size > PREVIEW_CACHE_LIMIT) {
		const oldest = previewCache.keys().next().value;
		if (oldest !== undefined) previewCache.delete(oldest);
	}
	return promise;
}
