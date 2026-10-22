import assert from "node:assert/strict";
import test from "node:test";
import { fromTaipei, toTaipei } from "../src/features/teaching/collab-time.ts";
import { splitByRanges, splitEvenly, summarize } from "../src/features/teaching/allocation.ts";

const students = ["112550010", "112550002", "112550001", "", "112550100", "112550011", "9"].map((sid, i) => ({ id: i + 1, sid, name: `S${i}` }));

test("splitEvenly gives consecutive 學號 blocks that differ by at most one", () => {
	const map = splitEvenly(students, [10, 20, 30]);
	const { shares, unassigned } = summarize(map, students, [10, 20, 30]);
	assert.equal(unassigned, 0);
	assert.deepEqual(
		shares.map(s => s.count),
		[3, 2, 2]
	);
	// Numeric order: "9" first, the student without a 學號 last.
	assert.deepEqual(shares[0], { grader: 10, count: 3, first: "9", last: "112550002" });
	assert.deepEqual(shares[2], { grader: 30, count: 2, first: "112550100", last: "112550100" });
	assert.equal(map[4], 30);
	assert.deepEqual(splitEvenly(students, []), {});
});

test("splitByRanges uses inclusive, open-ended ranges and reports who is left over", () => {
	const { map, unassigned } = splitByRanges(students, [
		{ grader: 10, from: "112550001", to: "112550010" },
		{ grader: 20, from: "112550011", to: "" },
		{ grader: 30, from: "", to: "" }
	]);
	assert.equal(map[3], 10);
	assert.equal(map[1], 10);
	assert.equal(map[6], 20);
	assert.equal(map[5], 20);
	// "9" is below every range; empty ranges match no one; no 學號 never matches.
	assert.deepEqual(
		unassigned.map(s => s.sid),
		["9", ""]
	);
});

test("Taipei date and time round-trip", () => {
	const ms = fromTaipei("2026-10-24", "20:00")!;
	assert.equal(new Date(ms).toISOString(), "2026-10-24T12:00:00.000Z");
	assert.deepEqual(toTaipei(ms), { date: "2026-10-24", time: "20:00" });
	assert.equal(fromTaipei("", "20:00"), null);
});
