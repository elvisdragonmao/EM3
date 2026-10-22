// Merge rules for settings sync (sync.ts). No imports, so the Node tests can load it.
//
// The server keeps one copy per account and lets the newer `updatedAt` win. On top of that,
// every top-level setting carries the client time of its last change (`_stamps` inside the
// synced data), and each side keeps the newer value per setting. So a colour changed on one
// device and the theme changed on another both survive, and a device that missed a change
// notices on its next pull and sends it again.

export type Stamps = Record<string, number>;
export type Data = Record<string, unknown>;

export const STAMPS_KEY = "_stamps";

export interface SyncMeta {
	/** The account ("site#userid") these stamps belong to; another account starts fresh. */
	owner: string | null;
	/** Client time of the last change to each setting this device knows of. */
	stamps: Stamps;
	/** The server's `updatedAt` this device last saw; null = never synced with `owner`. */
	syncedAt: number | null;
	/** This device has changes the server hasn't stored yet. */
	dirty: boolean;
}

export const EMPTY_META: SyncMeta = { owner: null, stamps: {}, syncedAt: null, dirty: false };

export type Remote = { data: Data; updatedAt: number } | { data: null };

export interface Merge {
	/** Settings to take from the server, or null when nothing changes here. */
	apply: Data | null;
	stamps: Stamps;
	/** The merged copy differs from the server's, so it has to be sent. */
	push: boolean;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function remoteStamps(remote: { data: Data; updatedAt: number }): Stamps {
	const s = remote.data[STAMPS_KEY];
	return typeof s === "object" && s !== null && !Array.isArray(s) ? (s as Stamps) : {};
}

/** Combines this device's settings with the server's copy, per setting, newer wins. */
export function merge(keys: string[], local: Data, meta: SyncMeta, owner: string, remote: Remote): Merge {
	if (remote.data === null) return { apply: null, stamps: meta.stamps, push: true };
	const rs = remoteStamps(remote);
	const stampOf = (k: string) => (typeof rs[k] === "number" ? rs[k] : remote.updatedAt);
	// A device that has never synced with this account takes the server's copy whole, so a fresh
	// browser's defaults never overwrite what the student set elsewhere.
	const fresh = meta.owner !== owner || meta.syncedAt === null;
	const apply: Data = {};
	const stamps: Stamps = fresh ? {} : { ...meta.stamps };
	let push = false;
	for (const k of keys) {
		if (!(k in remote.data)) {
			// Written by a version of EM3 without this setting.
			push = true;
			continue;
		}
		if (fresh || stampOf(k) > (meta.stamps[k] ?? 0)) {
			stamps[k] = stampOf(k);
			if (!same(local[k], remote.data[k])) apply[k] = remote.data[k];
		} else if (!same(local[k], remote.data[k])) push = true;
	}
	return { apply: Object.keys(apply).length ? apply : null, stamps, push };
}

/** What a PUT sends: the settings plus their stamps. */
export const payload = (local: Data, stamps: Stamps): Data => ({ ...local, [STAMPS_KEY]: stamps });

/** A timestamp the server accepts as newer than the copy this device last saw. */
export const nextUpdatedAt = (syncedAt: number | null, now = Date.now()) => Math.max(now, (syncedAt ?? 0) + 1);

/** Stamps the settings that changed between two states. */
export function stampChanges(keys: string[], prev: Data, next: Data, stamps: Stamps, now = Date.now()): Stamps | null {
	const changed = keys.filter(k => prev[k] !== next[k]);
	if (!changed.length) return null;
	const out = { ...stamps };
	for (const k of changed) out[k] = Math.max(now, (stamps[k] ?? 0) + 1);
	return out;
}

export function readMeta(raw: string | null): SyncMeta {
	try {
		const m = JSON.parse(raw ?? "null") as Partial<SyncMeta> | null;
		if (m && typeof m === "object" && typeof m.stamps === "object" && m.stamps)
			return { owner: typeof m.owner === "string" ? m.owner : null, stamps: m.stamps, syncedAt: typeof m.syncedAt === "number" ? m.syncedAt : null, dirty: !!m.dirty };
	} catch {
		// Fall through to a fresh start.
	}
	return EMPTY_META;
}
