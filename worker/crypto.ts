// Small WebCrypto helpers shared by the Worker modules (and the Node tests).

export const b64 = {
	encode: (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)),
	decode: (text: string) => Uint8Array.from(atob(text), c => c.charCodeAt(0))
};

export const b64url = {
	encode: (bytes: Uint8Array) => b64.encode(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
	decode: (text: string) => b64.decode(text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4))
};

export const utf8 = (text: string) => new TextEncoder().encode(text);

export function randomBytes(n: number) {
	return crypto.getRandomValues(new Uint8Array(n));
}

export async function sha256Hex(text: string) {
	const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", utf8(text)));
	return Array.from(digest, b => b.toString(16).padStart(2, "0")).join("");
}

const keys = new Map<string, Promise<CryptoKey>>();
const aesKey = (secret: string) => {
	let key = keys.get(secret);
	if (!key) {
		key = crypto.subtle.importKey("raw", b64.decode(secret), "AES-GCM", false, ["encrypt", "decrypt"]);
		keys.set(secret, key);
	}
	return key;
};

/** AES-256-GCM; the result is base64 of IV (12 bytes) followed by the ciphertext. */
export async function seal(secret: string, plaintext: string): Promise<string> {
	const iv = randomBytes(12);
	const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(secret), utf8(plaintext)));
	const out = new Uint8Array(iv.length + ct.length);
	out.set(iv);
	out.set(ct, iv.length);
	return b64.encode(out);
}

export async function open(secret: string, sealed: string): Promise<string> {
	const bytes = b64.decode(sealed);
	const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, await aesKey(secret), bytes.slice(12));
	return new TextDecoder().decode(pt);
}
