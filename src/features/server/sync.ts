import { DEFAULT_PREFS, type Prefs, usePrefs } from "@/features/preferences/store";
import { api } from "@/lib/server/api";
import { useEffect } from "react";
import { create } from "zustand";
import { useServer } from "./store";
import { type Data, merge, nextUpdatedAt, payload, readMeta, type Remote, type SyncMeta, stampChanges } from "./syncRules";

// Settings sync for the server version: GET/PUT /api/prefs (DESIGN.md, 伺服器版). Pull once
// when linked and whenever the tab comes back; push about 2 s after a change. The merge
// rules are in syncRules.ts.

const META_KEY = "em3:prefs-sync";
const DEBOUNCE = 2000;
/** Focus and visibilitychange often fire together. */
const PULL_GAP = 3000;
const KEYS = Object.keys(DEFAULT_PREFS) as (keyof Prefs)[];

type PutResult = { stored: true; updatedAt: number } | { stored: false; data: Data; updatedAt: number };

export interface SyncStatus {
	state: "idle" | "syncing" | "ok" | "error";
	/** When this device last agreed with the server. */
	at: number | null;
}

export const useSyncStatus = create<SyncStatus>(() => ({ state: "idle", at: null }));

function loadMeta(): SyncMeta {
	try {
		return readMeta(localStorage.getItem(META_KEY));
	} catch {
		return readMeta(null);
	}
}

let meta = loadMeta();
function saveMeta(patch: Partial<SyncMeta>) {
	meta = { ...meta, ...patch };
	try {
		localStorage.setItem(META_KEY, JSON.stringify(meta));
	} catch {
		// Private mode: sync still works for this visit.
	}
}

const snapshot = (): Data => {
	const s = usePrefs.getState();
	return Object.fromEntries(KEYS.map(k => [k, s[k]]));
};

/** The account the initial pull finished for; nothing is pushed before it. */
let ready: string | null = null;
let applying = false;
/** Bumped on every local change, to tell whether one happened while a push was in flight. */
let generation = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let queue = Promise.resolve();
let lastPull = 0;

// Every local change is stamped, in either version, so this device always knows how new each setting is.
usePrefs.subscribe((s, prev) => {
	if (applying) return;
	const stamps = stampChanges(KEYS, prev as unknown as Data, s as unknown as Data, meta.stamps);
	if (!stamps) return;
	generation++;
	saveMeta({ stamps, dirty: true });
	if (ready) {
		clearTimeout(timer);
		timer = setTimeout(() => {
			timer = undefined;
			void enqueue(push);
		}, DEBOUNCE);
	}
});

function apply(data: Data) {
	const known = Object.fromEntries(Object.entries(data).filter(([k]) => k in DEFAULT_PREFS)) as Partial<Prefs>;
	// The pulled values must not count as a local change, or they would be pushed straight back.
	applying = true;
	try {
		usePrefs.getState().replaceAll({ ...(snapshot() as Partial<Prefs>), ...known });
	} finally {
		applying = false;
	}
}

const ownerNow = () => {
	const { mode, status, account } = useServer.getState();
	return mode === "server" && status === "linked" && account ? `${account.site}#${account.userid}` : null;
};

function enqueue(step: (owner: string) => Promise<void>) {
	queue = queue.then(async () => {
		const owner = ownerNow();
		if (!owner) return;
		useSyncStatus.setState({ state: "syncing" });
		try {
			await step(owner);
			useSyncStatus.setState({ state: "ok", at: Date.now() });
		} catch {
			useSyncStatus.setState({ state: "error" });
		}
	});
	return queue;
}

/** Folds the server's copy into this device's and records the result; true when the server needs the merged copy. */
function absorb(owner: string, remote: Remote): boolean {
	const m = merge(KEYS, snapshot(), meta, owner, remote);
	if (m.apply) apply(m.apply);
	saveMeta({ owner, stamps: m.stamps, syncedAt: remote.data ? remote.updatedAt : meta.owner === owner ? meta.syncedAt : null, dirty: m.push });
	return m.push;
}

async function pull(owner: string) {
	lastPull = Date.now();
	const remote = await api<Remote>("prefs");
	if (ownerNow() !== owner) return;
	const needsPush = absorb(owner, remote);
	ready = owner;
	if (needsPush) await push(owner);
}

async function push(owner: string, retry = true) {
	if (ready !== owner || !meta.dirty) return;
	const sent = generation;
	const res = await api<PutResult>("prefs", { method: "PUT", body: { data: payload(snapshot(), meta.stamps), updatedAt: nextUpdatedAt(meta.syncedAt) } });
	if (res.stored) saveMeta({ syncedAt: res.updatedAt, dirty: generation !== sent });
	// Another device wrote in between: merge its copy, and send the result once more if ours still adds something.
	else if (absorb(owner, res) && retry) await push(owner, false);
}

/** Pulls now, e.g. from a retry button. */
export const syncNow = () => enqueue(pull);

/** Mounted once in the app shell through useServerLink. */
export function usePrefsSync() {
	const owner = useServer(s => (s.mode === "server" && s.status === "linked" && s.account ? `${s.account.site}#${s.account.userid}` : null));
	useEffect(() => {
		if (!owner) {
			ready = null;
			useSyncStatus.setState({ state: "idle", at: null });
			return;
		}
		void enqueue(pull);
		const onFocus = () => {
			if (Date.now() - lastPull > PULL_GAP) void enqueue(pull);
		};
		const onVisibility = () => {
			if (document.visibilityState === "visible") onFocus();
			// Leaving the tab sends a pending change now instead of waiting out the debounce.
			else if (timer !== undefined) {
				clearTimeout(timer);
				timer = undefined;
				void enqueue(push);
			}
		};
		window.addEventListener("focus", onFocus);
		document.addEventListener("visibilitychange", onVisibility);
		return () => {
			window.removeEventListener("focus", onFocus);
			document.removeEventListener("visibilitychange", onVisibility);
			clearTimeout(timer);
			ready = null;
		};
	}, [owner]);
}
