import { callAs, type User } from "../auth";
import type { Env } from "../env";
import { HttpError } from "../http";
import { MoodleError } from "../moodle";

// Every grading route runs as the caller: their own token must be able to grade in
// the course. The answer is cached briefly in grading_access.

const TTL = 10 * 60_000;
/** A missing assignment triggers a refresh, but not more often than this (new assignments, typos). */
const MISS_REFRESH = 30_000;

interface AccessRow {
	can_grade: number;
	assignments: string;
	checked_at: number;
}

interface AdminOptions {
	courses: { id: number; options: { name: string; available: boolean }[] }[];
}

interface AssignmentsResponse {
	courses: { id: number; assignments: { id: number; grade: number }[] }[];
}

export interface Access {
	/** Assignment instance id → max grade (0 or less for scales). */
	assignments: Record<string, number>;
}

/** Moodle failures as HTTP errors the client can show. */
export async function moodle<T>(env: Env, user: User, fn: string, params: Parameters<typeof callAs>[3] = {}): Promise<T> {
	try {
		return await callAs<T>(env, user, fn, params);
	} catch (err) {
		if (err instanceof MoodleError) throw new HttpError(err.isAuthError ? 401 : 502, `Moodle: ${err.message}`);
		throw err;
	}
}

export const positiveInt = (raw: string | undefined, what: string) => {
	const n = Number(raw);
	if (!Number.isSafeInteger(n) || n <= 0) throw new HttpError(400, `invalid ${what}`);
	return n;
};

async function check(env: Env, user: User, courseId: number): Promise<{ canGrade: boolean; assignments: Record<string, number> }> {
	const res = await moodle<AdminOptions>(env, user, "core_course_get_user_administration_options", { courseids: [courseId] });
	const on = new Set((res.courses.find(c => c.id === courseId)?.options ?? []).filter(o => o.available).map(o => o.name));
	// Same rule as the app's useTeaching (src/features/teaching/api.ts).
	const canGrade = on.has("gradebook") || on.has("update");
	const assignments: Record<string, number> = {};
	if (canGrade) {
		const list = await moodle<AssignmentsResponse>(env, user, "mod_assign_get_assignments", { courseids: [courseId] });
		for (const a of list.courses.find(c => c.id === courseId)?.assignments ?? []) assignments[a.id] = a.grade;
	}
	const t = Date.now();
	await env.DB.prepare(
		`INSERT INTO grading_access (user_id, course_id, can_grade, assignments, checked_at) VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT (user_id, course_id) DO UPDATE SET can_grade = excluded.can_grade, assignments = excluded.assignments, checked_at = excluded.checked_at`
	)
		.bind(user.id, courseId, canGrade ? 1 : 0, JSON.stringify(assignments), t)
		.run();
	return { canGrade, assignments };
}

/** Throws 403 unless the user can grade in the course, and 404 when the assignment isn't one of its. */
export async function requireGrader(env: Env, user: User, courseId: number, assignId?: number): Promise<Access> {
	const row = await env.DB.prepare("SELECT can_grade, assignments, checked_at FROM grading_access WHERE user_id = ? AND course_id = ?").bind(user.id, courseId).first<AccessRow>();
	const age = row ? Date.now() - row.checked_at : Infinity;
	let state = row && age < TTL ? { canGrade: !!row.can_grade, assignments: JSON.parse(row.assignments) as Record<string, number> } : await check(env, user, courseId);
	if (state.canGrade && assignId && !(assignId in state.assignments) && row && age < TTL && age > MISS_REFRESH) state = await check(env, user, courseId);
	if (!state.canGrade) throw new HttpError(403, "you can't grade in this course");
	if (assignId && !(assignId in state.assignments)) throw new HttpError(404, "assignment not in this course");
	return { assignments: state.assignments };
}

interface EnrolledUser {
	id: number;
	fullname: string;
	roles?: { shortname: string }[];
}

// Everyone with a role other than these can be picked as a grader (E3 has editingteacher,
// teacher and its own TA roles such as ta_a).
const NOT_GRADERS = new Set(["student", "guest", "user", "frontpage"]);

export async function courseMembers(env: Env, user: User, courseId: number) {
	const users = await moodle<EnrolledUser[]>(env, user, "core_enrol_get_enrolled_users", { courseid: courseId, options: [{ name: "userfields", value: "id,fullname,roles" }] });
	const graders = users.filter(u => u.roles?.some(r => !NOT_GRADERS.has(r.shortname))).map(u => ({ id: u.id, name: u.fullname, roles: (u.roles ?? []).map(r => r.shortname) }));
	return { graders, enrolled: new Set(users.map(u => u.id)) };
}
