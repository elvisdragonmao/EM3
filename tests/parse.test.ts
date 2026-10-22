import assert from "node:assert/strict";
import test from "node:test";
import { parseCourse } from "../src/features/courses/parse.ts";
import type { EnrolledCourse } from "../src/lib/moodle/types.ts";

test("CCU course shortnames give the semester and course code", () => {
	const c = parseCourse({ id: 1, shortname: "115_1_4105402_01", fullname: "Techniques of Network Attacks and Defenses網路安全攻防技術" } as EnrolledCourse);
	assert.equal(c.semester?.code, "1151");
	assert.equal(c.code, "4105402");
	assert.equal(c.kind, "semester");
});
