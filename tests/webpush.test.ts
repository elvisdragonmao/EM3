import assert from "node:assert/strict";
import test from "node:test";
import { b64url, utf8 } from "../worker/crypto.ts";
import { encryptPayload, isPushEndpoint, sendPush, vapidJwt } from "../worker/notify/webpush.ts";

// RFC 8291 appendix A.
const rfc = {
	plaintext: "When I grow up, I want to be a watermelon",
	asPublic: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
	asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
	uaPublic: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
	uaPrivate: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
	salt: "DGv6ra1nlYgDCS1FRnbzlw",
	auth: "BTBZMqHH6r4Tts7J_aSIgg",
	body: "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN"
};

const concat = (...parts: Uint8Array[]) => Uint8Array.from(parts.flatMap(p => [...p]));

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: string | Uint8Array, length: number) {
	const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
	return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: typeof info === "string" ? utf8(info) : info }, key, length * 8));
}

/** The receiving browser's side of RFC 8291, written independently of the sender. */
async function decrypt(body: Uint8Array, uaPublic: Uint8Array, uaPrivate: CryptoKey, auth: Uint8Array) {
	const salt = body.slice(0, 16);
	const rs = new DataView(body.buffer, body.byteOffset).getUint32(16);
	const idlen = body[20];
	const asPublic = body.slice(21, 21 + idlen);
	const ct = body.slice(21 + idlen);
	assert.equal(rs, 4096);
	assert.ok(ct.length <= rs);
	const sender = await crypto.subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
	const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: sender }, uaPrivate, 256));
	const ikm = await hkdf(auth, secret, concat(utf8("WebPush: info\0"), uaPublic, asPublic), 32);
	const cek = await crypto.subtle.importKey("raw", await hkdf(salt, ikm, "Content-Encoding: aes128gcm\0", 16), "AES-GCM", false, ["decrypt"]);
	const nonce = await hkdf(salt, ikm, "Content-Encoding: nonce\0", 12);
	const padded = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, cek, ct));
	let end = padded.length - 1;
	while (end >= 0 && padded[end] === 0) end--;
	assert.equal(padded[end], 2, "last-record delimiter");
	return new TextDecoder().decode(padded.slice(0, end));
}

const jwk = (pub: Uint8Array, d: string): JsonWebKey => ({ kty: "EC", crv: "P-256", x: b64url.encode(pub.slice(1, 33)), y: b64url.encode(pub.slice(33)), d });

test("encryptPayload matches the RFC 8291 example", async () => {
	const body = await encryptPayload(utf8(rfc.plaintext), b64url.decode(rfc.uaPublic), b64url.decode(rfc.auth), {
		salt: b64url.decode(rfc.salt),
		senderPublic: b64url.decode(rfc.asPublic),
		senderPrivate: rfc.asPrivate
	});
	assert.equal(b64url.encode(body), rfc.body);
});

