import { callAs, type User } from "../auth";
import type { Env } from "../env";

// Scheduled grade release: grades wait in grading_drafts until release_at, then the
// release owner's token writes them all with one mod_assign_save_grades call.

/** A failed release is retried on the next cron runs, up to this many attempts in all. */
export const MAX_ATTEMPTS = 3;
/** A release left "running" this long (the Worker died mid-write) is picked up again. */
const STALE_RUN = 10 * 60_000;

export interface ReleaseRow {
	site: string;
	assign_id: number;
	course_id: number;
	owner_id: number;
	owner_name: string;
	release_at: number;
	notify_students: number;
	status: "scheduled" | "running" | "released" | "failed" | "cancelled";
	error: string | null;
	released_at: number | null;
	attempts: number;
	claimed_at: number | null;
	updated_at: number;
}

export interface DraftRow {
	site: string;
	assign_id: number;
	student_id: number;
	grade: number | null;
	/** Feedback comment HTML, or null when the assignment has no comment feedback. */
	feedback: string | null;
	grader_id: number;
	grader_name: string;
	updated_at: number;
}

/**
 * The mod_assign_save_grades grades, built like the app's own saves (useSaveGrade and the
 * CSV import): latest attempt, no new attempt, the current marking-workflow state kept.
 */
export function buildGrades(drafts: Pick<DraftRow, "student_id" | "grade" | "feedback">[], workflow: Record<number, string> = {}) {
	return drafts.map(d => ({
		userid: d.student_id,
		grade: d.grade ?? -1,
		attemptnumber: -1,
		addattempt: false,
		workflowstate: workflow[d.student_id] ?? "",
		plugindata: d.feedback === null ? {} : { assignfeedbackcomments_editor: { text: d.feedback, format: 1 } }
	}));
}

interface UserFlags {
	assignments: { assignmentid: number; userflags: { userid: number; workflowstate: string }[] }[];
}

/** Writes every draft of the release to Moodle as `owner`; deletes the drafts that went out. Returns how many were written. */
export async function writeRelease(env: Env, owner: User, rel: Pick<ReleaseRow, "site" | "assign_id">): Promise<number> {
	const drafts = (await env.DB.prepare("SELECT * FROM grading_drafts WHERE site = ? AND assign_id = ? ORDER BY student_id").bind(rel.site, rel.assign_id).all<DraftRow>()).results;
	if (!drafts.length) return 0;
	// Only matters with marking workflow on, but it is a cheap read and keeps states as they are.
	const flags = await callAs<UserFlags>(env, owner, "mod_assign_get_user_flags", { assignmentids: [rel.assign_id] });
	const workflow = Object.fromEntries((flags.assignments?.find(a => a.assignmentid === rel.assign_id)?.userflags ?? []).map(f => [f.userid, f.workflowstate ?? ""]));
	// Moodle's web services always notify students when a grade changes (assign::apply_grade_to_user),
	// so there is no notification switch to pass here.
	await callAs<null>(env, owner, "mod_assign_save_grades", { assignmentid: rel.assign_id, applytoall: true, grades: buildGrades(drafts, workflow) });
	// A draft edited while the write was in flight stays for the next release.
	await env.DB.batch(
		drafts.map(d => env.DB.prepare("DELETE FROM grading_drafts WHERE site = ? AND assign_id = ? AND student_id = ? AND updated_at = ?").bind(d.site, d.assign_id, d.student_id, d.updated_at))
	);
	return drafts.length;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 500);

async function finish(env: Env, rel: ReleaseRow, owner: User | null) {
	const t = Date.now();
	try {
		if (!owner) throw new Error("the release owner's EM3 account no longer exists");
		if (!owner.token_ok) throw new Error("the release owner's Moodle sign-in expired; they need to open EM3 again");
		await writeRelease(env, owner, rel);
		await env.DB.prepare("UPDATE grading_releases SET status = 'released', released_at = ?, error = NULL, claimed_at = NULL, updated_at = ? WHERE site = ? AND assign_id = ? AND status = 'running'")
			.bind(t, t, rel.site, rel.assign_id)
			.run();
		return { ok: true as const };
	} catch (err) {
		await env.DB.prepare("UPDATE grading_releases SET status = 'failed', error = ?, claimed_at = NULL, updated_at = ? WHERE site = ? AND assign_id = ? AND status = 'running'")
			.bind(message(err), t, rel.site, rel.assign_id)
			.run();
		return { ok: false as const, error: message(err) };
	}
}

/** Called by the cron: releases everything that is due, plus failed ones that still have attempts left. */
export async function runReleases(env: Env, now = Date.now()) {
	const claimed = (
		await env.DB.prepare(
			`UPDATE grading_releases SET status = 'running', claimed_at = ?, attempts = attempts + 1
			 WHERE release_at <= ? AND (status = 'scheduled' OR (status = 'failed' AND attempts < ?) OR (status = 'running' AND claimed_at < ? AND attempts < ?))
			 RETURNING *`
		)
			.bind(now, now, MAX_ATTEMPTS, now - STALE_RUN, MAX_ATTEMPTS)
			.all<ReleaseRow>()
	).results;
	for (const rel of claimed) {
		const owner = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(rel.owner_id).first<User>();
		await finish(env, rel, owner);
	}
	return claimed.length;
}

/** "Write now": releases one assignment immediately with the caller's token, whatever its schedule. */
export async function releaseNow(env: Env, user: User, site: string, assignId: number, courseId: number) {
	const t = Date.now();
	// Claims the row so the cron can't write the same drafts at the same time.
	const rel = await env.DB.prepare(
		`INSERT INTO grading_releases (site, assign_id, course_id, owner_id, owner_name, release_at, status, claimed_at, attempts, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, 'running', ?, 1, ?)
		 ON CONFLICT (site, assign_id) DO UPDATE SET owner_id = excluded.owner_id, owner_name = excluded.owner_name, release_at = excluded.release_at,
		   status = 'running', claimed_at = excluded.claimed_at, attempts = 1, error = NULL, updated_at = excluded.updated_at
		 WHERE grading_releases.status != 'running'
		 RETURNING *`
	)
		.bind(site, assignId, courseId, user.id, user.fullname, t, t, t)
		.first<ReleaseRow>();
	if (!rel) return { ok: false as const, error: "running" };
	return finish(env, rel, user);
}
