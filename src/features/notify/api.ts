import { useServer } from "@/features/server/store";
import { api } from "@/lib/server/api";
import { isIos, isStandalone } from "@/shared/pwa/install";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Reminder settings and this device's push subscription (docs/server.md, worker/notify).

export interface NotifySettings {
	enabled: boolean;
	leadHours: number[];
	deadlines: boolean;
	grading: boolean;
	/** The webhook itself never comes back from the server; only a masked hint. */
	discord: { set: boolean; hint: string | null };
	pushDevices: number;
}

export interface NotifyPatch {
	enabled?: boolean;
	leadHours?: number[];
	deadlines?: boolean;
	grading?: boolean;
	discordWebhook?: string | null;
}

export interface TestResult {
	channel: "push" | "discord";
	ok: boolean;
	status: number;
	gone: boolean;
	service?: "google" | "mozilla" | "apple" | "microsoft" | "other";
	endpoint?: string;
	error?: string;
}

/** Keyed by account, so a different Moodle user on this browser never sees the cached settings. */
function useNotifyKey() {
	const account = useServer(s => s.account);
	return ["server", account?.site, account?.userid, "notify"] as const;
}

export function useNotifySettings() {
	return useQuery({ queryKey: useNotifyKey(), queryFn: ({ signal }) => api<NotifySettings>("notify", { signal }), staleTime: 60_000 });
}

export function useUpdateNotify() {
	const qc = useQueryClient();
	const key = useNotifyKey();
	const mutation = useMutation({
		mutationKey: key,
		mutationFn: (patch: NotifyPatch) => api<NotifySettings>("notify", { method: "PUT", body: patch }),
		// An older save finishing late mustn't undo a newer local change; the last one's answer wins.
		onSuccess: data => void (qc.isMutating({ mutationKey: key }) <= 1 && qc.setQueryData(key, data)),
		onError: () => void qc.invalidateQueries({ queryKey: key })
	});
	return {
		...mutation,
		/** The settings as they are now, including changes still being saved. */
		current: () => qc.getQueryData<NotifySettings>(key),
		/** Applies the change locally right away, so quick successive clicks build on each other. */
		save(patch: NotifyPatch) {
			void qc.cancelQueries({ queryKey: key });
			const prev = qc.getQueryData<NotifySettings>(key);
			const { discordWebhook: _, ...rest } = patch;
			if (prev) qc.setQueryData<NotifySettings>(key, { ...prev, ...rest });
			return mutation.mutateAsync(patch);
		}
	};
}

export function useRefreshNotify() {
	const qc = useQueryClient();
	const key = useNotifyKey();
	return () => qc.invalidateQueries({ queryKey: key });
}

export const sendTest = () => api<{ results: TestResult[] }>("notify/test", { method: "POST" });

/** Same shape the server accepts; checked here too so the field can say what's wrong before saving. */
export const isDiscordWebhook = (url: string) => /^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\/\d{5,25}\/[\w-]{20,100}$/.test(url.trim());

// --- Web Push on this device ---

export type PushState = "unsupported" | "needsInstall" | "denied" | "on" | "off";

const supported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** iOS only offers Web Push to apps added to the home screen. */
export function pushBlocker(): PushState | null {
	if (isIos() && !isStandalone()) return "needsInstall";
	if (!supported()) return "unsupported";
	if (Notification.permission === "denied") return "denied";
	return null;
}

async function registration() {
	const existing = await navigator.serviceWorker.getRegistration();
	if (existing) return existing;
	// The production build registers sw.js at startup; the dev server doesn't, so register it here.
	// `?dev` keeps its caching off, which would otherwise serve stale Vite modules.
	await navigator.serviceWorker.register(import.meta.env.DEV ? "./sw.js?dev" : "./sw.js");
	return navigator.serviceWorker.ready;
}

export async function currentSubscription() {
	if (!supported()) return null;
	const reg = await navigator.serviceWorker.getRegistration();
	return (await reg?.pushManager.getSubscription()) ?? null;
}

function b64urlBytes(text: string) {
	const s = atob(text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4));
	return Uint8Array.from(s, c => c.charCodeAt(0));
}

const sameKey = (a: ArrayBuffer | null | undefined, b: Uint8Array) => !!a && a.byteLength === b.length && new Uint8Array(a).every((x, i) => x === b[i]);

/** Asks for permission, subscribes with the server's VAPID key and registers the subscription. Returns the new state. */
export async function enablePush(): Promise<PushState> {
	const blocked = pushBlocker();
	if (blocked) return blocked;
	const permission = await Notification.requestPermission();
	if (permission !== "granted") return permission === "denied" ? "denied" : "off";
	const { key } = await api<{ key: string }>("push/key");
	const serverKey = b64urlBytes(key);
	const reg = await registration();
	let sub = await reg.pushManager.getSubscription();
	// A subscription made with an older VAPID key can't be reused.
	if (sub && !sameKey(sub.options.applicationServerKey, serverKey)) {
		await sub.unsubscribe();
		sub = null;
	}
	sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: serverKey });
	await api("push", { method: "POST", body: sub.toJSON() });
	return "on";
}

export async function disablePush(): Promise<PushState> {
	const sub = await currentSubscription();
	if (sub) {
		await api("push", { method: "DELETE", body: { endpoint: sub.endpoint } });
		await sub.unsubscribe();
	}
	return pushBlocker() ?? "off";
}

/** This device's state; an existing subscription is re-sent so the server has it even after the account was recreated. */
export async function readPushState(): Promise<PushState> {
	const blocked = pushBlocker();
	if (blocked) return blocked;
	const sub = await currentSubscription();
	if (!sub || Notification.permission !== "granted") return "off";
	await api("push", { method: "POST", body: sub.toJSON() }).catch(() => {});
	return "on";
}
