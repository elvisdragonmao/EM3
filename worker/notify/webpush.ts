// Web Push without a third-party service: VAPID (RFC 8292) and aes128gcm payload
// encryption (RFC 8291, RFC 8188), all on WebCrypto so it runs in the Worker and in Node tests.

import { b64url, utf8 } from "../crypto";

export interface PushSubscriptionKeys {
	endpoint: string;
	/** Base64url of the browser's uncompressed P-256 public key (65 bytes). */
	p256dh: string;
	/** Base64url of the 16-byte auth secret. */
	auth: string;
}

export interface Vapid {
	publicKey: string;
	privateKey: string;
	subject: string;
}

const concat = (...parts: Uint8Array[]) => {
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let i = 0;
	for (const p of parts) {
		out.set(p, i);
		i += p.length;
	}
	return out;
};

/** A P-256 private key as JWK, which needs the public point alongside the scalar. */
function ecJwk(publicRaw: Uint8Array, d?: string): JsonWebKey {
	if (publicRaw.length !== 65 || publicRaw[0] !== 4) throw new Error("expected an uncompressed P-256 public key");
	return { kty: "EC", crv: "P-256", x: b64url.encode(publicRaw.slice(1, 33)), y: b64url.encode(publicRaw.slice(33)), ...(d ? { d } : {}), ext: true };
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
	const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
	return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
}

export interface EncryptOptions {
	/** Fixed values for tests (RFC 8291 appendix A); random in real use. */
	salt?: Uint8Array;
	senderPublic?: Uint8Array;
	senderPrivate?: string;
}

/** Encrypts one push message body as a single aes128gcm record (RFC 8291 §3.4). */
export async function encryptPayload(plaintext: Uint8Array, p256dh: Uint8Array, authSecret: Uint8Array, opts: EncryptOptions = {}): Promise<Uint8Array> {
	if (plaintext.length > 3993) throw new Error("push payload too large");
	const salt = opts.salt ?? crypto.getRandomValues(new Uint8Array(16));
	let senderKey: CryptoKey;
	let senderPublic: Uint8Array;
	if (opts.senderPrivate && opts.senderPublic) {
		senderPublic = opts.senderPublic;
		senderKey = await crypto.subtle.importKey("jwk", ecJwk(senderPublic, opts.senderPrivate), { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
	} else {
		const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
		senderKey = pair.privateKey;
		senderPublic = new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer);
	}
	const receiver = await crypto.subtle.importKey("raw", p256dh, { name: "ECDH", namedCurve: "P-256" }, false, []);
	// workers-types spell the standard `public` member `$public`; the runtime takes `public`.
	const ecdh = { name: "ECDH", public: receiver } as unknown as Parameters<typeof crypto.subtle.deriveBits>[0];
	const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits(ecdh, senderKey, 256));

	const ikm = await hkdf(authSecret, ecdhSecret, concat(utf8("WebPush: info\0"), p256dh, senderPublic), 32);
	const cek = await hkdf(salt, ikm, utf8("Content-Encoding: aes128gcm\0"), 16);
	const nonce = await hkdf(salt, ikm, utf8("Content-Encoding: nonce\0"), 12);

	const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
	// 0x02 marks the last (and only) record; no padding.
	const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, concat(plaintext, new Uint8Array([2]))));

	const header = new Uint8Array(21);
	header.set(salt);
	new DataView(header.buffer).setUint32(16, 4096);
	header[20] = senderPublic.length;
	return concat(header, senderPublic, ct);
}

const signingKeys = new Map<string, Promise<CryptoKey>>();

/** A VAPID JWT for one push service origin (RFC 8292 §2). */
export async function vapidJwt(vapid: Vapid, audience: string, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
	let key = signingKeys.get(vapid.privateKey);
	if (!key) {
		key = crypto.subtle.importKey("jwk", ecJwk(b64url.decode(vapid.publicKey), vapid.privateKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
		signingKeys.set(vapid.privateKey, key);
	}
	const enc = (v: unknown) => b64url.encode(utf8(JSON.stringify(v)));
	const input = `${enc({ typ: "JWT", alg: "ES256" })}.${enc({ aud: audience, exp: nowSec + 12 * 3600, sub: vapid.subject })}`;
	// WebCrypto's ECDSA signature is already the raw r‖s form JWS wants.
	const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, await key, utf8(input)));
	return `${input}.${b64url.encode(sig)}`;
}

export interface PushResult {
	ok: boolean;
	status: number;
	/** The subscription is gone for good (404/410) and should be deleted. */
	gone: boolean;
}

export async function sendPush(vapid: Vapid, sub: PushSubscriptionKeys, payload: unknown, opts: { ttl?: number; urgency?: "normal" | "high"; topic?: string } = {}): Promise<PushResult> {
	const body = await encryptPayload(utf8(JSON.stringify(payload)), b64url.decode(sub.p256dh), b64url.decode(sub.auth));
	const headers: Record<string, string> = {
		authorization: `vapid t=${await vapidJwt(vapid, new URL(sub.endpoint).origin)}, k=${vapid.publicKey}`,
		"content-encoding": "aes128gcm",
		"content-type": "application/octet-stream",
		ttl: String(opts.ttl ?? 86400),
		urgency: opts.urgency ?? "normal"
	};
	// A newer message with the same topic replaces an undelivered older one.
	if (opts.topic) headers.topic = opts.topic.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
	try {
		const res = await fetch(sub.endpoint, { method: "POST", headers, body });
		return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410 };
	} catch {
		return { ok: false, status: 0, gone: false };
	}
}

// Push services of the browsers EM3 supports. The server only POSTs to these, so a
// made-up "subscription" can't turn it into a request relay.
const PUSH_HOSTS = ["fcm.googleapis.com", "android.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com"];

/** `dev` also allows a local mock push service (only when DEV_ORIGIN is set). */
export function isPushEndpoint(endpoint: string, dev = false) {
	try {
		const u = new URL(endpoint);
		if (dev && u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1")) return true;
		return u.protocol === "https:" && !u.username && !u.password && PUSH_HOSTS.some(h => u.hostname === h || u.hostname.endsWith(`.${h}`));
	} catch {
		return false;
	}
}

/** Which push service a subscription uses, for test results ("Chrome", "Firefox"…). */
export function pushService(endpoint: string): "google" | "mozilla" | "apple" | "microsoft" | "other" {
	const host = new URL(endpoint).hostname;
	if (host.endsWith("googleapis.com")) return "google";
	if (host.endsWith("mozilla.com")) return "mozilla";
	if (host.endsWith("apple.com")) return "apple";
	if (host.endsWith("windows.com")) return "microsoft";
	return "other";
}
