import type { Slot } from "@/features/timetable/periods";
import { getMoodleBaseUrl } from "@/lib/moodle/client";
import { DEFAULT_MOODLE_URL } from "@/lib/moodle/site";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// Everything here is personal, client-only configuration. It lives in
// localStorage and never goes back to E3, so customising is always safe.

export interface CourseLook {
	color?: string;
	icon?: string;
	nickname?: string;
	hidden?: boolean;
	pinned?: boolean;
}

export interface TimetableEntry {
	slots: Slot[];
	room?: string;
}

export type MotionPref = "full" | "reduced";
export type CalendarSpan = "week" | "twoWeeks" | "month";

export interface Prefs {
	/** How EM3 greets the user; empty = E3 first name. */
	nickname: string;
	theme: string;
	motion: MotionPref;
	/** Range of the dashboard calendar. */
	calendarSpan: CalendarSpan;
	/** Range of the calendar page. */
	calendarPageSpan: CalendarSpan;
	showWeekend: boolean;
	/** Reusable feedback phrases for grading (Markdown). */
	snippets: string[];
	/** Course ids → appearance. */
	courses: Record<string, CourseLook>;
	/** NYCU course ids → weekly slots (the original, single-school store). */
	timetable: Record<string, TimetableEntry>;
	/** Other schools: Moodle URL → course ids → weekly slots. Course ids and period codes only mean something on their own site. */
	siteTimetables: Record<string, Record<string, TimetableEntry>>;
	/** Announcement discussion ids the user has opened in EM3 (local only). */
	seen: Record<string, number>;
}

interface PrefsActions {
	set: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
	setCourse: (id: number, patch: Partial<CourseLook>) => void;
	setTimetable: (id: number, entry: TimetableEntry | null) => void;
	markSeen: (ids: number[]) => void;
	replaceAll: (prefs: Partial<Prefs>) => void;
	reset: () => void;
}

export const DEFAULT_PREFS: Prefs = {
	nickname: "",
	theme: "system",
	motion: "full",
	calendarSpan: "week",
	calendarPageSpan: "month",
	showWeekend: false,
	courses: {},
	timetable: {},
	siteTimetables: {},
	seen: {},
	snippets: ["做得很好！", "請補上執行結果的截圖。", "格式請依照作業說明。", "遲交，依規定扣分。"]
};

export const PREFS_STORAGE_KEY = "em3:prefs";
export const PREFS_VERSION = 1;

export const usePrefs = create<Prefs & PrefsActions>()(
	persist(
		set => ({
			...DEFAULT_PREFS,
			set: (key, value) => set({ [key]: value } as Partial<Prefs>),
			setCourse: (id, patch) => set(s => ({ courses: { ...s.courses, [id]: { ...s.courses[id], ...patch } } })),
			setTimetable: (id, entry) =>
				set(s => {
					const site = getMoodleBaseUrl();
					const next = { ...(site === DEFAULT_MOODLE_URL ? s.timetable : s.siteTimetables[site]) };
					if (entry && entry.slots.length) next[id] = entry;
					else delete next[id];
					return site === DEFAULT_MOODLE_URL ? { timetable: next } : { siteTimetables: { ...s.siteTimetables, [site]: next } };
				}),
			markSeen: ids =>
				set(s => {
					const now = Date.now();
					const seen = { ...s.seen };
					for (const id of ids) seen[id] ??= now;
					return { seen };
				}),
			replaceAll: prefs => set({ ...DEFAULT_PREFS, ...prefs }),
			reset: () => set(DEFAULT_PREFS)
		}),
		{ name: PREFS_STORAGE_KEY, version: PREFS_VERSION }
	)
);

export function exportPrefs(): string {
	const { set: _s, setCourse: _c, setTimetable: _t, markSeen: _m, replaceAll: _r, reset: _x, ...data } = usePrefs.getState();
	return JSON.stringify({ app: "em3", version: PREFS_VERSION, exportedAt: new Date().toISOString(), prefs: data }, null, "\t");
}

export function importPrefs(json: string) {
	const parsed = JSON.parse(json) as { app?: string; prefs?: Partial<Prefs> };
	if (parsed.app !== "em3" || typeof parsed.prefs !== "object") throw new Error("這不是 EM3 的設定檔");
	const known = Object.fromEntries(Object.entries(parsed.prefs).filter(([k]) => k in DEFAULT_PREFS)) as Partial<Prefs>;
	usePrefs.getState().replaceAll(known);
}
