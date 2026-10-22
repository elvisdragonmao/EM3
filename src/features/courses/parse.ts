import type { EnrolledCourse } from "@/lib/moodle/types";

// E3 encodes the semester in course names: `1151.515505.演算法概論 Introduction to Algorithms`
// → 115 學年度第 1 學期, course code 515505. Summer terms use `X` (114X).

export interface Semester {
	code: string;
	/** e.g. 115 */
	year: number;
	/** 1 = 上, 2 = 下, 3 = 暑 */
	term: 1 | 2 | 3;
	label: string;
	shortLabel: string;
}

export interface ParsedCourse {
	id: number;
	raw: EnrolledCourse;
	semester: Semester | null;
	code: string | null;
	name: string;
	nameEn: string | null;
	kind: CourseKind;
}

export type CourseKind = "semester" | "micro" | "online" | "other";

const TERM_LABEL = { 1: "上學期", 2: "下學期", 3: "暑期" } as const;
const TERM_SHORT = { 1: "上", 2: "下", 3: "暑" } as const;

export function parseSemester(code: string): Semester | null {
	const m = /^(\d{3})([12X])$/i.exec(code);
	if (!m) return null;
	const year = Number(m[1]);
	const term = m[2].toUpperCase() === "X" ? 3 : (Number(m[2]) as 1 | 2);
	return { code: m[0].toUpperCase(), year, term, label: `${year} 學年度${TERM_LABEL[term]}`, shortLabel: `${year} ${TERM_SHORT[term]}` };
}

/** Sort key so newer semesters come first: 1151 > 114X > 1142 > 1141. */
export const semesterRank = (s: Semester) => s.year * 10 + (s.term === 3 ? 2.5 : s.term);

/** Splits 「微積分甲(一) Calculus A (I)」 into the Chinese and English halves. */
export function splitBilingual(title: string): { zh: string; en: string | null } {
	const m = /^(.*[㐀-鿿＀-￯][)）\]】」]*)\s+([A-Za-z].*)$/s.exec(title.trim());
	if (!m) return { zh: title.trim(), en: null };
	return { zh: m[1].trim(), en: m[2].trim() };
}

export function parseCourse(c: EnrolledCourse): ParsedCourse {
	const full = c.fullname.trim();
	const m = /^(\d{3}[12X])\.([0-9A-Z]+)\.(.*)$/i.exec(full);
	if (m) {
		const { zh, en } = splitBilingual(m[3]);
		return { id: c.id, raw: c, semester: parseSemester(m[1]), code: m[2], name: zh, nameEn: en, kind: "semester" };
	}
	// CCU keeps the semester in the shortname: `115_1_4105402_01` → 115 學年度第 1 學期, course 4105402.
	const ccu = /^(\d{3})_([12])_([0-9A-Z]+)_\d+$/i.exec(c.shortname ?? "");
	if (ccu) {
		const { zh, en } = splitBilingual(full);
		return { id: c.id, raw: c, semester: parseSemester(ccu[1] + ccu[2]), code: ccu[3], name: zh, nameEn: en, kind: "semester" };
	}
	let title = full;
	let kind: CourseKind = "other";
	if (/微學分/.test(full)) {
		kind = "micro";
		title = full.replace(/^ICT微學分課程[_＿\s]*/, "");
	} else if (/線上|online|培訓|新生/i.test(full)) {
		kind = "online";
	}
	const { zh, en } = splitBilingual(title);
	return { id: c.id, raw: c, semester: null, code: null, name: zh, nameEn: en, kind };
}

export const KIND_LABEL: Record<CourseKind, string> = {
	semester: "學期課程",
	micro: "微學分",
	online: "線上課程",
	other: "其他"
};

/** The semester the calendar says we are in, used when no preference is set. */
export function latestSemester(courses: ParsedCourse[]): Semester | null {
	let best: Semester | null = null;
	for (const c of courses) if (c.semester && (!best || semesterRank(c.semester) > semesterRank(best))) best = c.semester;
	return best;
}

export function listSemesters(courses: ParsedCourse[]): Semester[] {
	const map = new Map<string, Semester>();
	for (const c of courses) if (c.semester) map.set(c.semester.code, c.semester);
	return [...map.values()].sort((a, b) => semesterRank(b) - semesterRank(a));
}
