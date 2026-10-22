// Pure helpers for answering a quiz inside EM3, kept free of the DOM and of
// path aliases so the Node tests can import them. The question HTML Moodle
// sends is a form; answering means sending its fields back the way a browser
// would submit them, as the official Moodle app does.

/** The parts of a form control this module reads (HTMLInputElement and friends fit). */
export interface FieldLike {
	name: string;
	type?: string;
	tagName: string;
	value: string;
	checked?: boolean;
	disabled?: boolean;
}

// A type alias (not an interface) so it fits the WS params' index signature.
export type Field = { name: string; value: string };

const SKIPPED_TYPES = new Set(["submit", "button", "reset", "image", "file"]);

/**
 * Collects name/value pairs like a browser form submission: unchecked radios and
 * checkboxes, disabled controls and buttons are left out. Moodle often sends a
 * hidden `0` before a checkbox of the same name; PHP keeps the last value, so
 * a later control with the same name wins here too.
 */
export function collectFields(elements: Iterable<FieldLike>, valueOf: (el: FieldLike) => string = el => el.value): Field[] {
	const out = new Map<string, string>();
	for (const el of elements) {
		if (!el.name || el.disabled) continue;
		const type = (el.type ?? "").toLowerCase();
		if (el.tagName.toUpperCase() === "BUTTON" || SKIPPED_TYPES.has(type)) continue;
		if ((type === "radio" || type === "checkbox") && !el.checked) continue;
		out.set(el.name, valueOf(el));
	}
	return [...out].map(([name, value]) => ({ name, value }));
}

/** Sets each question's `:flagged` field from EM3's own flag toggle. */
export function withFlags(fields: Field[], flags: Record<string, boolean>): Field[] {
	const out = fields.filter(f => !(f.name in flags));
	for (const [name, on] of Object.entries(flags)) out.push({ name, value: on ? "1" : "0" });
	return out;
}

/**
 * The `data` param of mod_quiz_save_attempt / mod_quiz_process_attempt. `slots`
 * mirrors Moodle's own attempt form, so only the questions on this page are processed.
 */
export const wsData = (fields: Field[], slots: number[]) => [...fields.filter(f => f.name !== "slots"), { name: "slots", value: slots.join(",") }];

/** Stable key for "did anything change since the last save". */
export const fieldsKey = (fields: Field[]) => JSON.stringify([...fields].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)));

// ---------------------------------------------------------------------------
// Essays: EM3 offers a plain textarea. When the response is stored as HTML
// (format 1), it is shown as text and turned back into paragraphs on save.

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function textToHtml(text: string): string {
	const paras = text
		.replace(/\r\n?/g, "\n")
		.split(/\n{2,}/)
		.map(p => p.trim())
		.filter(Boolean);
	return paras.map(p => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
}

/** An untouched answer keeps its original HTML, so formatting written on E3 is not flattened. */
export const essayValue = (text: string, original: { text: string; html: string }) => (text === original.text ? original.html : textToHtml(text));

// ---------------------------------------------------------------------------
// Whether EM3 can run this quiz, or must send the student to E3.

/** Question types whose Moodle markup is a plain form EM3 can show and submit (ddwtos is turned into selects). */
export const SUPPORTED_QTYPES = new Set([
	"multichoice",
	"truefalse",
	"shortanswer",
	"numerical",
	"essay",
	"match",
	"randomsamatch",
	"gapselect",
	"ddwtos",
	"multianswer",
	"calculated",
	"calculatedsimple",
	"calculatedmulti",
	"description",
	"random"
]);

/** Access rules EM3 satisfies: time checks Moodle enforces itself, the password (sent as preflight data) and attempt limits. */
export const HANDLED_RULES = new Set([
	"quizaccess_openclosedate",
	"quizaccess_timelimit",
	"quizaccess_password",
	"quizaccess_numattempts",
	"quizaccess_delaybetweenattempts",
	"quizaccess_ipaddress",
	"quizaccess_securewindow",
	"quizaccess_offlineattempts"
]);

const SEB_RULES = new Set(["quizaccess_seb", "quizaccess_safebrowser"]);

export interface QuizAccess {
	canattempt: boolean;
	accessrules: string[];
	activerulenames: string[];
	preventaccessreasons: string[];
}

export interface AttemptAccess {
	endtime?: number;
	isfinished: boolean;
	ispreflightcheckrequired?: boolean;
	preventnewattemptreasons: string[];
}

export type Blocker = { kind: "seb" } | { kind: "rules"; rules: string[] } | { kind: "qtypes"; types: string[] } | { kind: "prevented"; reasons: string[] } | { kind: "noNew"; reasons: string[] };

/** Reasons the attempt cannot be taken in EM3. Empty means EM3 can run it. */
export function attemptBlockers(access: QuizAccess, qtypes: string[], attemptAccess: AttemptAccess | null, hasUnfinished: boolean): Blocker[] {
	const out: Blocker[] = [];
	if (access.activerulenames.some(r => SEB_RULES.has(r))) out.push({ kind: "seb" });
	const rules = access.activerulenames.filter(r => !HANDLED_RULES.has(r) && !SEB_RULES.has(r));
	if (rules.length) out.push({ kind: "rules", rules: rules.map(r => r.replace(/^quizaccess_/, "")) });
	const types = qtypes.filter(q => !SUPPORTED_QTYPES.has(q));
	if (types.length) out.push({ kind: "qtypes", types });
	if (access.preventaccessreasons.length) out.push({ kind: "prevented", reasons: access.preventaccessreasons });
	else if (!access.canattempt) out.push({ kind: "prevented", reasons: [] });
	if (!hasUnfinished && attemptAccess?.preventnewattemptreasons.length) out.push({ kind: "noNew", reasons: attemptAccess.preventnewattemptreasons });
	return out;
}

/** Blockers that E3 would hit as well, so sending the student there does not help. */
export const blocksEverywhere = (b: Blocker) => b.kind === "prevented" || b.kind === "noNew";

export const needsPassword = (access: Pick<QuizAccess, "activerulenames">) => access.activerulenames.includes("quizaccess_password");

// ---------------------------------------------------------------------------
// Pages, navigation and the timer.

export interface NavQuestion {
	slot: number;
	type: string;
	page: number;
	number?: number;
	questionnumber?: string;
	stateclass?: string;
	status?: string;
	flagged?: boolean;
	blockedbyprevious?: boolean;
	hasautosavedstep?: boolean;
}

/** Pages in an attempt layout such as "1,2,0,3,0" (0 ends a page). */
export const pageCount = (layout: string | undefined, questions: Pick<NavQuestion, "page">[] = []) => {
	const fromLayout = (layout ?? "").split(",").filter(s => s.trim() === "0").length;
	return Math.max(fromLayout, ...questions.map(q => q.page + 1), 1);
};

/** Questions that count as unanswered on the summary. Description items have nothing to answer. */
export const unanswered = (questions: NavQuestion[]) =>
	questions.filter(q => q.type !== "description" && !q.hasautosavedstep && (q.stateclass === "notyetanswered" || q.stateclass === "invalidanswer"));

export const isAnswered = (q: NavQuestion) => q.type !== "description" && !unanswered([q]).length;

/** The warning step the countdown is in: 5 minutes, 1 minute, or none. */
export const warningLevel = (secondsLeft: number): 5 | 1 | null => (secondsLeft <= 60 ? 1 : secondsLeft <= 300 ? 5 : null);

/** 1:02:03 or 12:03. */
export function formatClock(seconds: number) {
	const s = Math.max(0, Math.floor(seconds));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const pad = (n: number) => String(n).padStart(2, "0");
	return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}
