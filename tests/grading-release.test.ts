import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, test } from "node:test";
import { b64, randomBytes, seal } from "../worker/crypto.ts";
import type { Env } from "../worker/env.ts";
import { buildGrades, MAX_ATTEMPTS, releaseNow, runReleases } from "../worker/grading/release.ts";

// runReleases against a real SQLite (node:sqlite behind a tiny D1 shim) and a stubbed
// fetch: nothing here ever reaches a Moodle site.

const SITE = "https://e3p.nycu.edu.tw";
const TOKEN = "0123456789abcdef0123456789abcdef";
const KEY = b64.encode(randomBytes(32));

function d1(db: DatabaseSync) {
	const stmt = (sql: string, args: unknown[] = []) => ({
		bind: (...a: unknown[]) => stmt(sql, a),
		first: async <T>() => (db.prepare(sql).get(...(args as never[])) ?? null) as T | null,
		all: async <T>() => ({ results: db.prepare(sql).all(...(args as never[])) as T[] }),
		run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...(args as never[])).changes) } })
	});
	return {
		prepare: (sql: string) => stmt(sql),
		batch: async (list: ReturnType<typeof stmt>[]) => {
			db.exec("BEGIN");
			try {
				const out = [];
				for (const s of list) out.push(await s.run());
				db.exec("COMMIT");
				return out;
			} catch (err) {
				db.exec("ROLLBACK");
				throw err;
			}
		}
	};
}

interface Call {
	fn: string;
	params: URLSearchParams;
}
let calls: Call[];
let answer: (fn: string) => unknown;
const realFetch = globalThis.fetch;
let db: DatabaseSync;
let env: Env;

beforeEach(async () => {
	db = new DatabaseSync(":memory:");
	db.exec("PRAGMA foreign_keys = ON");
	for (const f of ["0001_init.sql", "0003_grading.sql"]) db.exec(readFileSync(new URL(`../migrations/${f}`, import.meta.url), "utf8"));
	env = { DB: d1(db), TOKEN_KEY: KEY } as unknown as Env;
	db.prepare("INSERT INTO users (id, site, moodle_userid, fullname, token, token_ok, created_at, updated_at) VALUES (1, ?, 59828, 'TA A', ?, 1, 0, 0)").run(SITE, await seal(KEY, TOKEN));
	calls = [];
	answer = fn => (fn === "mod_assign_get_user_flags" ? { assignments: [{ assignmentid: 36318, userflags: [{ userid: 101, workflowstate: "inmarking" }] }], warnings: [] } : null);
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		assert.ok(url.startsWith(`${SITE}/webservice/rest/server.php`), `unexpected fetch ${url}`);
		const params = new URLSearchParams(String(init?.body));
		const fn = params.get("wsfunction")!;
		calls.push({ fn, params });
		return new Response(JSON.stringify(answer(fn)), { headers: { "content-type": "application/json" } });
	}) as typeof fetch;
});

afterEach(() => {
	globalThis.fetch = realFetch;
	db.close();
});

const schedule = (releaseAt: number, status = "scheduled", attempts = 0) =>
	db
		.prepare("INSERT INTO grading_releases (site, assign_id, course_id, owner_id, owner_name, release_at, status, attempts, updated_at) VALUES (?, 36318, 23571, 1, 'TA A', ?, ?, ?, 0)")
		.run(SITE, releaseAt, status, attempts);
const draft = (student: number, grade: number | null, feedback: string | null) =>
	db
		.prepare("INSERT INTO grading_drafts (site, assign_id, student_id, grade, feedback, grader_id, grader_name, updated_at) VALUES (?, 36318, ?, ?, ?, 59828, 'TA A', 1)")
		.run(SITE, student, grade, feedback);
const release = () => db.prepare("SELECT * FROM grading_releases WHERE assign_id = 36318").get() as { status: string; error: string | null; attempts: number; released_at: number | null };
const draftCount = () => (db.prepare("SELECT COUNT(*) AS n FROM grading_drafts").get() as { n: number }).n;
const saves = () => calls.filter(c => c.fn === "mod_assign_save_grades");

test("buildGrades matches the app's saves: latest attempt, workflow kept, comment only when the assignment has one", () => {
	assert.deepEqual(
		buildGrades(
			[
				{ student_id: 101, grade: 87.5, feedback: "<p>好</p>" },
				{ student_id: 102, grade: null, feedback: null }
			],
			{ 101: "inmarking" }
		),
		[
			{ userid: 101, grade: 87.5, attemptnumber: -1, addattempt: false, workflowstate: "inmarking", plugindata: { assignfeedbackcomments_editor: { text: "<p>好</p>", format: 1 } } },
			{ userid: 102, grade: -1, attemptnumber: -1, addattempt: false, workflowstate: "", plugindata: {} }
		]
	);
});

