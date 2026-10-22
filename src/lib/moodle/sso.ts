import { moodleUrl } from "./site";

// Browser SSO the way the official Moodle app does it: send the user to
// admin/tool/mobile/launch.php, which ends by redirecting to
// `<urlscheme>://token=<base64(md5(wwwroot + passport):::token[:::privatetoken])>`.
// Moodle only accepts letters, digits and `+.-` in the scheme, so `web+emthree` is the one
// scheme a web page may register a handler for. Browsers that cannot do that fall back
// to the user pasting the link from Moodle's "click here to launch the app" page.

// Browsers allow only ASCII letters after `web+` (no digits), or registerProtocolHandler throws.
export const SCHEME = "web+emthree";
const PENDING_KEY = "em3_sso";
/** Moodle keeps its launch cookie for 15 minutes. */
const PENDING_MS = 15 * 60_000;

interface Pending {
	baseUrl: string;
	passport: string;
	remember: boolean;
	/** Page to open after signing in, as for password login. */
	next?: string;
	at: number;
}

/**
 * Ask the browser to send `web+emthree:` links back to EM3. Call it while the user stays on the page
 * (when they pick an SSO school): Chrome answers with a permission prompt, which leaving for Moodle
 * right away would dismiss before the user can allow it.
 */
export function registerSsoHandler() {
	try {
		navigator.registerProtocolHandler(SCHEME, `${location.origin}${location.pathname}#/sso?u=%s`);
	} catch {
		// Missing in Safari and on insecure origins: the paste box covers those.
	}
}

export function startSso(baseUrl: string, providerId: number, remember: boolean, next?: string) {
	const passport = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("");
	const pending: Pending = { baseUrl, passport, remember, next, at: Date.now() };
	// localStorage, not sessionStorage: the protocol handler may open the result in a new tab.
	localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
	const query = new URLSearchParams({ service: "moodle_mobile_app", passport, urlscheme: SCHEME, oauthsso: String(providerId), confirmed: "1" });
	const url = `${moodleUrl(baseUrl, "admin/tool/mobile/launch.php")}?${query}`;
	// Without a protocol handler the user pastes the link back, so keep this tab on the login page.
	const tab = "registerProtocolHandler" in navigator ? null : window.open(url, "_blank");
	if (tab) tab.opener = null;
	else location.assign(url);
}

/** Verify the link from Moodle against the pending launch and return what `signInWithToken` needs. */
export function finishSso(link: string): { baseUrl: string; token: string; remember: boolean; next?: string } {
	let pending: Pending | null = null;
	try {
		pending = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null");
	} catch {
		// Treated like no pending launch.
	}
	if (!pending || Date.now() - pending.at > PENDING_MS) throw new Error("單一登入已逾時，請重新開始");
	const token = decodeSsoToken(link, pending.baseUrl, pending.passport);
	// Kept on purpose: if the sign-in that follows fails (network), the same link can be tried again. It expires on its own.
	return { baseUrl: pending.baseUrl, token, remember: pending.remember, next: pending.next };
}

/** The passport check stops a crafted link from signing the user in to someone else's account. */
export function decodeSsoToken(link: string, baseUrl: string, passport: string): string {
	let text = link.trim();
	try {
		text = decodeURIComponent(text);
	} catch {
		// Already decoded.
	}
	const encoded = (/token=(.+)$/.exec(text)?.[1] ?? text).replace(/ /g, "+");
	let parts: string[];
	try {
		parts = atob(encoded).split(":::");
	} catch {
		throw new Error("連結格式不正確");
	}
	if (parts.length < 2 || parts[0] !== md5(baseUrl + passport)) throw new Error("這個連結不是這次登入產生的，請重新按單一登入");
	return parts[1];
}

const SHIFT = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
const SINES = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32));

/** Moodle's passport check is MD5 and SubtleCrypto has none. */
export function md5(text: string): string {
	const bytes = new TextEncoder().encode(text);
	const blocks = ((bytes.length + 8) >>> 6) + 1;
	const words = new Uint32Array(blocks * 16);
	bytes.forEach((b, i) => (words[i >> 2] |= b << ((i % 4) * 8)));
	words[bytes.length >> 2] |= 0x80 << ((bytes.length % 4) * 8);
	words[blocks * 16 - 2] = bytes.length * 8;
	const state = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
	for (let i = 0; i < words.length; i += 16) {
		let [a, b, c, d] = state;
		for (let j = 0; j < 64; j++) {
			let f: number, g: number;
			if (j < 16) [f, g] = [(b & c) | (~b & d), j];
			else if (j < 32) [f, g] = [(d & b) | (~d & c), (5 * j + 1) % 16];
			else if (j < 48) [f, g] = [b ^ c ^ d, (3 * j + 5) % 16];
			else [f, g] = [c ^ (b | ~d), (7 * j) % 16];
			const t = (a + f + SINES[j] + words[i + g]) | 0;
			const s = SHIFT[(j >> 4) * 4 + (j % 4)];
			[a, d, c, b] = [d, c, b, (b + ((t << s) | (t >>> (32 - s)))) | 0];
		}
		[a, b, c, d].forEach((v, k) => (state[k] = (state[k] + v) | 0));
	}
	return state.map(v => Array.from({ length: 4 }, (_, i) => ((v >>> (i * 8)) & 255).toString(16).padStart(2, "0")).join("")).join("");
}
