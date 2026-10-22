import { getMoodleBaseUrl } from "../../lib/moodle/client";
import { DEFAULT_MOODLE_URL } from "../../lib/moodle/site";

// Each school numbers its class periods differently, so the period table, the
// way students write a schedule, and the grid rows all come from the signed-in
// school. Schools EM3 has no table for get no timetable rather than NYCU's times.

export interface Period {
	code: string;
	start: string;
	end: string;
}

export interface Slot {
	day: number;
	period: string;
}

export interface SchoolPeriods {
	periods: Period[];
	/** Grid rows in time order; periods outside them are drawn on the rows they overlap. */
	rows: string[];
	/** Rows always shown; the rest only when a class uses them. */
	core: string[];
	parse: (input: string) => { slots: Slot[]; room?: string };
	format: (slots: Slot[]) => string;
	/** Placeholder for the schedule input. */
	example: string;
	/** Courses carry a `schedule` (and `room`) custom field EM3 can fill the timetable from. */
	fromMoodle?: boolean;
	/** Blocks of the day the school's own timetable is drawn in (CCU's Ⅰ-Ⅴ); the view shows whole blocks. */
	sections?: { label: string; rows: string[] }[];
}

/** 0 = Monday … 6 = Sunday. */
export const DAY_CODES = ["M", "T", "W", "R", "F", "S", "U"] as const;
export const DAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

