import { useSession } from "@/features/auth/session";
import { getLocale } from "@/i18n";
import { getToken } from "@/lib/moodle/client";
import { api, type ServerAccount, ServerError } from "@/lib/server/api";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// Which version this device uses (DESIGN.md, 伺服器版). The choice is per device and
// never synced: it decides whether anything is synced at all.

export type DataMode = "server" | "local";
export type LinkStatus = "off" | "linking" | "linked" | "error";

interface ServerState {
	/** null until the user picks one in the first-sign-in dialog. */
	mode: DataMode | null;
	status: LinkStatus;
	account: ServerAccount | null;
	/** Why linking failed, for the settings page. */
	error: string | null;
	setMode: (mode: DataMode | null) => void;
}

export const useServer = create<ServerState>()(
	persist(
		set => ({
			mode: null,
			status: "off",
			account: null,
			error: null,
			setMode: mode => set({ mode })
		}),
		{ name: "em3:server", version: 1, partialize: s => ({ mode: s.mode }) }
	)
);

/** True when server features can be used right now. */
export const useServerReady = () => useServer(s => s.mode === "server" && s.status === "linked");

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Hands the current Moodle token to the EM3 server and starts a server session. */
export async function linkServer(): Promise<boolean> {
	const { baseUrl } = useSession.getState();
	const token = getToken();
	if (!token) return false;
	useServer.setState({ status: "linking", error: null });
	try {
		const account = await api<ServerAccount>("session", { method: "POST", body: { site: baseUrl, token, locale: getLocale() } });
		useServer.setState({ status: "linked", account });
		return true;
	} catch (err) {
		useServer.setState({ status: "error", account: null, error: errorText(err) });
		return false;
	}
}

let checking: Promise<void> | null = null;

/** Makes sure the server session belongs to the signed-in Moodle user, relinking when it doesn't. */
export function ensureLinked(): Promise<void> {
	checking ??= (async () => {
		const { baseUrl, userid } = useSession.getState();
		if (useServer.getState().mode !== "server" || !getToken()) return;
		try {
			const account = await api<ServerAccount>("session");
			if (account.site !== baseUrl || account.userid !== userid || !account.tokenOk) {
				await linkServer();
				return;
			}
			if (account.locale !== getLocale()) {
				await api("session/locale", { method: "PUT", body: { locale: getLocale() } }).catch(() => {});
				account.locale = getLocale();
			}
			useServer.setState({ status: "linked", account, error: null });
		} catch (err) {
			if (err instanceof ServerError && err.status === 401) await linkServer();
			else useServer.setState({ status: "error", error: errorText(err) });
		}
	})().finally(() => (checking = null));
	return checking;
}

/** Switches to the local version and deletes everything the server keeps for this account. */
export async function leaveServer() {
	try {
		await api("account", { method: "DELETE" });
	} catch (err) {
		// No session means there is nothing on the server to delete for this device.
		if (!(err instanceof ServerError && err.status === 401)) throw err;
	}
	useServer.setState({ mode: "local", status: "off", account: null, error: null });
}

// Signing out of EM3 ends this device's server session too. Reminders keep running,
// since the account stays; deleting it is a separate choice in the settings.
useSession.subscribe((s, prev) => {
	if (prev.token && !s.token && useServer.getState().status !== "off") {
		void api("session", { method: "DELETE" }).catch(() => {});
		useServer.setState({ status: "off", account: null });
	}
});
