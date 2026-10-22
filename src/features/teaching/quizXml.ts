import { markdownToHtml } from "@/shared/editor/markdown";
import { t } from "./messages";

// Questions authored in EM3 export to Moodle XML, which E3's question bank
// imports (題庫維護 → 匯入). XML over GIFT because GIFT's escaping rules clash
// with LaTeX braces, and XML carries tolerances, per-option scores and categories.

export type QType = "single" | "multi" | "truefalse" | "short" | "numerical" | "essay";

export const QTYPES: readonly QType[] = ["single", "multi", "truefalse", "short", "numerical", "essay"];

/** UI label for a question type, in the current language. */
export const qtypeLabel = (type: QType) => t(`qt_${type}`);

export interface Choice {
	text: string;
	correct: boolean;
}

export interface Question {
	id: string;
	type: QType;
	/** Shown in E3 as the question name (E3 labels it 「概念/能力指標」). */
	name: string;
	text: string;
	points: number;
	choices: Choice[];
	/** truefalse: the correct value. */
	truth?: boolean;
	/** short: accepted answers; numerical: answer + tolerance. */
	answers: string[];
	tolerance?: number;
	feedback?: string;
}

export const newQuestion = (type: QType = "single"): Question => ({
	id: crypto.randomUUID(),
	type,
	name: "",
	text: "",
	points: 1,
	choices:
		type === "single" || type === "multi"
			? [
					{ text: "", correct: true },
					{ text: "", correct: false },
					{ text: "", correct: false },
					{ text: "", correct: false }
				]
			: [],
	truth: true,
	answers: type === "short" || type === "numerical" ? [""] : [],
	tolerance: 0
});

/** Moodle only accepts fractions from a fixed list; these are 100/n for n = 1…10. */
const SPLIT = ["100", "50", "33.33333", "25", "20", "16.66667", "14.28571", "12.5", "11.11111", "10"];

const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
const html = (md: string) => cdata(markdownToHtml(md));
const esc = (s: string) => s.replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);

export function problems(q: Question, index: number): string[] {
	const out: string[] = [];
	const n = t("questionN", index + 1);
	if (!q.text.trim()) out.push(t("pNoText", n));
	if ((q.type === "single" || q.type === "multi") && q.choices.filter(c => c.text.trim()).length < 2) out.push(t("pTwoChoices", n));
	if ((q.type === "single" || q.type === "multi") && !q.choices.some(c => c.correct && c.text.trim())) out.push(t("pNoCorrect", n));
	if (q.type === "multi" && q.choices.filter(c => c.correct).length > 10) out.push(t("pTooMany", n));
	if ((q.type === "short" || q.type === "numerical") && !q.answers.some(a => a.trim())) out.push(t("pNoAnswer", n));
	if (q.type === "numerical" && q.answers.some(a => a.trim() && Number.isNaN(Number(a)))) out.push(t("pNotNumber", n));
	return out;
}