const minutes = (hm: string) => {
	const [h, m] = hm.split(":").map(Number);
	return h * 60 + m;
};
const hm = (total: number) => `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;

// NYCU: 「M56R7」-style codes from the course catalogue (days M T W R F S U, periods y z 1-4 n 5-9 a-d).
const NYCU_PERIODS: Period[] = [
	{ code: "y", start: "06:00", end: "06:50" },
	{ code: "z", start: "07:00", end: "07:50" },
	{ code: "1", start: "08:00", end: "08:50" },
	{ code: "2", start: "09:00", end: "09:50" },
	{ code: "3", start: "10:10", end: "11:00" },
	{ code: "4", start: "11:10", end: "12:00" },
	{ code: "n", start: "12:20", end: "13:10" },
	{ code: "5", start: "13:20", end: "14:10" },
	{ code: "6", start: "14:20", end: "15:10" },
	{ code: "7", start: "15:30", end: "16:20" },
	{ code: "8", start: "16:30", end: "17:20" },
	{ code: "9", start: "17:30", end: "18:20" },
	{ code: "a", start: "18:30", end: "19:20" },
	{ code: "b", start: "19:30", end: "20:20" },
	{ code: "c", start: "20:30", end: "21:20" },
	{ code: "d", start: "21:30", end: "22:20" }
];

/** Parses codes like `T34`, `M56R7`, `W56-EC022`, `T34-EC115,R2-EC115` into slots plus the room after a dash. */
function parseNycu(input: string): { slots: Slot[]; room?: string } {
	const slots: Slot[] = [];
	let room: string | undefined;
	for (const chunk of input
		.toUpperCase()
		.split(/[,，\s]+/)
		.filter(Boolean)) {
		const dash = chunk.indexOf("-");
		const times = dash < 0 ? chunk : chunk.slice(0, dash);
		const place = dash < 0 ? "" : chunk.slice(dash + 1);
		if (place && !room) room = place;
		let day = -1;
		for (const ch of times) {
			const d = DAY_CODES.indexOf(ch as (typeof DAY_CODES)[number]);
			if (d >= 0) {
				day = d;
				continue;
			}
			const code = ch.toLowerCase();
			if (day >= 0 && NYCU_PERIODS.some(p => p.code === code)) slots.push({ day, period: code });
		}
	}
	return { slots, room };
}

// CCU runs two overlapping axes: hourly periods 1-15 (07:10-08:00 …) and 75-minute
// periods A-J (07:15-08:30, then every 90 minutes). Courses use one or the other.
const CCU_PERIODS: Period[] = [
	...Array.from({ length: 15 }, (_, i) => ({ code: String(i + 1), start: hm(430 + 60 * i), end: hm(480 + 60 * i) })),
	..."ABCDEFGHIJ".split("").map((code, i) => ({ code, start: hm(435 + 90 * i), end: hm(510 + 90 * i) }))
];

/** Parses CCU's 「週二 E,F」 (also 「二EF」, 「星期一 8,9」); several days in one string are fine. */
function parseCcu(input: string): { slots: Slot[] } {
	const slots: Slot[] = [];
	for (const [, dayLabel, codes] of input.toUpperCase().matchAll(/(?:週|星期)?([一二三四五六日])\s*([0-9A-J,，、\s]*)/g)) {
		const day = DAY_LABELS.indexOf(dayLabel);
		for (const token of codes.split(/[,，、\s]+/).filter(Boolean)) {
			// Letters are single periods, so 「EF」 is E and F; digits need commas (「12」 is period 12).
			const parts = CCU_PERIODS.some(p => p.code === token) ? [token] : /^[A-J]+$/.test(token) ? token.split("") : [];
			for (const period of parts) slots.push({ day, period });
		}
	}
	return { slots };
}

function formatCcu(slots: Slot[]): string {
	return groupByDay(slots, CCU_PERIODS)
		.map(([d, codes]) => `週${DAY_LABELS[d]} ${codes.join(",")}`)
		.join(" ");
}

const SCHOOLS: Record<string, SchoolPeriods> = {
	[DEFAULT_MOODLE_URL]: {
		periods: NYCU_PERIODS,
		rows: NYCU_PERIODS.map(p => p.code),
		core: NYCU_PERIODS.map(p => p.code).filter(c => !["y", "z", "c", "d"].includes(c)),
		parse: parseNycu,
		format: slots =>
			groupByDay(slots, NYCU_PERIODS)
				.map(([d, codes]) => DAY_CODES[d] + codes.join(""))
				.join(""),
		example: "例：T34"
	},
	"https://ecourse2.ccu.edu.tw": {
		periods: CCU_PERIODS,
		rows: CCU_PERIODS.filter(p => /^\d+$/.test(p.code)).map(p => p.code),
		core: ["2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
		parse: parseCcu,
		format: formatCcu,
		example: "例：週二 E,F",
		fromMoodle: true,
		// Each block is three hourly periods and two lettered ones: Ⅰ = 1-3 and A-B, … Ⅴ = 13-15 and I-J.
		sections: ["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ"].map((label, i) => ({ label, rows: [1, 2, 3].map(n => String(i * 3 + n)) }))
	}
};

/** The signed-in school's periods, or null when EM3 has no table for it. */
export const schoolPeriods = (): SchoolPeriods | null => SCHOOLS[getMoodleBaseUrl()] ?? null;

export const periodByCode = (code: string) => schoolPeriods()?.periods.find(p => p.code === code);
export const periodStartMinutes = (code: string) => minutes(periodByCode(code)!.start);
export const periodEndMinutes = (code: string) => minutes(periodByCode(code)!.end);

export const parseScheduleCode = (input: string): { slots: Slot[]; room?: string } => schoolPeriods()?.parse(input) ?? { slots: [] };
export const formatSlots = (slots: Slot[]): string => schoolPeriods()?.format(slots) ?? "";

/** Day → that day's period codes in time order. */
function groupByDay(slots: Slot[], periods: Period[]): [number, string[]][] {
	const start = (code: string) => minutes(periods.find(p => p.code === code)?.start ?? "99:99");
	const byDay = new Map<number, string[]>();
	for (const s of slots) byDay.set(s.day, [...(byDay.get(s.day) ?? []), s.period]);
	return [...byDay.entries()].sort(([a], [b]) => a - b).map(([d, codes]) => [d, codes.sort((a, b) => start(a) - start(b))]);
}

/** Whether a period overlaps a grid row; with one axis that is just "same period". */
export const overlaps = (period: string, row: string) => periodStartMinutes(period) < periodEndMinutes(row) && periodStartMinutes(row) < periodEndMinutes(period);

/** Merge back-to-back periods into blocks: [{day, from:"3", to:"4"}]. Codes the school does not have are dropped. */
export function slotBlocks(slots: Slot[]) {
	const sorted = slots.filter(s => periodByCode(s.period)).sort((a, b) => a.day - b.day || periodStartMinutes(a.period) - periodStartMinutes(b.period));
	const blocks: { day: number; from: string; to: string }[] = [];
	for (const s of sorted) {
		const last = blocks.at(-1);
		// Breaks between back-to-back periods are at most 20 minutes (NYCU's 2→3, 4→n; CCU's 10 and 15).
		if (last && last.day === s.day && periodStartMinutes(s.period) - periodEndMinutes(last.to) <= 20) {
			if (periodEndMinutes(s.period) > periodEndMinutes(last.to)) last.to = s.period;
		} else blocks.push({ day: s.day, from: s.period, to: s.period });
	}
	return blocks;
}

/** Monday-based day index for a JS Date. */
export const dayIndex = (d: Date) => (d.getDay() + 6) % 7;
