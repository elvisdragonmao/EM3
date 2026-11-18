import type { Assignment, AssignmentsResponse, EnrolledCourse } from "../../src/lib/moodle/types";
import { callAs, type User } from "../auth";
import type { Env } from "../env";

export interface Activity {
	cmid: number;
	kind: "assign" | "quiz";
	course: { id: number; fullname: string };
	name: string;
	opens: number;
	due: number;
}

interface MoodleQuiz {
	coursemodule: number;
	course: number;
	name: string;
	timeopen?: number;
	timeclose?: number;
	visible?: boolean | number;
}

export async function fetchActivities(env: Env, user: User, at: number): Promise<Activity[]> {
	const enrolled = await callAs<EnrolledCourse[]>(env, user, "core_enrol_get_users_courses", { userid: user.moodle_userid, returnusercount: 0 });
	const courses = new Map(enrolled.filter(c => c.visible && c.startdate <= at && (!c.enddate || c.enddate > at)).map(c => [c.id, { id: c.id, fullname: c.fullname }]));
	if (!courses.size) return [];
	const params = { courseids: [...courses.keys()] };
	const [assign, quiz] = await Promise.all([
		callAs<AssignmentsResponse>(env, user, "mod_assign_get_assignments", params),
		callAs<{ quizzes: MoodleQuiz[] }>(env, user, "mod_quiz_get_quizzes_by_courses", params)
	]);
	const result: Activity[] = [];
	for (const group of assign.courses) {
		const course = courses.get(group.id);
		if (!course) continue;
		for (const a of group.assignments as (Assignment & { visible?: boolean | number })[]) {
			if (a.nosubmissions || a.visible === false || a.visible === 0) continue;
			result.push({ cmid: a.cmid, course, kind: "assign", name: a.name, opens: a.allowsubmissionsfromdate, due: a.duedate });
		}
	}
	for (const q of quiz.quizzes) {
		const course = courses.get(q.course);
		// Moodle can return a quiz's basic metadata even if its settings are unavailable to the user.
		if (!course || q.visible === false || q.visible === 0 || q.timeopen === undefined || q.timeclose === undefined) continue;
		result.push({ cmid: q.coursemodule, course, kind: "quiz", name: q.name, opens: q.timeopen, due: q.timeclose });
	}
	return result;
}

export function planActivities(activities: Activity[], previous: number[] | null, at: number) {
	const seen = new Set(previous ?? []);
	const send: Activity[] = [];
	for (const a of activities) {
		if (a.opens > at || seen.has(a.cmid)) continue;
		// Learn already open activities when enabled, and never notify about an expired one.
		if (previous === null || (a.due > 0 && a.due <= at)) seen.add(a.cmid);
		else send.push(a);
	}
	send.sort((a, b) => (a.due || Infinity) - (b.due || Infinity));
	return { seen, send };
}

export function activityUrl(origin: string, a: Activity) {
	return `${origin}/#/courses/${a.course.id}/${a.kind}/${a.cmid}`;
}
