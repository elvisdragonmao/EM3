import assert from "node:assert/strict";
import test from "node:test";
import { setLocale } from "../src/i18n/index.ts";
import { call, getMoodleBaseUrl, MoodleError, requestToken, setMoodleBaseUrl, setToken } from "../src/lib/moodle/client.ts";

// Error messages are translated; Node's default locale is English, so pin the source language.
setLocale("zh-TW");

test("requestToken posts credentials to the selected Moodle installation", async t => {
	let requested = "";
	let body = "";
	t.mock.method(globalThis, "fetch", async (input, init) => {
		requested = String(input);
		body = String(init?.body);
		return new Response(JSON.stringify({ token: "site-token" }), { headers: { "content-type": "application/json" } });
	});

	assert.deepEqual(await requestToken("https://lms.example.edu.tw/moodle", "student", "secret"), { token: "site-token" });
	assert.equal(requested, "https://lms.example.edu.tw/moodle/login/token.php");
	assert.match(body, /username=student/);
	assert.match(body, /service=moodle_mobile_app/);
});

test("requestToken explains unreachable or CORS-blocked Moodle sites", async t => {
	t.mock.method(globalThis, "fetch", async () => {
		throw new TypeError("Failed to fetch");
	});

	await assert.rejects(requestToken("https://blocked.example.edu.tw", "student", "secret"), (error: unknown) => {
		assert.ok(error instanceof MoodleError);
		assert.equal(error.code, "network");
		assert.match(error.message, /行動版 API|跨網域/);
		return true;
	});
});

test("requestToken explains non-JSON responses from non-Moodle sites", async t => {
	t.mock.method(globalThis, "fetch", async () => new Response("<!doctype html><title>Not Moodle</title>", { headers: { "content-type": "text/html" } }));

	await assert.rejects(requestToken("https://example.edu.tw", "student", "secret"), (error: unknown) => {
		assert.ok(error instanceof MoodleError);
		assert.equal(error.code, "notmoodle");
		assert.match(error.message, /不是 Moodle|行動版 API/);
		return true;
	});
});

test("requestToken errors follow the UI language", async t => {
	t.mock.method(globalThis, "fetch", async () => {
		throw new TypeError("Failed to fetch");
	});
	setLocale("en");
	try {
		await assert.rejects(requestToken("https://blocked.example.edu.tw", "student", "secret"), /mobile API/);
	} finally {
		setLocale("zh-TW");
	}
});

test("call uses the Moodle URL configured for the active session", async t => {
	let requested = "";
	t.mock.method(globalThis, "fetch", async input => {
		requested = String(input);
		return new Response(JSON.stringify({ userid: 7 }), { headers: { "content-type": "application/json" } });
	});
	setMoodleBaseUrl("https://lms.example.edu.tw/moodle/");
	setToken("site-token");

	assert.deepEqual(await call("core_webservice_get_site_info"), { userid: 7 });
	assert.equal(getMoodleBaseUrl(), "https://lms.example.edu.tw/moodle");
	assert.equal(requested, "https://lms.example.edu.tw/moodle/webservice/rest/server.php?wsfunction=core_webservice_get_site_info");
});
