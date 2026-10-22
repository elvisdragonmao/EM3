// Splitting a class between graders ("學號 1 到 40 號給 A"). Pure, so the tests can import it.

export interface AllocStudent {
	id: number;
	/** 學號; may be empty when Moodle has none. */
	sid: string;
	name: string;
}

export interface SidRange {
	grader: number;
	/** Inclusive; empty means open-ended. */
	from: string;
	to: string;
}

/** Numeric-aware, so "9" < "10" and "0812345" < "112550001". */
export const compareSid = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });

/** By 學號, students without one last (by name). */
export const byStudentNumber = (a: AllocStudent, b: AllocStudent) => (!a.sid !== !b.sid ? (a.sid ? -1 : 1) : compareSid(a.sid, b.sid) || a.name.localeCompare(b.name, "zh-Hant"));

/** Consecutive blocks in 學號 order, in the graders' order; block sizes differ by at most one. */
export function splitEvenly(students: AllocStudent[], graders: number[]): Record<number, number> {
	const out: Record<number, number> = {};
	if (!graders.length) return out;
	const sorted = [...students].sort(byStudentNumber);
	const base = Math.floor(sorted.length / graders.length);
	const extra = sorted.length % graders.length;
	let i = 0;
	graders.forEach((g, k) => {
		const n = base + (k < extra ? 1 : 0);
		for (const s of sorted.slice(i, i + n)) out[s.id] = g;
		i += n;
	});
	return out;
}

export const inRange = (sid: string, r: Pick<SidRange, "from" | "to">) => !!sid && (!r.from.trim() || compareSid(sid, r.from.trim()) >= 0) && (!r.to.trim() || compareSid(sid, r.to.trim()) <= 0);

/** First matching range wins; students in no range stay unassigned. */
export function splitByRanges(students: AllocStudent[], ranges: SidRange[]) {
	const map: Record<number, number> = {};
	const unassigned: AllocStudent[] = [];
	for (const s of [...students].sort(byStudentNumber)) {
		const r = ranges.find(r => (r.from.trim() || r.to.trim()) && inRange(s.sid, r));
		if (r) map[s.id] = r.grader;
		else unassigned.push(s);
	}
	return { map, unassigned };
}

export interface GraderShare {
	grader: number;
	count: number;
	first?: string;
	last?: string;
}

/** Per grader: how many students and the 學號 span, for the preview. */
export function summarize(map: Record<number, number>, students: AllocStudent[], graders: number[]): { shares: GraderShare[]; unassigned: number } {
	const sorted = [...students].sort(byStudentNumber);
	const shares = graders.map(g => {
		const mine = sorted.filter(s => map[s.id] === g);
		const sids = mine.map(s => s.sid).filter(Boolean);
		return { grader: g, count: mine.length, first: sids[0], last: sids[sids.length - 1] };
	});
	return { shares, unassigned: sorted.filter(s => map[s.id] === undefined).length };
}