test("a due release writes every draft in one mod_assign_save_grades call with the owner's token", async () => {
	schedule(Date.now() - 1000);
	draft(101, 90, "<p>Nice</p>");
	draft(102, null, null);
	assert.equal(await runReleases(env), 1);
	assert.equal(saves().length, 1);
	const p = saves()[0].params;
	assert.equal(p.get("wstoken"), TOKEN);
	assert.equal(p.get("assignmentid"), "36318");
	assert.equal(p.get("applytoall"), "1");
	assert.equal(p.get("grades[0][userid]"), "101");
	assert.equal(p.get("grades[0][grade]"), "90");
	assert.equal(p.get("grades[0][attemptnumber]"), "-1");
	assert.equal(p.get("grades[0][addattempt]"), "0");
	assert.equal(p.get("grades[0][workflowstate]"), "inmarking");
	assert.equal(p.get("grades[0][plugindata][assignfeedbackcomments_editor][text]"), "<p>Nice</p>");
	assert.equal(p.get("grades[0][plugindata][assignfeedbackcomments_editor][format]"), "1");
	assert.equal(p.get("grades[1][userid]"), "102");
	assert.equal(p.get("grades[1][grade]"), "-1");
	assert.equal(p.get("grades[1][plugindata][assignfeedbackcomments_editor][text]"), null);
	assert.equal(release().status, "released");
	assert.ok(release().released_at);
	assert.equal(draftCount(), 0);
	// Nothing left to do on the next run.
	calls = [];
	assert.equal(await runReleases(env), 0);
	assert.equal(calls.length, 0);
});

test("releases that aren't due, are cancelled or were released stay untouched", async () => {
	schedule(Date.now() + 60_000);
	draft(101, 90, null);
	assert.equal(await runReleases(env), 0);
	db.prepare("UPDATE grading_releases SET status = 'cancelled', release_at = 0").run();
	assert.equal(await runReleases(env), 0);
	assert.equal(calls.length, 0);
	assert.equal(draftCount(), 1);
});

test("a failed release keeps its drafts, records the error and is retried a limited number of times", async () => {
	schedule(Date.now() - 1000);
	draft(101, 90, null);
	answer = fn => (fn === "mod_assign_save_grades" ? { exception: "moodle_exception", errorcode: "nopermission", message: "Sorry, no" } : { assignments: [] });
	for (let i = 1; i <= MAX_ATTEMPTS; i++) {
		assert.equal(await runReleases(env), 1);
		assert.equal(release().status, "failed");
		assert.equal(release().attempts, i);
		assert.equal(release().error, "Sorry, no");
	}
	assert.equal(saves().length, MAX_ATTEMPTS);
	assert.equal(await runReleases(env), 0);
	assert.equal(saves().length, MAX_ATTEMPTS);
	assert.equal(draftCount(), 1);
});

test("an owner whose Moodle sign-in expired fails without calling Moodle", async () => {
	db.prepare("UPDATE users SET token_ok = 0").run();
	schedule(Date.now() - 1000);
	draft(101, 90, null);
	await runReleases(env);
	assert.equal(calls.length, 0);
	assert.equal(release().status, "failed");
	assert.match(release().error!, /sign-in expired/);
});

test("invalidtoken from Moodle marks the owner so background jobs stop", async () => {
	schedule(Date.now() - 1000);
	draft(101, 90, null);
	answer = () => ({ exception: "moodle_exception", errorcode: "invalidtoken", message: "Invalid token" });
	await runReleases(env);
	assert.equal(release().status, "failed");
	assert.equal((db.prepare("SELECT token_ok FROM users WHERE id = 1").get() as { token_ok: number }).token_ok, 0);
});

test("a release with no drafts is marked released without writing anything", async () => {
	schedule(Date.now() - 1000);
	await runReleases(env);
	assert.equal(saves().length, 0);
	assert.equal(release().status, "released");
});

test("write now releases a cancelled release with the caller's token, and refuses while one is running", async () => {
	schedule(Date.now() + 86400_000, "cancelled");
	draft(101, 70, "<p>ok</p>");
	const user = db.prepare("SELECT * FROM users WHERE id = 1").get() as never;
	assert.deepEqual(await releaseNow(env, user, SITE, 36318, 23571), { ok: true });
	assert.equal(saves().length, 1);
	assert.equal(release().status, "released");
	assert.equal(draftCount(), 0);
	db.prepare("UPDATE grading_releases SET status = 'running'").run();
	assert.deepEqual(await releaseNow(env, user, SITE, 36318, 23571), { ok: false, error: "running" });
});
