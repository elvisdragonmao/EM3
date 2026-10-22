import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { decodeSsoToken, finishSso, md5, SCHEME } from "../src/lib/moodle/sso.ts";

test("md5 matches node:crypto, including multi-block and non-ASCII input", () => {
	for (const text of ["", "a", "abc", "https://ecourse2.ccu.edu.tw" + "f".repeat(32), "x".repeat(55), "x".repeat(56), "x".repeat(64), "x".repeat(300), "中正大學"]) {
		assert.equal(md5(text), createHash("md5").update(text).digest("hex"), JSON.stringify(text));
	}
});

const base = "https://ecourse2.ccu.edu.tw";
const link = (siteid: string, ...rest: string[]) => `web+emthree://token=${Buffer.from([siteid, ...rest].join(":::")).toString("base64")}`;

test("decodeSsoToken returns the token when the passport matches", () => {
	const siteid = md5(base + "pp");
	assert.equal(decodeSsoToken(link(siteid, "tok123"), base, "pp"), "tok123");
	assert.equal(decodeSsoToken(link(siteid, "tok123", "private"), base, "pp"), "tok123");
});

test("decodeSsoToken accepts a percent-encoded link and a bare base64 string", () => {
	const siteid = md5(base + "pp");
	assert.equal(decodeSsoToken(encodeURIComponent(link(siteid, "tok123")), base, "pp"), "tok123");
	assert.equal(decodeSsoToken(link(siteid, "tok123").replace("web+emthree://token=", ""), base, "pp"), "tok123");
});

test("decodeSsoToken rejects a link made for another passport or site", () => {
	assert.throws(() => decodeSsoToken(link(md5(base + "other"), "tok123"), base, "pp"), /不是這次登入/);
	assert.throws(() => decodeSsoToken(link(md5("https://evil.example" + "pp"), "tok123"), base, "pp"), /不是這次登入/);
});

test("decodeSsoToken rejects garbage", () => {
	assert.throws(() => decodeSsoToken("not a link!!", base, "pp"), /連結/);
});

const KEY = "em3_sso";
const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
	configurable: true,
	value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) }
});
const pending = (over: object = {}) => store.set(KEY, JSON.stringify({ baseUrl: base, passport: "pp", remember: true, next: "/tasks", at: Date.now(), ...over }));

test("finishSso returns the token and where to go next", () => {
	pending();
	assert.deepEqual(finishSso(link(md5(base + "pp"), "tok123")), { baseUrl: base, token: "tok123", remember: true, next: "/tasks" });
});

test("finishSso keeps the pending launch, so a failed sign-in can retry the same link or fix a wrong paste", () => {
	pending();
	assert.throws(() => finishSso("garbage"), /連結/);
	assert.equal(finishSso(link(md5(base + "pp"), "tok123")).token, "tok123");
	assert.equal(finishSso(link(md5(base + "pp"), "tok123")).token, "tok123");
});

test("finishSso refuses an expired or missing launch", () => {
	pending({ at: Date.now() - 16 * 60_000 });
	assert.throws(() => finishSso(link(md5(base + "pp"), "tok123")), /逾時/);
	store.clear();
	assert.throws(() => finishSso(link(md5(base + "pp"), "tok123")), /逾時/);
});

test("the protocol scheme is one browsers and Moodle's launch.php both accept", () => {
	assert.match(SCHEME, /^web\+[a-z]+$/); // registerProtocolHandler: ASCII letters only after "web+"
	assert.match(SCHEME, /^[a-zA-Z][a-zA-Z0-9-+.]*$/); // launch.php's urlscheme check
});
