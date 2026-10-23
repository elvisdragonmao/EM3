import { useCourseIndex } from "@/features/courses/api";
import type { ParsedCourse } from "@/features/courses/parse";
import { usePrefs } from "@/features/preferences/store";
import { quizState, useQuizAttempts, useQuizzes } from "@/features/quizzes/api";
import type { Assignment, SubmissionStatus } from "@/lib/moodle/types";
import { useMemo } from "react";
import { type ListState, taskState, useAssignments, useSubmissionStatuses, withSkip } from "./api";

// A "task" is anything with a deadline the student must act on: assignments
// (with live submission state) and quizzes (by close time and own attempts).

export interface Task {
	key: string;
	kind: "assign" | "quiz";
	course: ParsedCourse;
	name: string;
	/** Unix seconds; 0 = no deadline. */
	due: number;
	opens: number;
	cutoff: number;
	state: ListState;
	assignment?: Assignment;
	status?: SubmissionStatus;
	cmid: number;
	/** Classroom exercise: short submission window, usually on-site. */
	inClass: boolean;
}

const IN_CLASS = /課堂|隨堂|in[- ]?class|on[- ]?site|lab|練習|exercise|quiz/i;

function isInClass(name: string, opens: number, due: number) {
	const window = opens && due ? due - opens : Infinity;
	return window <= 4 * 3600 || (IN_CLASS.test(name) && window <= 26 * 3600);
}

/** Current-semester courses minus the ones hidden in EM3. */
export function useActiveCourses() {
	const { currentCourses, ...rest } = useCourseIndex();
	const looks = usePrefs(s => s.courses);
	const active = useMemo(() => currentCourses.filter(c => !looks[c.id]?.hidden), [currentCourses, looks]);
	return { ...rest, currentCourses, active };
}

export function useTasks(courses?: ParsedCourse[]) {
	const { active, byId } = useActiveCourses();
	const scope = courses ?? active;
	const ids = scope.map(c => c.id);
	const assignments = useAssignments(ids);
	const quizzes = useQuizzes(ids);
	const statuses = useSubmissionStatuses((assignments.data ?? []).map(a => a.id));
	const attempts = useQuizAttempts((quizzes.data ?? []).filter(q => q.visible !== false).map(q => q.id));
	const skip = usePrefs(s => s.skipSubmit);

	const tasks = useMemo(() => {
		const now = Date.now() / 1000;
		const out: Task[] = [];
		for (const a of assignments.data ?? []) {
			const course = byId.get(a.course);
			if (!course || a.nosubmissions) continue;
			const status = statuses.data?.[a.id];
			out.push({
				key: `a${a.id}`,
				kind: "assign",
				course,
				name: a.name,
				due: a.duedate,
				opens: a.allowsubmissionsfromdate,
				cutoff: a.cutoffdate,
				state: withSkip(taskState(a, status, now), !!skip[a.cmid]),
				assignment: a,
				status,
				cmid: a.cmid,
				inClass: isInClass(a.name, a.allowsubmissionsfromdate, a.duedate)
			});
		}
		for (const q of quizzes.data ?? []) {
			const course = byId.get(q.course);
			if (!course || q.visible === false) continue;
			const state = quizState(q, attempts.data?.[q.id] ?? [], now);
			out.push({
				key: `q${q.id}`,
				kind: "quiz",
				course,
				name: q.name,
				due: q.timeclose,
				opens: q.timeopen,
				cutoff: q.timeclose,
				state,
				cmid: q.coursemodule,
				inClass: isInClass(q.name, q.timeopen, q.timeclose)
			});
		}
		return out.sort((x, y) => (x.due || Infinity) - (y.due || Infinity));
	}, [assignments.data, quizzes.data, statuses.data, attempts.data, byId, skip]);

	return {
		tasks,
		isPending: assignments.isPending || quizzes.isPending,
		statusesPending: (statuses.isPending && !!assignments.data?.length) || (attempts.isPending && !!quizzes.data?.length),
		error: assignments.error ?? quizzes.error,
		refetch: () => Promise.all([assignments.refetch(), quizzes.refetch(), statuses.refetch(), attempts.refetch()])
	};
}

export const isOpenTask = (t: Task) => t.state === "todo" || t.state === "late";
