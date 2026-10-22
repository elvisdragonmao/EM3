// NYCU's syllabus keeps each course's class times (「R34-EC114[GF]」). Browsers can't
// read its API (it sends Access-Control-Allow-Origin twice), so the server version
// asks the EM3 server, which fetches and caches it (worker/nycu.ts). Relative
// imports only: the Worker and the Node tests use this file too.

/** "115-1-515516": academic year, term (1, 2 or X for summer), course code. */
export const NYCU_KEY = /^\d{3}-[12X]-\w+$/;

/** At most this many courses per request. */
export const NYCU_MAX_KEYS = 40;

// Structural copies of the timetable types, so the Worker doesn't type-check the app's store.
interface Entry {
	slots: { day: number; period: string }[];
	room?: string;
}

interface KeyedCourse {
	id: number;
	semester: { year: number; term: 1 | 2 | 3 } | null;
	code: string | null;
}

export const nycuTerm = (term: 1 | 2 | 3) => (term === 3 ? "X" : String(term));

export const nycuKey = (c: KeyedCourse): string | null => (c.semester && c.code ? `${c.semester.year}-${nycuTerm(c.semester.term)}-${c.code}` : null);

/** Course key → course id, for the courses that have a syllabus. */
export function nycuKeys(courses: KeyedCourse[]): Map<string, number> {
	const keys = new Map<string, number>();
	for (const c of courses) {
		const key = nycuKey(c);
		if (key && NYCU_KEY.test(key)) keys.set(key, c.id);
	}
	return keys;
}

/** Turns the server's `{ key: "R34-EC114[GF]" | null }` into timetable entries by course id. */
export function entriesFromSyllabus(keys: Map<string, number>, times: Record<string, string | null>, parse: (input: string) => Entry): Record<string, Entry> {
	const entries: Record<string, Entry> = {};
	for (const [key, id] of keys) {
		const code = times[key];
		if (!code) continue;
		const { slots, room } = parse(code);
		if (slots.length) entries[id] = room ? { slots, room } : { slots };
	}
	return entries;
}
