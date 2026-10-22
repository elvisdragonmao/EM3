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
		queryFn: async ({ signal }) => {
			const parts: SyllabusTimes[] = [];
			for (let i = 0; i < list.length; i += NYCU_MAX_KEYS) parts.push(await api<SyllabusTimes>(`nycu/schedules?courses=${encodeURIComponent(list.slice(i, i + NYCU_MAX_KEYS).join(","))}`, { signal }));
			return Object.assign({}, ...parts) as SyllabusTimes;
		},
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
