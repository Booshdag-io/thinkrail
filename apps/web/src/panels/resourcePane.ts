import type { GitDiffScope } from "@thinkrail/contracts";
import {
	describeResource,
	inferredMime,
	PENDING_TEXT_META,
	resolveRenderers,
	selectResourceRenderer,
} from "@thinkrail/resource-renderers";
import { useEffect, useRef } from "react";
import { useAppStore } from "../store";
import { getTransport } from "../transport";

export const FILES_ROUTE = "/files";
export const BLOB_ROUTE = "/blob";

function encodeResourcePath(path: string): string {
	return path.split("/").map(encodeURIComponent).join("/");
}

export function resourceBytesUrl(workspaceId: string, path: string, oid?: string | null): string {
	const base = getTransport().httpBase();
	const workspace = encodeURIComponent(workspaceId);
	return oid
		? `${base}${BLOB_ROUTE}/${workspace}/${encodeURIComponent(oid)}/${encodeResourcePath(path)}`
		: `${base}${FILES_ROUTE}/${workspace}/${encodeResourcePath(path)}`;
}

function inferredBinary(path: string): boolean {
	const mime = inferredMime(path);
	return (
		mime !== undefined &&
		(mime === "application/pdf" || mime.startsWith("image/")) &&
		mime !== "image/svg+xml"
	);
}

export function diffRendererSupportsLayout(
	workspaceId: string,
	path: string,
	scope: GitDiffScope,
	selectedId: string | undefined,
	mobile: boolean,
): boolean {
	const meta = inferredBinary(path) ? { ...PENDING_TEXT_META, text: false } : PENDING_TEXT_META;
	const candidates = resolveRenderers(describeResource(workspaceId, path, meta, scope), "diff", {
		mobile,
	});
	return selectResourceRenderer(candidates, selectedId, path).capabilities.layout;
}

export function useResetViewStateOnImplementationChange(
	workspaceId: string,
	tabId: string,
	implementationKey: string,
): void {
	const previousRef = useRef({ workspaceId, tabId, implementationKey });
	useEffect(() => {
		const previous = previousRef.current;
		previousRef.current = { workspaceId, tabId, implementationKey };
		if (
			previous.workspaceId === workspaceId &&
			previous.tabId === tabId &&
			previous.implementationKey !== implementationKey
		) {
			useAppStore.getState().setTabViewState(workspaceId, tabId, undefined);
		}
	}, [workspaceId, tabId, implementationKey]);
}
