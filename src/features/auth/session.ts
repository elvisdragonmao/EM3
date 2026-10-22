import { clearPrivateCache } from "@/app/queryClient";
import { deleteCookie, readCookie, writeCookie } from "@/lib/cookie";
import { call, requestToken, setMoodleBaseUrl, setToken } from "@/lib/moodle/client";
import { DEFAULT_MOODLE_URL, normalizeMoodleUrl } from "@/lib/moodle/site";
import type { SiteInfo } from "@/lib/moodle/types";
import { create } from "zustand";

const COOKIE = "em3_session";
/** Moodle mobile tokens can live for months when the user opts to stay signed in. */
const COOKIE_DAYS = 90;

interface StoredSession {
	token: string;
	userid: number;
	baseUrl?: string;
}

interface SessionState {
	token: string | null;
	userid: number | null;
	baseUrl: string;
	signIn: (baseUrl: string, username: string, password: string, remember: boolean) => Promise<SiteInfo>;
	/** For SSO sites, where Moodle hands out the token instead of exchanging a password. */
	signInWithToken: (baseUrl: string, token: string, remember: boolean) => Promise<SiteInfo>;
	signOut: () => void;
}

function loadSession(): StoredSession | null {
	try {
		const raw = readCookie(COOKIE);
		if (!raw) return null;
		const value = JSON.parse(raw) as Partial<StoredSession>;
		if (typeof value.token !== "string" || !value.token || typeof value.userid !== "number") return null;
		return { token: value.token, userid: value.userid, baseUrl: value.baseUrl ? normalizeMoodleUrl(value.baseUrl) : DEFAULT_MOODLE_URL };
	} catch {
		return null;
	}
}

const LAST_SITE_KEY = "em3_last_site";

/** The school of the last successful sign-in, so the login page opens on it again after signing out. */
export function lastSite(): string | null {
	try {
		return localStorage.getItem(LAST_SITE_KEY);
	} catch {
		return null;
	}
}

const initial = loadSession();
const initialBaseUrl = initial?.baseUrl ?? DEFAULT_MOODLE_URL;
setMoodleBaseUrl(initialBaseUrl);
setToken(initial?.token ?? null);

export const useSession = create<SessionState>((set, get) => ({
	token: initial?.token ?? null,
	userid: initial?.userid ?? null,
	baseUrl: initialBaseUrl,
	async signIn(baseUrl, username, password, remember) {
		const { token } = await requestToken(baseUrl, username.trim(), password);
		return get().signInWithToken(baseUrl, token, remember);
	},
	async signInWithToken(baseUrl, token, remember) {
		const normalizedBaseUrl = normalizeMoodleUrl(baseUrl);
		const previousBaseUrl = get().baseUrl;
		const previousToken = get().token;
		setMoodleBaseUrl(normalizedBaseUrl);
		setToken(token);
		let info: SiteInfo;
		try {
			info = await call<SiteInfo>("core_webservice_get_site_info");
			await clearPrivateCache();
		} catch (error) {
			setMoodleBaseUrl(previousBaseUrl);
			setToken(previousToken);
			throw error;
		}
		const session: StoredSession = { token, userid: info.userid, baseUrl: normalizedBaseUrl };
		// "Remember me" off still uses a cookie, but one that expires in a day.
		writeCookie(COOKIE, JSON.stringify(session), remember ? COOKIE_DAYS : 1);
		set({ ...session, baseUrl: normalizedBaseUrl });
		try {
			localStorage.setItem(LAST_SITE_KEY, normalizedBaseUrl);
		} catch {
			// Storage blocked (private mode): the login page falls back to the default school.
		}
		return info;
	},
	signOut() {
		deleteCookie(COOKIE);
		setToken(null);
		set({ token: null, userid: null });
	}
}));
