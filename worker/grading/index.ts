import { requireUser, type User } from "../auth";
import type { Env } from "../env";
import { type Ctx, HttpError, json, readJson, type Route, route } from "../http";
import { type Access, courseMembers, positiveInt, requireGrader } from "./access";
import { type DraftRow, releaseNow, type ReleaseRow, runReleases as run } from "./release";

// TA collaboration: allocations, grading locks, scheduled release (DESIGN.md, 伺服器版).
// Rows are shared by everyone who can grade in the course; every route checks that
// the caller can, with their own Moodle token.

const LOCK_MS = 2 * 60_000;
const MAX_FEEDBACK = 64 * 1024;
const MAX_ROWS = 2000;

export const runReleases = (env: Env) => run(env);

interface Scope {
	user: User;
	course: number;
	assign: number;
	access: Access;
}

async function courseScope(ctx: Ctx) {
	const user = await requireUser(ctx);
	const course = positiveInt(ctx.params.course, "course");
	const access = await requireGrader(ctx.env, user, course);
	return { user, course, access };
}

async function assignScope(ctx: Ctx): Promise<Scope> {
	const user = await requireUser(ctx);
	const course = positiveInt(ctx.params.course, "course");
	const assign = positiveInt(ctx.params.assign, "assignment");
	const access = await requireGrader(ctx.env, user, course, assign);
	return { user, course, assign, access };
}

const lockOut = (r: { student_id: number; grader_id: number; grader_name: string; expires_at: number }) => ({
	student: r.student_id,
	grader: r.grader_id,
	graderName: r.grader_name,
	expiresAt: r.expires_at
});

const draftOut = (d: DraftRow) => ({ student: d.student_id, grade: d.grade, feedback: d.feedback, grader: d.grader_id, graderName: d.grader_name, updatedAt: d.updated_at });

const releaseOut = (r: ReleaseRow | null) =>
	r && {
		releaseAt: r.release_at,
		notifyStudents: !!r.notify_students,
		status: r.status,
		error: r.error,
		releasedAt: r.released_at,
		attempts: r.attempts,
		ownerName: r.owner_name,
		updatedAt: r.updated_at
	};

async function releaseRow(env: Env, site: string, assign: number) {
	return env.DB.prepare("SELECT * FROM grading_releases WHERE site = ? AND assign_id = ?").bind(site, assign).first<ReleaseRow>();
}

/** Validates one draft against the assignment's max grade. */
function draftInput(raw: unknown, max: number) {
	const d = (raw ?? {}) as { student?: unknown; grade?: unknown; feedback?: unknown };
	const student = positiveInt(String(d.student), "student");
	let grade: number | null = null;
	if (d.grade !== null && d.grade !== undefined) {
		if (typeof d.grade !== "number" || !Number.isFinite(d.grade) || d.grade < 0 || (max > 0 && d.grade > max)) throw new HttpError(400, `grade out of range for ${student}`);
		grade = d.grade;
	}
	if (d.feedback !== null && d.feedback !== undefined && (typeof d.feedback !== "string" || d.feedback.length > MAX_FEEDBACK)) throw new HttpError(400, `invalid feedback for ${student}`);
	return { student, grade, feedback: typeof d.feedback === "string" ? d.feedback : null };
}

async function requireScheduled(env: Env, site: string, assign: number) {
	const rel = await releaseRow(env, site, assign);
	if (rel?.status !== "scheduled" && rel?.status !== "failed") throw new HttpError(409, "no scheduled release for this assignment");
	return rel;
}

const upsertDraft = (env: Env, s: Scope, d: ReturnType<typeof draftInput>, t: number) =>
	env.DB.prepare(
		`INSERT INTO grading_drafts (site, assign_id, student_id, grade, feedback, grader_id, grader_name, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT (site, assign_id, student_id) DO UPDATE SET grade = excluded.grade, feedback = excluded.feedback, grader_id = excluded.grader_id,
		   grader_name = excluded.grader_name, updated_at = excluded.updated_at`
	).bind(s.user.site, s.assign, d.student, d.grade, d.feedback, s.user.moodle_userid, s.user.fullname, t);