function questionXml(q: Question, i: number): string {
	const plain = q.text
		.replace(/[#*_`>$\[\]()!-]/g, "")
		.replace(/\s+/g, " ")
		.trim();
	const name = esc(q.name.trim() || (plain ? `${i + 1}. ${plain.slice(0, 30)}` : `Q${i + 1}`));
	const head = `  <question type="%TYPE%">
    <name><text>${name}</text></name>
    <questiontext format="html"><text>${html(q.text)}</text></questiontext>
    <generalfeedback format="html"><text>${q.feedback ? html(q.feedback) : ""}</text></generalfeedback>
    <defaultgrade>${q.points}</defaultgrade>
    <penalty>0</penalty>
    <hidden>0</hidden>`;
	switch (q.type) {
		case "single":
		case "multi": {
			const choices = q.choices.filter(c => c.text.trim());
			const right = choices.filter(c => c.correct).length;
			const answers = choices
				.map(
					c =>
						`    <answer fraction="${c.correct ? (q.type === "single" ? "100" : SPLIT[right - 1]) : "0"}" format="html"><text>${html(c.text)}</text><feedback format="html"><text></text></feedback></answer>`
				)
				.join("\n");
			return `${head.replace("%TYPE%", "multichoice")}
    <single>${q.type === "single" ? "true" : "false"}</single>
    <shuffleanswers>true</shuffleanswers>
    <answernumbering>ABCD</answernumbering>
${answers}
  </question>`;
		}
		case "truefalse":
			return `${head.replace("%TYPE%", "truefalse")}
    <answer fraction="${q.truth ? 100 : 0}" format="moodle_auto_format"><text>true</text><feedback format="html"><text></text></feedback></answer>
    <answer fraction="${q.truth ? 0 : 100}" format="moodle_auto_format"><text>false</text><feedback format="html"><text></text></feedback></answer>
  </question>`;
		case "short":
			return `${head.replace("%TYPE%", "shortanswer")}
    <usecase>0</usecase>
${q.answers
	.filter(a => a.trim())
	.map(a => `    <answer fraction="100" format="moodle_auto_format"><text>${esc(a.trim())}</text><feedback format="html"><text></text></feedback></answer>`)
	.join("\n")}
  </question>`;
		case "numerical":
			return `${head.replace("%TYPE%", "numerical")}
${q.answers
	.filter(a => a.trim())
	.map(a => `    <answer fraction="100" format="moodle_auto_format"><text>${esc(a.trim())}</text><feedback format="html"><text></text></feedback><tolerance>${q.tolerance ?? 0}</tolerance></answer>`)
	.join("\n")}
    <unitgradingtype>0</unitgradingtype>
    <showunits>3</showunits>
  </question>`;
		case "essay":
			return `${head.replace("%TYPE%", "essay")}
    <responseformat>editor</responseformat>
    <responserequired>1</responserequired>
    <responsefieldlines>12</responsefieldlines>
    <attachments>0</attachments>
    <attachmentsrequired>0</attachmentsrequired>
    <graderinfo format="html"><text></text></graderinfo>
    <responsetemplate format="html"><text></text></responsetemplate>
  </question>`;
	}
}

export function toMoodleXml(questions: Question[], category: string): string {
	const cat = category.trim() ? `  <question type="category"><category><text>$course$/top/${esc(category.trim())}</text></category></question>\n` : "";
	return `<?xml version="1.0" encoding="UTF-8"?>\n<quiz>\n${cat}${questions.map(questionXml).join("\n")}\n</quiz>\n`;
}

/**
 * Pasted from a spreadsheet, one question per row:
 * 題目 ⇥ 選項A ⇥ 選項B ⇥ … ⇥ 答案   (答案 = A / B / AC / 數字 / 文字)
 */
export function fromSpreadsheet(tsv: string): Question[] {
	const rows = tsv
		.split(/\r?\n/)
		.map(r => r.split("\t").map(c => c.trim()))
		.filter(r => r.some(Boolean));
	return rows.flatMap(cells => {
		const [text, ...rest] = cells;
		if (!text) return [];
		const rawAnswer = rest.pop() ?? "";
		const answer = rawAnswer.toUpperCase();
		const options = rest.filter(Boolean);
		if (options.length >= 2 && /^[A-J]+$/.test(answer)) {
			const q = newQuestion(answer.length > 1 ? "multi" : "single");
			q.text = text;
			q.choices = options.map((o, i) => ({ text: o, correct: answer.includes(String.fromCharCode(65 + i)) }));
			return [q];
		}
		// Answer spellings teachers type in their sheets, not UI text.
		if (["O", "X", "T", "F", "TRUE", "FALSE", "是", "否", "對", "錯"].includes(answer) && !options.length) {
			const q = newQuestion("truefalse");
			q.text = text;
			q.truth = ["O", "T", "TRUE", "是", "對"].includes(answer);
			return [q];
		}
		const q = newQuestion(answer && !Number.isNaN(Number(answer)) ? "numerical" : answer ? "short" : "essay");
		q.text = text;
		q.answers = rawAnswer ? [rawAnswer] : [];
		return [q];
	});
}
