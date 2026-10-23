import { useSession } from "@/features/auth/session";
import { useCourseIndex } from "@/features/courses/api";
import { type TimetableEntry, usePrefs } from "@/features/preferences/store";
import { useServerReady } from "@/features/server/store";
import { call } from "@/lib/moodle/client";
import { DEFAULT_MOODLE_URL } from "@/lib/moodle/site";
import { api } from "@/lib/server/api";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { schoolPeriods } from "./periods";
import { useTimesSource } from "./source";
import { entriesFromSyllabus, NYCU_MAX_KEYS, nycuKeys } from "./syllabus";

const EMPTY: Record<string, TimetableEntry> = {};
const STALE = 6 * 60 * 60_000;

interface CourseFields {
	courses: { id: number; customfields?: { shortname: string; value?: string }[] }[];
}

const text = (html?: string) =>
	html
		?.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim() || undefined;

/** Turns courses' `schedule` / `room` custom fields (e.g. CCU's 「週二 E,F」) into timetable entries. */
export function entriesFromFields(data: CourseFields, parse: (input: string) => { slots: TimetableEntry["slots"] }): Record<string, TimetableEntry> {
	const entries: Record<string, TimetableEntry> = {};
	for (const c of data.courses) {
		const field = (name: string) => text(c.customfields?.find(f => f.shortname === name)?.value);
		const slots = parse(field("schedule") ?? "").slots;
		if (slots.length) entries[c.id] = { slots, room: field("room") };
	}
	return entries;
}

/** Class times the school already keeps on Moodle, for this semester's courses. */
function useMoodleSchedules(enabled: boolean): Record<string, TimetableEntry> {
	const school = schoolPeriods();
	const { currentCourses } = useCourseIndex();
	const ids = currentCourses.map(c => c.id).join(",");
	// A stable select, so the entries keep their identity between renders.
	const select = useCallback((data: CourseFields) => entriesFromFields(data, school!.parse), [school]);
	const { data } = useQuery({
		queryKey: ["schedules", ids],
		queryFn: () => call<CourseFields>("core_course_get_courses_by_field", { field: "ids", value: ids }),
		enabled: enabled && ids !== "",
		staleTime: STALE,
		select
	});
	return data ?? EMPTY;
}

type SyllabusTimes = Record<string, string | null>;

/** Asks the EM3 server for syllabus time codes, at most NYCU_MAX_KEYS courses per request. */
async function fetchSyllabusTimes(keys: string[], signal?: AbortSignal): Promise<SyllabusTimes> {
	const parts: SyllabusTimes[] = [];
	for (let i = 0; i < keys.length; i += NYCU_MAX_KEYS) parts.push(await api<SyllabusTimes>(`nycu/schedules?courses=${encodeURIComponent(keys.slice(i, i + NYCU_MAX_KEYS).join(","))}`, { signal }));
	return Object.assign({}, ...parts) as SyllabusTimes;
}

/** Class times from NYCU's syllabus, read through the EM3 server (server version only). */
function useSyllabusSchedules(enabled: boolean): Record<string, TimetableEntry> {
	const school = schoolPeriods();
	const ready = useServerReady();
	const { currentCourses } = useCourseIndex();
	const keys = useMemo(() => nycuKeys(currentCourses), [currentCourses]);
	const list = [...keys.keys()].sort();
	const select = useCallback((data: SyllabusTimes) => entriesFromSyllabus(keys, data, school!.parse), [keys, school]);
	const { data } = useQuery({
		queryKey: ["nycu-schedules", list.join(",")],
		queryFn: ({ signal }) => fetchSyllabusTimes(list, signal),
		enabled: enabled && ready && list.length > 0,
		// The server leaves out courses it couldn't reach the syllabus for; ask again soon for those.
		staleTime: q => (q.state.data && list.every(k => k in q.state.data!) ? STALE : 5 * 60_000),
		select
	});
	return data ?? EMPTY;
}

/** The signed-in school's timetable: what the student set, over what Moodle or the syllabus says. Empty for schools without a period table. */
export function useTimetable(): Record<string, TimetableEntry> {
	const manual = useManualTimetable();
	const source = useTimesSource();
	const moodle = useMoodleSchedules(source === "moodle");
	const syllabus = useSyllabusSchedules(source === "syllabus");
	const auto = source === "moodle" ? moodle : source === "syllabus" ? syllabus : EMPTY;
	const supported = schoolPeriods() !== null;
	// A student's entry with no slots hides the time filled in for them.
	return useMemo(() => (supported ? { ...auto, ...manual } : EMPTY), [supported, auto, manual]);
}

/** Entries the student set by hand on this school, to tell them apart from the ones filled in for them. */
export function useManualTimetable(): Record<string, TimetableEntry> {
	const site = useSession(s => s.baseUrl);
	return usePrefs(s => (site === DEFAULT_MOODLE_URL ? s.timetable : (s.siteTimetables[site] ?? EMPTY)));
}

export type FillResult = { kind: "nothingBlank" } | { kind: "filled"; filled: number; missing: number };

/**
 * The timetable's 「從課綱抓取」 button: looks up this semester's courses that have no time yet
 * and saves what the syllabus says as the student's own entries. Both versions have it; it is
 * the only time the local version calls the EM3 server, and only with course codes (the route
 * needs no session).
 */
export function useFillFromSyllabus() {
	const { currentCourses } = useCourseIndex();
	const timetable = useTimetable();
	const setTimetable = usePrefs(s => s.setTimetable);
	return async (): Promise<FillResult> => {
		const school = schoolPeriods();
		const blank = new Map([...nycuKeys(currentCourses)].filter(([, id]) => !timetable[id]?.slots.length));
		if (!school || !blank.size) return { kind: "nothingBlank" };
		const entries = entriesFromSyllabus(blank, await fetchSyllabusTimes([...blank.keys()]), school.parse);
		for (const [id, entry] of Object.entries(entries)) setTimetable(Number(id), entry);
		const filled = Object.keys(entries).length;
		return { kind: "filled", filled, missing: blank.size - filled };
	};
}
