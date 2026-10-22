import { NYCU_KEY, NYCU_MAX_KEYS } from "../src/features/timetable/syllabus";
import { requireUser } from "./auth";
import type { Env } from "./env";
import { HttpError, json, route } from "./http";

// NYCU syllabus class times: GET /api/nycu/schedules (docs/server.md). The syllabus is
// public, so rows are shared by everyone and keyed by course, not by user.

const OUTLINE = "https://timetable.nycu.edu.tw/?r=main/getCrsOutlineBase";
const TTL = 24 * 3600_000;
/** Courses without a time yet (new or 「另訂」) are asked again sooner. */
const EMPTY_TTL = 6 * 3600_000;
const CONCURRENCY = 4;
const TIMEOUT = 8000;

/** `cos_time` of the syllabus API's answer; unknown courses come back as `false`. */
export function readCosTime(data: unknown): string {
	return typeof data === "object" && data !== null && typeof (data as { cos_time?: unknown }).cos_time === "string" ? (data as { cos_time: string }).cos_time.trim() : "";
}

/** Throws on network errors and timeouts, so a hiccup isn't cached as "no time". */
async function fetchCosTime(key: string): Promise<string> {
	const [acy, sem, cos_id] = key.split("-");
	const res = await fetch(OUTLINE, { method: "POST", body: new URLSearchParams({ acy, sem, cos_id }), signal: AbortSignal.timeout(TIMEOUT) });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return readCosTime(JSON.parse(await res.text()));
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
	const out: PromiseSettledResult<R>[] = new Array(items.length);
	let next = 0;
	const worker = async () => {
		while (next < items.length) {
			const i = next++;
			try {
				out[i] = { status: "fulfilled", value: await fn(items[i]) };
			} catch (reason) {
				out[i] = { status: "rejected", reason };
			}
		}
	};
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return out;
}

interface Row {
	course_key: string;
	cos_time: string;
	fetched_at: number;
}

/**
 * Class time codes for these keys, from the cache when fresh, otherwise from the syllabus.
 * A course whose fetch failed falls back to a stale row, or is left out so the client asks again later.
 */
export async function schedules(env: Env, keys: string[], now = Date.now(), waitUntil: (p: Promise<unknown>) => void = () => {}): Promise<Record<string, string | null>> {
	const out: Record<string, string | null> = {};
	if (!keys.length) return out;
	const { results } = await env.DB.prepare(`SELECT course_key, cos_time, fetched_at FROM nycu_schedules WHERE course_key IN (${keys.map(() => "?").join(",")})`)
		.bind(...keys)
		.all<Row>();
	const cached = new Map(results.map(r => [r.course_key, r]));
	const missing: string[] = [];
	for (const key of keys) {
		const row = cached.get(key);
		if (row && now - row.fetched_at < (row.cos_time ? TTL : EMPTY_TTL)) out[key] = row.cos_time || null;
		else missing.push(key);
	}
	const fetched = await mapLimit(missing, CONCURRENCY, fetchCosTime);
	const writes: D1PreparedStatement[] = [];
	missing.forEach((key, i) => {
		const r = fetched[i];
		if (r.status === "fulfilled") {
			out[key] = r.value || null;
			writes.push(
				env.DB.prepare(
					"INSERT INTO nycu_schedules (course_key, cos_time, fetched_at) VALUES (?, ?, ?) ON CONFLICT (course_key) DO UPDATE SET cos_time = excluded.cos_time, fetched_at = excluded.fetched_at"
				).bind(key, r.value, now)
			);
		} else {
			const stale = cached.get(key);
			if (stale) out[key] = stale.cos_time || null;
			console.warn("nycu syllabus", key, r.reason);
		}
	});
	if (writes.length) waitUntil(env.DB.batch(writes));
	return out;
}

/** The `courses` query parameter, deduplicated and validated. */
export function parseKeys(param: string | null): string[] {
	const keys = [...new Set((param ?? "").split(",").filter(Boolean))];
	if (keys.length > NYCU_MAX_KEYS) throw new HttpError(400, `at most ${NYCU_MAX_KEYS} courses`);
	if (keys.some(k => !NYCU_KEY.test(k))) throw new HttpError(400, "invalid course key");
	return keys;
}

export const routes = [
	route("GET", "/api/nycu/schedules", async ctx => {
		await requireUser(ctx);
		const keys = parseKeys(ctx.url.searchParams.get("courses"));
		return json(await schedules(ctx.env, keys, Date.now(), ctx.waitUntil));
	})
];
