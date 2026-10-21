import type { ProviderStatus } from "@thinkrail/contracts";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@thinkrail/ui/dialog";
import { useAppStore } from "@/store";
import { getTransport } from "@/transport";
import { announceProviderConnected, ConnectProviderOptions } from "./ConnectProviderOptions";
import { useProviderAuth } from "./useProviderAuth";

function cancelUnownedLogin(): void {
	const login = useAppStore.getState().activeLogin;
	if (!login || login.target) return;
	if (login.status === "active") {
		getTransport()
			.request("provider.loginCancel", { loginId: login.loginId })
			.catch(() => {});
	}
	useAppStore.getState().clearLogin();
}

export function ConnectProviderDialog({
	onClose,
	onConnected,
}: {
	onClose: () => void;
	onConnected?: (provider: ProviderStatus) => void;
}) {
	const settingsOpen = useAppStore((s) => s.settingsOpen);
	const auth = useProviderAuth({ ownsLoginDialog: !settingsOpen });

	return (
		<>
			<Dialog
				open
				onOpenChange={(open) => {
					if (open) return;
					cancelUnownedLogin();
					onClose();
				}}
			>
				<DialogContent
					data-testid="connect-provider-dialog"
					className="max-h-[85vh] max-w-[36rem] gap-16 overflow-y-auto"
				>
					<DialogHeader>
						<DialogTitle>Pick how the agent will run</DialogTitle>
						<DialogDescription>
							The agent needs a model provider. Start with one of these — every provider is in
							Settings.
						</DialogDescription>
					</DialogHeader>
					<ConnectProviderOptions
						auth={auth}
						onShowAll={() => {
							onClose();
							useAppStore.getState().openSettings("providers");
						}}
						onConnected={(provider) => {
							useAppStore.getState().clearLogin();
							void announceProviderConnected(provider);
							onClose();
							onConnected?.(provider);
						}}
					/>
				</DialogContent>
			</Dialog>
			{auth.loginDialog}
		</>
	);
}