export const routes: Route[] = [
	// Teachers and TAs of the course, for the allocation editor. They don't need to use EM3.
	route("GET", "/api/grading/:course/graders", async ctx => {
		const { user, course } = await courseScope(ctx);
		const { graders } = await courseMembers(ctx.env, user, course);
		return json({ graders });
	}),

	route("GET", "/api/grading/:course/allocations", async ctx => {
		const { user, course } = await courseScope(ctx);
		const rows = (
			await ctx.env.DB.prepare(
				"SELECT a.student_id, a.grader_id, a.grader_name, a.updated_at, u.fullname AS updated_by_name FROM grading_allocations a LEFT JOIN users u ON u.id = a.updated_by WHERE a.site = ? AND a.course_id = ?"
			)
				.bind(user.site, course)
				.all<{ student_id: number; grader_id: number; grader_name: string; updated_at: number; updated_by_name: string | null }>()
		).results;
		const graders = new Map(rows.map(r => [r.grader_id, r.grader_name]));
		return json({
			allocations: Object.fromEntries(rows.map(r => [r.student_id, r.grader_id])),
			graders: [...graders].map(([id, name]) => ({ id, name })),
			updatedAt: rows[0]?.updated_at ?? null,
			updatedByName: rows[0]?.updated_by_name ?? null
		});
	}),

	// Replaces the whole split; an empty map removes it.
	route("PUT", "/api/grading/:course/allocations", async ctx => {
		const { user, course } = await courseScope(ctx);
		const { allocations } = await readJson<{ allocations?: Record<string, number> }>(ctx.req);
		if (!allocations || typeof allocations !== "object") throw new HttpError(400, "allocations must be an object");
		const entries = Object.entries(allocations);
		if (entries.length > MAX_ROWS) throw new HttpError(400, "too many students");
		const { graders, enrolled } = await courseMembers(ctx.env, user, course);
		const names = new Map(graders.map(g => [g.id, g.name]));
		const rows = entries.map(([s, g]) => {
			const student = positiveInt(s, "student");
			if (!enrolled.has(student)) throw new HttpError(400, `user ${student} is not in this course`);
			if (!names.has(g)) throw new HttpError(400, `user ${g} is not a teacher or TA of this course`);
			return { student, grader: g };
		});
		const t = Date.now();
		const db = ctx.env.DB;
		await db.batch([
			db.prepare("DELETE FROM grading_allocations WHERE site = ? AND course_id = ?").bind(user.site, course),
			...rows.map(r =>
				db
					.prepare("INSERT INTO grading_allocations (site, course_id, student_id, grader_id, grader_name, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
					.bind(user.site, course, r.student, r.grader, names.get(r.grader)!, user.id, t)
			)
		]);
		return json({ ok: true, count: rows.length, updatedAt: t });
	}),

	// Everything the grading list needs, polled every ~20 s: who is grading whom, the release and its drafts.
	route("GET", "/api/grading/:course/assign/:assign", async ctx => {
		const s = await assignScope(ctx);
		const t = Date.now();
		const db = ctx.env.DB;
		const [locks, drafts, rel] = await Promise.all([
			db.prepare("SELECT * FROM grading_locks WHERE site = ? AND assign_id = ? AND expires_at > ?").bind(s.user.site, s.assign, t).all<Parameters<typeof lockOut>[0]>(),
			db.prepare("SELECT * FROM grading_drafts WHERE site = ? AND assign_id = ? ORDER BY updated_at DESC").bind(s.user.site, s.assign).all<DraftRow>(),
			releaseRow(ctx.env, s.user.site, s.assign)
		]);
		ctx.waitUntil(
			db
				.prepare("DELETE FROM grading_locks WHERE expires_at < ?")
				.bind(t - LOCK_MS)
				.run()
		);
		return json({ locks: locks.results.map(lockOut), drafts: drafts.results.map(draftOut), release: releaseOut(rel), now: t });
	}),

	// Heartbeat. The lock is advisory: it is taken when free, expired or already ours, and the
	// response says who holds it.
	route("POST", "/api/grading/:course/assign/:assign/locks/:student", async ctx => {
		const s = await assignScope(ctx);
		const student = positiveInt(ctx.params.student, "student");
		const t = Date.now();
		const row = await ctx.env.DB.prepare(
			`INSERT INTO grading_locks (site, assign_id, student_id, grader_id, grader_name, expires_at) VALUES (?, ?, ?, ?, ?, ?)
			 ON CONFLICT (site, assign_id, student_id) DO UPDATE SET grader_id = excluded.grader_id, grader_name = excluded.grader_name, expires_at = excluded.expires_at
			 WHERE grading_locks.grader_id = excluded.grader_id OR grading_locks.expires_at <= ?`
		)
			.bind(s.user.site, s.assign, student, s.user.moodle_userid, s.user.fullname, t + LOCK_MS, t)
			.run()
			.then(() => ctx.env.DB.prepare("SELECT * FROM grading_locks WHERE site = ? AND assign_id = ? AND student_id = ?").bind(s.user.site, s.assign, student).first<Parameters<typeof lockOut>[0]>());
		return json({ lock: row && lockOut(row), mine: row?.grader_id === s.user.moodle_userid });
	}),

	route("DELETE", "/api/grading/:course/assign/:assign/locks/:student", async ctx => {
		const s = await assignScope(ctx);
		const student = positiveInt(ctx.params.student, "student");
		await ctx.env.DB.prepare("DELETE FROM grading_locks WHERE site = ? AND assign_id = ? AND student_id = ? AND grader_id = ?").bind(s.user.site, s.assign, student, s.user.moodle_userid).run();
		return json({ ok: true });
	}),

	// Schedules (or reschedules) the release; the caller's token will write the grades.
	route("PUT", "/api/grading/:course/assign/:assign/release", async ctx => {
		const s = await assignScope(ctx);
		const { releaseAt, notifyStudents = true } = await readJson<{ releaseAt?: number; notifyStudents?: boolean }>(ctx.req);
		const t = Date.now();
		if (typeof releaseAt !== "number" || !Number.isFinite(releaseAt) || releaseAt < t - 60_000 || releaseAt > t + 366 * 86400_000)
			throw new HttpError(400, "releaseAt must be a time in the coming year");
		// Moodle's web services notify students on every grade change; pretending otherwise would mislead.
		if (notifyStudents !== true) throw new HttpError(400, "Moodle always notifies students when grades are written through its web services");
		const rel = await ctx.env.DB.prepare(
			`INSERT INTO grading_releases (site, assign_id, course_id, owner_id, owner_name, release_at, notify_students, status, attempts, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, 1, 'scheduled', 0, ?)
			 ON CONFLICT (site, assign_id) DO UPDATE SET course_id = excluded.course_id, owner_id = excluded.owner_id, owner_name = excluded.owner_name,
			   release_at = excluded.release_at, status = 'scheduled', attempts = 0, error = NULL, released_at = NULL, claimed_at = NULL, updated_at = excluded.updated_at
			 WHERE grading_releases.status != 'running'
			 RETURNING *`
		)
			.bind(s.user.site, s.assign, s.course, s.user.id, s.user.fullname, Math.round(releaseAt), t)
			.first<ReleaseRow>();
		if (!rel) throw new HttpError(409, "the release is being written right now");
		return json({ release: releaseOut(rel) });
	}),

	// Cancelling writes nothing to Moodle; the drafts stay until written or discarded.
	route("DELETE", "/api/grading/:course/assign/:assign/release", async ctx => {
		const s = await assignScope(ctx);
		const t = Date.now();
		const res = await ctx.env.DB.prepare("UPDATE grading_releases SET status = 'cancelled', updated_at = ? WHERE site = ? AND assign_id = ? AND status IN ('scheduled', 'failed')")
			.bind(t, s.user.site, s.assign)
			.run();
		if (!res.meta.changes) throw new HttpError(409, "no scheduled release to cancel");
		return json({ release: releaseOut(await releaseRow(ctx.env, s.user.site, s.assign)) });
	}),

	route("POST", "/api/grading/:course/assign/:assign/release/now", async ctx => {
		const s = await assignScope(ctx);
		const n = (await ctx.env.DB.prepare("SELECT COUNT(*) AS n FROM grading_drafts WHERE site = ? AND assign_id = ?").bind(s.user.site, s.assign).first<{ n: number }>())?.n ?? 0;
		const res = await releaseNow(ctx.env, s.user, s.user.site, s.assign, s.course);
		if (!res.ok) throw new HttpError(res.error === "running" ? 409 : 502, res.error === "running" ? "the release is being written right now" : res.error);
		return json({ written: n, release: releaseOut(await releaseRow(ctx.env, s.user.site, s.assign)) });
	}),

	// One student's held grade. With expectedUpdatedAt, refuses (409) when someone else saved it since.
	route("PUT", "/api/grading/:course/assign/:assign/drafts/:student", async ctx => {
		const s = await assignScope(ctx);
		const body = await readJson<{ grade?: number | null; feedback?: string | null; expectedUpdatedAt?: number | null }>(ctx.req);
		const d = draftInput({ ...body, student: ctx.params.student }, s.access.assignments[s.assign]);
		await requireScheduled(ctx.env, s.user.site, s.assign);
		const db = ctx.env.DB;
		if (body.expectedUpdatedAt !== undefined) {
			const cur = await db.prepare("SELECT * FROM grading_drafts WHERE site = ? AND assign_id = ? AND student_id = ?").bind(s.user.site, s.assign, d.student).first<DraftRow>();
			if (cur && cur.updated_at !== body.expectedUpdatedAt && cur.grader_id !== s.user.moodle_userid) return json({ error: "changed by someone else", draft: draftOut(cur) }, 409);
		}
		const t = Date.now();
		await upsertDraft(ctx.env, s, d, t).run();
		return json({ draft: { student: d.student, grade: d.grade, feedback: d.feedback, grader: s.user.moodle_userid, graderName: s.user.fullname, updatedAt: t } });
	}),

	// Many drafts at once (CSV import while a release is scheduled).
	route("PUT", "/api/grading/:course/assign/:assign/drafts", async ctx => {
		const s = await assignScope(ctx);
		const { drafts } = await readJson<{ drafts?: unknown[] }>(ctx.req);
		if (!Array.isArray(drafts) || drafts.length > MAX_ROWS) throw new HttpError(400, "drafts must be a list");
		const rows = drafts.map(d => draftInput(d, s.access.assignments[s.assign]));
		await requireScheduled(ctx.env, s.user.site, s.assign);
		const t = Date.now();
		if (rows.length) await ctx.env.DB.batch(rows.map(d => upsertDraft(ctx.env, s, d, t)));
		return json({ ok: true, count: rows.length });
	}),

	route("DELETE", "/api/grading/:course/assign/:assign/drafts/:student", async ctx => {
		const s = await assignScope(ctx);
		const student = positiveInt(ctx.params.student, "student");
		await ctx.env.DB.prepare("DELETE FROM grading_drafts WHERE site = ? AND assign_id = ? AND student_id = ?").bind(s.user.site, s.assign, student).run();
		return json({ ok: true });
	}),

	route("DELETE", "/api/grading/:course/assign/:assign/drafts", async ctx => {
		const s = await assignScope(ctx);
		const res = await ctx.env.DB.prepare("DELETE FROM grading_drafts WHERE site = ? AND assign_id = ?").bind(s.user.site, s.assign).run();
		return json({ ok: true, count: res.meta.changes });
	})
];
