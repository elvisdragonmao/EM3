import { getLanguage, langTag, LOCALES } from "@/i18n";
import { safeName } from "@/lib/download";
import { fileUrl } from "@/lib/moodle/files";
import type { SubmissionStatus } from "@/lib/moodle/types";
import { unzipSync, zipSync, type Zippable } from "fflate";
import { displayName, onlineText, type Participant, submittedFiles } from "./api";
import { SHEET, t } from "./grading-messages";

// Offline grading round trip:
//   1. download every submission as a zip, one folder per student: 「王小明_12345/」
//   2. grade offline, edit the CSV, drop annotated files back into the folders
//   3. upload the CSV and/or the zip; EM3 matches rows and folders by the internal id.
// Student IDs are not exposed to teachers through the API, so the internal
// Moodle user id is the key; email is accepted as a fallback in the CSV.

const safe = (s: string) => safeName(s) || "student";
/** 「110550000_王小明_12345」: 學號 first so folders sort by student ID; the trailing Moodle id is the matching key. */
export const folderName = (p: Pick<Participant, "id" | "fullname">, sid?: string) => [sid, safe(displayName(p.fullname)), p.id].filter(Boolean).join("_");

const csvCell = (v: string | number | null | undefined) => {
	const s = v === null || v === undefined ? "" : String(v);
	return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Words for the files EM3 writes, in the current spoken language. */
export const sheetText = () => SHEET[getLanguage()];
const SHEETS = LOCALES.flatMap(l => (l === "emoji" ? [] : [SHEET[l]]));

export const csvHeader = () => {
	const c = sheetText().cols;
	return [c.sid, c.name, c.email, c.userid, c.status, c.time, c.grade, c.comment];
};

export function gradesCsv(rows: { p: Participant; sid?: string; status?: SubmissionStatus; grade: string; comment: string }[]) {
	const sheet = sheetText();
	const lines = [csvHeader().join(",")];
	for (const { p, sid, status, grade, comment } of rows) {
		const sub = status?.lastattempt?.submission;
		const time = sub?.timemodified ? new Date(sub.timemodified * 1000).toLocaleString(langTag(), { hour12: false }) : "";
		lines.push([sid ?? "", displayName(p.fullname), p.email ?? "", p.id, p.submitted ? sheet.submitted : sheet.missing, time, grade, comment].map(csvCell).join(","));
	}
	// BOM so Excel opens UTF-8 Chinese correctly.
	return new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
}

export async function buildSubmissionZip(
	participants: Participant[],
	sids: Record<number, string>,
	statuses: Record<number, SubmissionStatus>,
	csv: Blob,
	onProgress?: (done: number, total: number) => void
): Promise<Blob> {
	const tree: Zippable = {};
	const jobs: { path: string; url: string }[] = [];
	for (const p of participants) {
		const st = statuses[p.id];
		const dir = folderName(p, sids[p.id]);
		const files = submittedFiles(st);
		const text = onlineText(st);
		if (!files.length && !text) continue;
		tree[dir] = {};
		if (text) (tree[dir] as Zippable)[sheetText().onlineTextFile] = new TextEncoder().encode(`<!doctype html><meta charset="utf-8"><title>${dir}</title>${text}`);
		for (const f of files) jobs.push({ path: `${dir}/${safe(f.filename)}`, url: f.fileurl });
	}
	let done = 0;
	await Promise.all(
		jobs.map(async j => {
			const buf = new Uint8Array(await (await fetch(fileUrl(j.url, { download: true }))).arrayBuffer());
			const [dir, name] = j.path.split("/");
			(tree[dir] as Zippable)[name] = [buf, { level: 0 }];
			onProgress?.(++done, jobs.length);
		})
	);
	tree[`${sheetText().gradesFile}.csv`] = new Uint8Array(await csv.arrayBuffer());
	return new Blob([zipSync(tree, { level: 6 }) as BlobPart], { type: "application/zip" });
}

/** Decodes CSV bytes as UTF-8, falling back to Big5 (what Excel on zh-TW Windows saves). */
export async function readCsv(file: File): Promise<string> {
	const bytes = new Uint8Array(await file.arrayBuffer());
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
	} catch {
		return new TextDecoder("big5").decode(bytes);
	}
}

