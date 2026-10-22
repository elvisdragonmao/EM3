import { useSession } from "@/features/auth/session";
import { useCourseIndex } from "@/features/courses/api";
import { type TimetableEntry, usePrefs } from "@/features/preferences/store";
import { call } from "@/lib/moodle/client";
import { DEFAULT_MOODLE_URL } from "@/lib/moodle/site";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { schoolPeriods } from "./periods";

const EMPTY: Record<string, TimetableEntry> = {};

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
function useMoodleSchedules(): Record<string, TimetableEntry> {
	const school = schoolPeriods();
	const { currentCourses } = useCourseIndex();
	const ids = currentCourses.map(c => c.id).join(",");
	// A stable select, so the entries keep their identity between renders.
	const select = useCallback((data: CourseFields) => entriesFromFields(data, school!.parse), [school]);
	const { data } = useQuery({
		queryKey: ["schedules", ids],
		queryFn: () => call<CourseFields>("core_course_get_courses_by_field", { field: "ids", value: ids }),
		enabled: !!school?.fromMoodle && ids !== "",
		staleTime: 6 * 60 * 60_000,
		select
	});
	return data ?? EMPTY;
}

/** The signed-in school's timetable: what the student set, over what Moodle says. Empty for schools without a period table. */
export function useTimetable(): Record<string, TimetableEntry> {
	const manual = useManualTimetable();
	const moodle = useMoodleSchedules();
	const supported = schoolPeriods() !== null;
	return useMemo(() => (supported ? { ...moodle, ...manual } : EMPTY), [supported, moodle, manual]);
}

/** Entries the student set by hand on this school, to tell them apart from Moodle's. */
export function useManualTimetable(): Record<string, TimetableEntry> {
	const site = useSession(s => s.baseUrl);
	return usePrefs(s => (site === DEFAULT_MOODLE_URL ? s.timetable : (s.siteTimetables[site] ?? EMPTY)));
}
