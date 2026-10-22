import assert from "node:assert/strict";
import test from "node:test";
import { parseScheduleCode } from "../src/features/timetable/periods.ts";
import { entriesFromSyllabus, nycuKey, nycuKeys } from "../src/features/timetable/syllabus.ts";
import { setMoodleBaseUrl } from "../src/lib/moodle/client.ts";
import { DEFAULT_MOODLE_URL } from "../src/lib/moodle/site.ts";
import type { Env } from "../worker/env.ts";
import { HttpError } from "../worker/http.ts";
import { parseKeys, readCosTime, schedules } from "../worker/nycu.ts";

const course = (id: number, year: number, term: 1 | 2 | 3, code: string) => ({ id, semester: { year, term }, code });

test("syllabus keys use the term letter NYCU's timetable expects", () => {
	assert.equal(nycuKey(course(1, 115, 1, "515516")), "115-1-515516");
	assert.equal(nycuKey(course(2, 114, 3, "500123")), "114-X-500123");
	assert.equal(nycuKey({ id: 3, semester: null, code: null }), null);
	assert.deepEqual([...nycuKeys([course(1, 115, 1, "515516"), { id: 3, semester: null, code: "x" }])], [["115-1-515516", 1]]);
});

test("syllabus times drop the campus and keep rooms with dashes", () => {
	setMoodleBaseUrl(DEFAULT_MOODLE_URL);
	assert.deepEqual(parseScheduleCode("R34-EC114[GF]"), {
		slots: [
			{ day: 3, period: "3" },
			{ day: 3, period: "4" }
		],
		room: "EC114"
	});
	assert.equal(parseScheduleCode("F12-CS-PC2[GF]").room, "CS-PC2");
	assert.equal(parseScheduleCode("T34R7-EC022[GF]").slots.length, 3);
	assert.equal(parseScheduleCode("M5-YM101[YM],W34-YM101[YM]").room, "YM101");
});

test("syllabus answers become timetable entries; empty and missing ones are skipped", () => {
	setMoodleBaseUrl(DEFAULT_MOODLE_URL);
	const keys = nycuKeys([course(10, 115, 1, "515516"), course(11, 115, 1, "519511"), course(12, 115, 1, "515505")]);
	const entries = entriesFromSyllabus(keys, { "115-1-515516": "R34-EC114[GF]", "115-1-519511": null }, parseScheduleCode);
	assert.deepEqual(Object.keys(entries), ["10"]);
	assert.equal(entries[10].room, "EC114");
});

test("the server reads cos_time and rejects bad keys", () => {
	assert.equal(readCosTime({ cos_time: " R34-EC114[GF] " }), "R34-EC114[GF]");
	assert.equal(readCosTime(false), "");
	assert.equal(readCosTime({ cos_time: "" }), "");
	assert.deepEqual(parseKeys("115-1-515516,115-1-515516,114-X-1"), ["115-1-515516", "114-X-1"]);
	assert.deepEqual(parseKeys(null), []);
	assert.throws(() => parseKeys("115-3-1"), HttpError);
	assert.throws(() => parseKeys("115-1-1;drop"), HttpError);
	assert.throws(() => parseKeys(Array.from({ length: 41 }, (_, i) => `115-1-${i}`).join(",")), HttpError);
});

/** Just enough of D1 for nycu_schedules. */
function fakeDb(rows: { course_key: string; cos_time: string; fetched_at: number }[]) {
	const table = new Map(rows.map(r => [r.course_key, r]));
	return {
		table,
		prepare: (sql: string) => ({
			bind: (...args: unknown[]) => ({
				sql,
				args,
				all: async () => ({ results: args.map(k => table.get(k as string)).filter(Boolean) }),
				run: async () => {
					const [course_key, cos_time, fetched_at] = args as [string, string, number];
					table.set(course_key, { course_key, cos_time, fetched_at });
				}
			})
		}),
		batch: async (stmts: { run: () => Promise<void> }[]) => {
			for (const s of stmts) await s.run();
		}
	};
}

test("schedules come from the cache when fresh and from the syllabus otherwise", async t => {
	const now = 1_800_000_000_000;
	const db = fakeDb([
		{ course_key: "115-1-1", cos_time: "M1-A[GF]", fetched_at: now - 3600_000 },
		// Stale: refetched, and kept if the syllabus can't be reached.
		{ course_key: "115-1-2", cos_time: "T2-B[GF]", fetched_at: now - 48 * 3600_000 },
		// An empty answer is cached for a shorter time.
		{ course_key: "115-1-3", cos_time: "", fetched_at: now - 7 * 3600_000 }
	]);
	const asked: string[] = [];
	t.mock.method(console, "warn", () => {});
	t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
		const form = new URLSearchParams(String(init.body));
		asked.push(form.get("cos_id")!);
		if (form.get("cos_id") === "2") throw new TypeError("timeout");
		if (form.get("cos_id") === "4") return new Response("false");
		return new Response(JSON.stringify({ cos_time: "W34-C[GF]" }));
	});
	const writes: Promise<unknown>[] = [];
	const out = await schedules({ DB: db } as unknown as Env, ["115-1-1", "115-1-2", "115-1-3", "115-1-4", "115-1-5"], now, p => writes.push(p));
	await Promise.all(writes);
	assert.deepEqual(asked.sort(), ["2", "3", "4", "5"]);
	assert.deepEqual(out, { "115-1-1": "M1-A[GF]", "115-1-2": "T2-B[GF]", "115-1-3": "W34-C[GF]", "115-1-4": null, "115-1-5": "W34-C[GF]" });
	// The failed fetch isn't cached as empty; the others are.
	assert.equal(db.table.get("115-1-2")!.fetched_at, now - 48 * 3600_000);
	assert.equal(db.table.get("115-1-4")!.cos_time, "");
	assert.equal(db.table.get("115-1-5")!.fetched_at, now);
});

test("a course the syllabus couldn't answer and that was never cached is left out", async t => {
	t.mock.method(console, "warn", () => {});
	t.mock.method(globalThis, "fetch", async () => new Response("bad gateway", { status: 502 }));
	const out = await schedules({ DB: fakeDb([]) } as unknown as Env, ["115-1-9"], Date.now());
	assert.deepEqual(out, {});
});
