// Which calendar action events deserve a reminder now, and which ones were already sent.
// Pure functions, so the cron's decisions are unit-tested without Moodle or D1.

import { courseName, formatDue, messages } from "./messages";

/** The part of core_calendar_get_action_events_by_timesort's events EM3 reads. */
export interface ActionEvent {
	id: number;
	name: string;
	activityname?: string;
	modulename?: string;
	instance?: number;
	eventtype: string;
	timesort: number;
	url?: string;
	course?: { id: number; fullname: string };
	action?: { name: string; url: string; itemcount: number; actionable: boolean; showitemcount: boolean } | null;
}

export interface Reminder {
	kind: "deadline" | "grading";
	event: ActionEvent;
	/** The lead time this reminder goes out for; keys for larger leads are marked sent with it. */
	lead: number;
	keys: string[];
}

export interface NotifyPrefs {
	leadHours: number[];
	deadlines: boolean;
	grading: boolean;
}

/** Assignments (by cmid) the user marked in EM3 as not needing a submission or grading. */
export interface Skips {
	submit: Set<number>;
	grading: Set<number>;
}

export const NO_SKIPS: Skips = { submit: new Set(), grading: new Set() };

/** Reads the marks from the synced settings (`skipSubmit` / `skipGrading`: cmid → time marked). */
export function readSkips(prefs: unknown): Skips {
	const ids = (key: string) => {
		const v = typeof prefs === "object" && prefs !== null ? (prefs as Record<string, unknown>)[key] : null;
		return new Set(typeof v === "object" && v !== null && !Array.isArray(v) ? Object.keys(v).map(Number).filter(Number.isInteger) : []);
	};
	return { submit: ids("skipSubmit"), grading: ids("skipGrading") };
}

/** The due time is part of the key, so an extended deadline gets its reminders again. */
export const sentKey = (eventId: number, due: number, lead: number) => `${eventId}:${due}:${lead}`;

/** Students get "due"/"close"/… events with a submit-type action; graders get "gradingdue" with the number to grade. */
export function classify(e: ActionEvent): Reminder["kind"] | null {
	if (!e.action?.actionable) return null;
	if (e.eventtype === "gradingdue") return e.action.itemcount > 0 ? "grading" : null;
	return "deadline";
}

/**
 * For each event, the leads that already apply are those at least as long as the time left.
 * Only the smallest unsent one is sent; the larger ones are marked sent with it, so someone
 * who just enabled reminders gets one message per event, not one per lead.
 */
export function planReminders(events: ActionEvent[], prefs: NotifyPrefs, nowSec: number, sent: Set<string>, skips: Skips = NO_SKIPS): { send: Reminder[]; silent: string[] } {
	const send: Reminder[] = [];
	const silent: string[] = [];
	for (const event of events) {
		const kind = classify(event);
		if (!kind || (kind === "deadline" && !prefs.deadlines) || (kind === "grading" && !prefs.grading)) continue;
		const cmid = cmidOf(event);
		if (cmid !== null && (kind === "deadline" ? skips.submit : skips.grading).has(cmid)) continue;
		const left = event.timesort - nowSec;
		if (left <= 0) continue;
		const applies = prefs.leadHours.filter(h => left <= h * 3600).sort((a, b) => a - b);
		if (!applies.length) continue;
		const unsent = applies.filter(h => !sent.has(sentKey(event.id, event.timesort, h)));
		if (!unsent.length) continue;
		const keys = unsent.map(h => sentKey(event.id, event.timesort, h));
		// The closest lead was already sent (a larger one was added later): nothing new to say.
		if (unsent[0] !== applies[0]) silent.push(...keys);
		else send.push({ kind, event, lead: applies[0], keys });
	}
	send.sort((a, b) => a.event.timesort - b.event.timesort);
	return { send, silent };
}

/** The course module id, from the event's activity URL (…/view.php?id=<cmid>). */
export function cmidOf(e: ActionEvent): number | null {
	for (const u of [e.url, e.action?.url]) {
		const id = u ? /[?&]id=(\d+)/.exec(u)?.[1] : undefined;
		if (id) return Number(id);
	}
	return null;
}

/** The EM3 page for an event (hash routes, see src/app/router.tsx). */
export function em3Url(origin: string, e: ActionEvent, kind: Reminder["kind"]): string {
	const course = e.course?.id;
	const cmid = cmidOf(e);
	if (!course) return `${origin}/#/tasks`;
	if (cmid && e.modulename === "assign") return `${origin}/#/courses/${course}/assign/${cmid}${kind === "grading" ? "/grade" : ""}`;
	if (cmid && e.modulename === "quiz") return `${origin}/#/courses/${course}/quiz/${cmid}`;
	return `${origin}/#/courses/${course}`;
}

export interface ReminderText {
	title: string;
	body: string;
	course: string;
	at: string;
	url: string;
	tag: string;
	count: number | null;
}

export function reminderText(r: Reminder, locale: string, nowSec: number, origin: string): ReminderText {
	const m = messages(locale);
	const e = r.event;
	const activity = e.activityname || e.name;
	const course = e.course ? courseName(e.course.fullname, locale) : "";
	const at = formatDue(e.timesort, locale);
	const left = m.left((e.timesort - nowSec) / 60);
	const count = r.kind === "grading" ? (e.action?.itemcount ?? 0) : null;
	return {
		title: r.kind === "grading" ? m.gradingTitle(activity) : activity,
		body: r.kind === "grading" ? m.gradingBody(course, count!, left, at) : m.dueBody(course, left, at),
		course,
		at,
		url: em3Url(origin, e, r.kind),
		tag: `em3-${r.kind}-${e.id}`,
		count
	};
}