test("the RFC 8291 example decrypts with the receiver's key", async () => {
	const uaPublic = b64url.decode(rfc.uaPublic);
	const key = await crypto.subtle.importKey("jwk", jwk(uaPublic, rfc.uaPrivate), { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
	assert.equal(await decrypt(b64url.decode(rfc.body), uaPublic, key, b64url.decode(rfc.auth)), rfc.plaintext);
});

test("a fresh encryption decrypts with the receiver's private key", async () => {
	const ua = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
	const uaPublic = new Uint8Array((await crypto.subtle.exportKey("raw", ua.publicKey)) as ArrayBuffer);
	const auth = crypto.getRandomValues(new Uint8Array(16));
	const message = JSON.stringify({ title: "HW 2", body: "3 小時後截止 ⏰", url: "https://e3.emtech.cc/#/courses/1/assign/2" });
	const a = await encryptPayload(utf8(message), uaPublic, auth);
	const b = await encryptPayload(utf8(message), uaPublic, auth);
	assert.notDeepEqual(a, b, "salt and sender key are random");
	assert.equal(await decrypt(a, uaPublic, ua.privateKey, auth), message);
	await assert.rejects(encryptPayload(new Uint8Array(4000), uaPublic, auth), /too large/);
});

async function vapidKeys() {
	const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
	const pub = new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer);
	const { d } = await crypto.subtle.exportKey("jwk", pair.privateKey);
	return { pair, vapid: { publicKey: b64url.encode(pub), privateKey: d!, subject: "https://e3.emtech.cc" } };
}

test("vapidJwt is an ES256 JWT for the push service origin that expires in 12 hours", async () => {
	const { pair, vapid } = await vapidKeys();
	const now = 1_800_000_000;
	const jwt = await vapidJwt(vapid, "https://fcm.googleapis.com", now);
	const [h, p, s] = jwt.split(".");
	assert.deepEqual(JSON.parse(new TextDecoder().decode(b64url.decode(h))), { typ: "JWT", alg: "ES256" });
	assert.deepEqual(JSON.parse(new TextDecoder().decode(b64url.decode(p))), { aud: "https://fcm.googleapis.com", exp: now + 12 * 3600, sub: "https://e3.emtech.cc" });
	assert.equal(b64url.decode(s).length, 64);
	assert.ok(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pair.publicKey, b64url.decode(s), utf8(`${h}.${p}`)));
});

test("sendPush posts an encrypted body with VAPID headers and reports gone subscriptions", async () => {
	const { vapid } = await vapidKeys();
	const ua = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
	const uaPublic = new Uint8Array((await crypto.subtle.exportKey("raw", ua.publicKey)) as ArrayBuffer);
	const auth = crypto.getRandomValues(new Uint8Array(16));
	const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", p256dh: b64url.encode(uaPublic), auth: b64url.encode(auth) };
	const realFetch = globalThis.fetch;
	let seen: { url: string; headers: Headers; body: Uint8Array } | null = null;
	let status = 201;
	globalThis.fetch = (async (url: string, init: RequestInit) => {
		seen = { url, headers: new Headers(init.headers), body: init.body as Uint8Array };
		return new Response(null, { status });
	}) as typeof fetch;
	try {
		const ok = await sendPush(vapid, sub, { title: "t" }, { ttl: 600, topic: "event:123/24" });
		assert.deepEqual(ok, { ok: true, status: 201, gone: false });
		const req = seen!;
		assert.equal(req.url, sub.endpoint);
		assert.match(req.headers.get("authorization")!, new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${vapid.publicKey}$`));
		assert.equal(req.headers.get("content-encoding"), "aes128gcm");
		assert.equal(req.headers.get("ttl"), "600");
		assert.equal(req.headers.get("topic"), "event12324");
		assert.equal(await decrypt(req.body, uaPublic, ua.privateKey, auth), '{"title":"t"}');

		status = 410;
		assert.deepEqual(await sendPush(vapid, sub, {}), { ok: false, status: 410, gone: true });
	} finally {
		globalThis.fetch = realFetch;
	}
});

test("isPushEndpoint only accepts known push services over HTTPS", () => {
	assert.ok(isPushEndpoint("https://fcm.googleapis.com/fcm/send/abc"));
	assert.ok(isPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc"));
	assert.ok(isPushEndpoint("https://web.push.apple.com/QF3"));
	assert.ok(isPushEndpoint("https://wns2-par02p.notify.windows.com/w/?token=abc"));
	assert.ok(!isPushEndpoint("http://fcm.googleapis.com/fcm/send/abc"));
	assert.ok(!isPushEndpoint("https://evil.example/fcm.googleapis.com"));
	assert.ok(!isPushEndpoint("https://fcm.googleapis.com.evil.example/x"));
	assert.ok(!isPushEndpoint("not a url"));
	assert.ok(!isPushEndpoint("http://localhost:9999/push"));
	assert.ok(isPushEndpoint("http://localhost:9999/push", true));
});