export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = "";
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (quoted) {
			if (ch === '"' && text[i + 1] === '"') ((cell += '"'), i++);
			else if (ch === '"') quoted = false;
			else cell += ch;
		} else if (ch === '"') quoted = true;
		else if (ch === ",") (row.push(cell), (cell = ""));
		else if (ch === "\n" || ch === "\r") {
			if (ch === "\r" && text[i + 1] === "\n") i++;
			row.push(cell);
			rows.push(row);
			row = [];
			cell = "";
		} else cell += ch;
	}
	if (cell || row.length) (row.push(cell), rows.push(row));
	return rows.filter(r => r.some(c => c.trim()));
}

export interface CsvGrade {
	line: number;
	sid?: string;
	userid?: number;
	email?: string;
	grade: number | null;
	comment?: string;
	error?: string;
}

/** Reads the columns EM3 exported (userid / email / 分數 / 評語); header names are matched loosely. */
export function gradesFromCsv(text: string, max: number): CsvGrade[] {
	const [header, ...rows] = parseCsv(text);
	if (!header) return [];
	const find = (...names: string[]) => header.findIndex(h => names.some(n => h.trim().toLowerCase() === n.toLowerCase()));
	// Column names from every language EM3 exports in, plus common spellings from other sheets.
	const cols = (key: keyof (typeof SHEET)["en"]["cols"]) => SHEETS.map(s => s.cols[key]);
	const iSid = find(...cols("sid"), "帳號", "username", "student id");
	const iId = find(...cols("userid"), "id", "使用者 id");
	const iEmail = find(...cols("email"), "電子郵件", "電子郵件地址", "email address");
	const iGrade = find(...cols("grade"), "grade", "成績", "得点");
	const iComment = find(...cols("comment"), "feedback", "回饋", "comment", "フィードバック");
	if (iGrade < 0) return [{ line: 1, grade: null, error: t("noGradeColumn", sheetText().cols.grade) }];
	// A plain 「id」 column is the Moodle user id only if no 學號 column exists.
	return rows.map((r, i) => {
		const raw = r[iGrade]?.trim() ?? "";
		const n = raw === "" ? null : Number(raw);
		const out: CsvGrade = {
			line: i + 2,
			sid: iSid >= 0 ? r[iSid]?.trim() || undefined : undefined,
			userid: iId >= 0 && r[iId] ? Number(r[iId]) : undefined,
			email: iEmail >= 0 ? r[iEmail]?.trim().toLowerCase() : undefined,
			grade: n,
			comment: iComment >= 0 ? r[iComment] : undefined
		};
		if (n !== null && (Number.isNaN(n) || n < 0 || n > max)) out.error = t("gradeOutOfRange", raw, max);
		if (!out.sid && !out.userid && !out.email) out.error = t("noStudentKey");
		return out;
	});
}

/**
 * Matches annotated feedback files back to students. Accepts a zip (folders
 * named 「…_<userid>/」 as exported) or loose files whose names contain 「_<userid>」.
 */
export async function matchFeedbackFiles(inputs: File[], ids: Set<number>): Promise<{ matched: Map<number, File[]>; unmatched: string[] }> {
	const matched = new Map<number, File[]>();
	const unmatched: string[] = [];
	const add = (path: string, file: File) => {
		const parts = path.split("/").filter(Boolean);
		const hit = parts
			.map(seg => /_(\d+)(?:\.[^.]+)?$/.exec(seg)?.[1])
			.map(Number)
			.find(n => ids.has(n));
		if (hit) matched.set(hit, [...(matched.get(hit) ?? []), file]);
		else unmatched.push(path);
	};
	for (const f of inputs) {
		if (/\.zip$/i.test(f.name)) {
			const entries = unzipSync(new Uint8Array(await f.arrayBuffer()));
			for (const [path, data] of Object.entries(entries)) {
				if (path.endsWith("/") || /(^|\/)(__MACOSX|\.DS_Store)/.test(path) || /\.csv$/i.test(path) || SHEETS.some(s => path.split("/").pop() === s.onlineTextFile)) continue;
				add(path, new File([data as BlobPart], path.split("/").pop()!));
			}
		} else add(f.webkitRelativePath || f.name, f);
	}
	return { matched, unmatched };
}
