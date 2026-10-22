import { getLanguage } from "@/i18n";
import type { Quiz, ReviewQuestionRaw } from "./api";

// E3 returns each reviewed question as the HTML of its own quiz page: a form
// with disabled inputs, Moodle-only markup and inline scripts. EM3 parses it
// (DOMParser never runs scripts) into plain parts it can lay out and quote in
// a prompt. Question types it does not know keep their sanitised HTML.

export interface ReviewOption {
	/** 「a.」 numbering as E3 shows it. */
	label: string;
	html: string;
	text: string;
	chosen: boolean;
	/** Only known for options E3 marks (usually the chosen ones). */
	verdict: "correct" | "incorrect" | "partial" | null;
}

export interface ReviewQuestion {
	slot: number;
	number: number | null;
	type: string;
	/** 答對 / 答錯 / 部分正確 / 需要評分… as E3 words it. */
	status: string;
	verdict: "correct" | "incorrect" | "partial" | "pending" | "unknown";
	mark: number | null;
	maxmark: number | null;
	textHtml: string;
	text: string;
	/** Choice questions (multichoice, truefalse). */
	options: ReviewOption[];
	/** Everything else: the formulation with the student's answers inline. */
	formulationHtml?: string;
	formulationText?: string;
	rightAnswer?: string;
	specificFeedback?: string;
	generalFeedback?: string;
}

const textOf = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

/** Text of a fragment, with images and the student's typed or picked answers spelled out (in the prompt's language). */
function readable(el: Element, lang: PromptLang): string {
	const s = STRINGS[lang];
	const c = el.cloneNode(true) as Element;
	c.querySelectorAll(".accesshide, .sr-only, script, style").forEach(n => n.remove());
	c.querySelectorAll("img").forEach(img => img.replaceWith(s.image(img.getAttribute("alt") ?? "")));
	c.querySelectorAll("input[type=text], input:not([type]), textarea").forEach(i => i.replaceWith(s.quote((i as HTMLInputElement).value || i.getAttribute("value") || i.textContent || s.noAnswer)));
	c.querySelectorAll("select").forEach(sel => {
		const picked = sel.querySelector("option[selected]");
		sel.replaceWith(s.quote(picked && picked.getAttribute("value") !== "0" && picked.getAttribute("value") !== "" ? textOf(picked) : s.noAnswer));
	});
	c.querySelectorAll("p, div, br, li, tr").forEach(n => n.append("\n"));
	return (c.textContent ?? "")
		.split("\n")
		.map(l => l.replace(/\s+/g, " ").trim())
		.filter(Boolean)
		.join("\n");
}

const verdictOf = (cls: string): ReviewOption["verdict"] => (/\bpartiallycorrect\b/.test(cls) ? "partial" : /\bincorrect\b/.test(cls) ? "incorrect" : /\bcorrect\b/.test(cls) ? "correct" : null);

/** `lang` only words the plain-text parts that go into the prompt (images, blanks). */
export function parseQuestion(q: ReviewQuestionRaw, lang: PromptLang): ReviewQuestion {
	const doc = new DOMParser().parseFromString(q.html, "text/html");
	const root = doc.querySelector(".que") ?? doc.body;
	root.querySelectorAll("script, .questionflag, input[type=hidden]").forEach(n => n.remove());

	const qtext = root.querySelector(".qtext");
	const options: ReviewOption[] = [];
	const answer = root.querySelector(".answer");
	const isChoice = !!answer && !!answer.querySelector("input[type=radio], input[type=checkbox]") && !answer.querySelector("select, input[type=text]");
	if (isChoice) {
		for (const row of answer!.children) {
			const input = row.querySelector("input[type=radio], input[type=checkbox]");
			if (!input) continue;
			const labelEl = row.querySelector("[data-region=answer-label]") ?? row.querySelector("label") ?? row;
			const body = labelEl.cloneNode(true) as Element;
			const num = body.querySelector(".answernumber");
			const label = textOf(num);
			num?.remove();
			options.push({ label, html: body.innerHTML.trim(), text: readable(body, lang), chosen: input.hasAttribute("checked"), verdict: verdictOf(row.className) });
		}
	}

	const formulation = root.querySelector(".formulation");
	let formulationHtml: string | undefined;
	let formulationText: string | undefined;
	if (!isChoice && formulation) {
		const f = formulation.cloneNode(true) as Element;
		f.querySelector(".qtext")?.remove();
		f.querySelectorAll("h4.accesshide, .accesshide, .sr-only").forEach(n => n.remove());
		formulationText = readable(f, lang) || undefined;
		formulationHtml = f.innerHTML.trim() || undefined;
	}

	const cls = q.stateclass ?? root.className;
	const verdict: ReviewQuestion["verdict"] = /partiallycorrect|partial/.test(cls)
		? "partial"
		: /incorrect|wrong/.test(cls)
			? "incorrect"
			: /correct|right/.test(cls)
				? "correct"
				: /requiresgrading|needsgrading|complete/.test(cls)
					? "pending"
					: "unknown";

	const mark = q.mark !== undefined && q.mark !== null && q.mark !== "" ? Number(q.mark) : null;
	return {
		slot: q.slot,
		number: q.number ?? null,
		type: q.type,
		status: q.status ?? textOf(root.querySelector(".info .state")),
		verdict,
		mark: Number.isFinite(mark) ? mark : null,
		maxmark: q.maxmark ?? null,
		textHtml: qtext?.innerHTML.trim() ?? "",
		text: qtext ? readable(qtext, lang) : "",
		options,
		formulationHtml,
		formulationText,
		rightAnswer: textOf(root.querySelector(".rightanswer")) || undefined,
		specificFeedback: root.querySelector(".specificfeedback")?.innerHTML.trim() || undefined,
		generalFeedback: root.querySelector(".generalfeedback")?.innerHTML.trim() || undefined
	};
}

// ---------------------------------------------------------------------------
// Study prompt: the finished attempt, laid out for an AI to write model answers
// and explanations, in the language the student uses EM3 in.

export type PromptLang = "zh-TW" | "zh-CN" | "en" | "ja";

export const PROMPT_LANG_LABEL: Record<PromptLang, string> = { "zh-TW": "繁體中文", "zh-CN": "简体中文", en: "English", ja: "日本語" };

/**
 * EM3's UI language: whoever reads EM3 in English wants the explanations in
 * English too. EM3 has no Simplified Chinese UI, so a Chinese UI still looks at
 * E3's language setting (zh_cn, …) and then the browser's for zh-CN.
 */
export function promptLang(moodleLang: string | undefined): PromptLang {
	const ui = getLanguage();
	if (ui !== "zh-TW") return ui;
	for (const raw of [moodleLang, ...navigator.languages]) {
		const l = (raw ?? "").toLowerCase().replace("_", "-");
		if (l.startsWith("zh")) return /cn|hans|sg/.test(l) ? "zh-CN" : "zh-TW";
	}
	return "zh-TW";
}

const STRINGS: Record<
	PromptLang,
	{
		intro: (course: string, quiz: string) => string;
		asks: string[];
		question: (n: number | string) => string;
		options: string;
		mine: string;
		answer: string;
		right: string;
		feedback: string;
		explanation: string;
		score: string;
		grade: string;
		noAnswer: string;
		/** An image in a question, with its alt text if any. */
		image: (alt: string) => string;
		/** Quotes a typed or picked answer inside the question text. */
		quote: (s: string) => string;
		colon: string;
		verdicts: Record<"correct" | "incorrect" | "partial" | "pending", string>;
		practiceIntro: (course: string, quiz: string) => string;
		practiceAsks: string[];
		current: string;
		worth: string;
	}
> = {
	"zh-TW": {
		practiceIntro: (c, q) => `我正在做「${c}」的練習測驗「${q}」。老師允許我們和 AI 討論，之後也要在報告裡說明我們怎麼和 AI 合作練習。請用繁體中文和我一起逐題討論：`,
		practiceAsks: [
			"先說明這一題在考什麼觀念。",
			"給出你認為的正確答案，並一步一步說明理由。",
			"說明其他選項為什麼不對；如果我已經有選答案，也評論我的選擇。",
			"如果題目資訊不完整或有爭議（例如有圖片沒附上），請直接指出，不要硬猜。",
			"等我說「整理紀錄」時，請把這次討論整理成可以放進報告的簡短紀錄：我問了什麼、你怎麼分析、哪些地方我自己判斷後做了不同決定、我學到了什麼。"
		],
		current: "← 我目前選的",
		worth: "配分",
		colon: "：",
		verdicts: { correct: "答對", incorrect: "答錯", partial: "部分正確", pending: "待評分" },
		intro: (c, q) => `我剛完成「${c}」的測驗「${q}」。以下是每一題的題目、我的作答和批改結果，請用繁體中文幫我：`,
		asks: [
			"逐題寫出正確答案，並一步一步說明詳解。",
			"選擇題請說明其他選項為什麼不對。",
			"我答錯或部分答對的題目，指出我可能的觀念誤區，並出一題類似的練習題（附答案）。",
			"最後用條列整理這份測驗考的重點觀念。",
			"如果題目資訊不完整（例如有圖片沒附上），請直接說明缺了什麼，不要猜。"
		],
		question: n => `第 ${n} 題`,
		options: "選項",
		mine: "← 我的選擇",
		answer: "我的作答",
		right: "E3 顯示的正確答案",
		feedback: "老師的回饋",
		explanation: "老師的解說",
		score: "得分",
		grade: "總分",
		noAnswer: "（未作答）",
		image: alt => `[圖片${alt ? `：${alt}` : ""}]`,
		quote: s => `「${s}」`
	},
	"zh-CN": {
		practiceIntro: (c, q) => `我正在做「${c}」的练习测验「${q}」。老师允许我们和 AI 讨论，之后也要在报告里说明我们怎么和 AI 合作练习。请用简体中文和我一起逐题讨论：`,
		practiceAsks: [
			"先说明这道题在考什么概念。",
			"给出你认为的正确答案，并一步一步说明理由。",
			"说明其他选项为什么不对；如果我已经选了答案，也评论我的选择。",
			"如果题目信息不完整或有争议（例如有图片没附上），请直接指出，不要硬猜。",
			"等我说「整理记录」时，请把这次讨论整理成可以放进报告的简短记录：我问了什么、你怎么分析、哪些地方我自己判断后做了不同决定、我学到了什么。"
		],
		current: "← 我目前选的",
		worth: "分值",
		colon: "：",
		verdicts: { correct: "答对", incorrect: "答错", partial: "部分正确", pending: "待评分" },
		intro: (c, q) => `我刚完成「${c}」的测验「${q}」。下面是每道题的题目、我的作答和批改结果，请用简体中文帮我：`,
		asks: [
			"逐题写出正确答案，并一步一步讲解。",
			"选择题请说明其他选项为什么不对。",
			"我答错或部分答对的题目，指出我可能的概念误区，并出一道类似的练习题（附答案）。",
			"最后用条列整理这份测验考的重点概念。",
			"如果题目信息不完整（例如有图片没附上），请直接说明缺了什么，不要猜。"
		],
		question: n => `第 ${n} 题`,
		options: "选项",
		mine: "← 我的选择",
		answer: "我的作答",
		right: "E3 显示的正确答案",
		feedback: "老师的反馈",
		explanation: "老师的讲解",
		score: "得分",
		grade: "总分",
		noAnswer: "（未作答）",
		image: alt => `[图片${alt ? `：${alt}` : ""}]`,
		quote: s => `「${s}」`
	},
	en: {
		practiceIntro: (c, q) =>
			`I'm working on the practice quiz "${q}" in my course "${c}". Our teacher allows discussing it with AI, and we'll later report how we practised together with AI. Please go through it with me question by question, in English:`,
		practiceAsks: [
			"Start by explaining which concept the question tests.",
			"Give the answer you think is correct, with step-by-step reasoning.",
			"Explain why the other options are wrong; if I've already picked an answer, comment on my choice.",
			"If a question is missing information or is ambiguous (for example an image that is not included), say so instead of guessing.",
			'When I say "write up the log", summarise this discussion as a short record I can put in my report: what I asked, how you analysed it, where I decided differently on my own, and what I learned.'
		],
		current: "← my current pick",
		worth: "Worth",
		colon: ": ",
		verdicts: { correct: "correct", incorrect: "wrong", partial: "partly correct", pending: "not graded yet" },
		intro: (c, q) => `I just finished the quiz "${q}" in my course "${c}". Below are the questions, my answers and how they were graded. Please, in English:`,
		asks: [
			"Give the correct answer to each question with a step-by-step explanation.",
			"For multiple-choice questions, explain why each other option is wrong.",
			"For questions I got wrong or partly right, point out the misconception I probably have and give me one similar practice question (with its answer).",
			"Finish with a bullet-point summary of the key concepts this quiz covers.",
			"If a question is missing information (for example an image that is not included), say what is missing instead of guessing."
		],
		question: n => `Question ${n}`,
		options: "Options",
		mine: "← my choice",
		answer: "My answer",
		right: "Correct answer shown by E3",
		feedback: "Feedback",
		explanation: "Teacher's explanation",
		score: "Score",
		grade: "Total",
		noAnswer: "(no answer)",
		image: alt => `[Image${alt ? `: ${alt}` : ""}]`,
		quote: s => `“${s}”`
	},
	ja: {
		practiceIntro: (c, q) =>
			`「${c}」の練習小テスト「${q}」に取り組んでいます。先生から AI と相談してよいと言われていて、あとで AI とどう協力して練習したかをレポートにまとめます。日本語で一問ずつ一緒に検討してください：`,
		practiceAsks: [
			"まず、その問題がどの概念を問うているかを説明してください。",
			"正解だと思う答えを、理由を順に追って示してください。",
			"ほかの選択肢がなぜ誤りかも説明し、私がすでに選んでいる場合はその選択にもコメントしてください。",
			"情報が足りない・曖昧な問題（画像が含まれていないなど）は、推測せずにそう指摘してください。",
			"私が「記録をまとめて」と言ったら、この相談をレポートに載せられる短い記録にまとめてください：私が何を聞いたか、あなたがどう分析したか、私が自分で判断して違う結論にした点、学んだこと。"
		],
		current: "← 今選んでいる答え",
		worth: "配点",
		colon: "：",
		verdicts: { correct: "正解", incorrect: "不正解", partial: "部分正解", pending: "採点待ち" },
		intro: (c, q) => `「${c}」の小テスト「${q}」を受け終わりました。以下は各問題の問題文、私の解答、採点結果です。日本語で次のことをお願いします：`,
		asks: [
			"各問題の正解を示し、手順を追って詳しく解説してください。",
			"選択問題では、ほかの選択肢がなぜ誤りなのかも説明してください。",
			"間違えた・部分的に正解した問題では、私の考え違いを指摘し、類題を一問（解答付きで）出してください。",
			"最後に、この小テストの要点を箇条書きでまとめてください。",
			"画像が含まれていないなど情報が足りない問題は、推測せずに何が足りないかを書いてください。"
		],
		question: n => `第 ${n} 問`,
		options: "選択肢",
		mine: "← 私の選択",
		answer: "私の解答",
		right: "E3 に表示された正解",
		feedback: "フィードバック",
		explanation: "先生の解説",
		score: "得点",
		grade: "合計",
		noAnswer: "（未解答）",
		image: alt => `[画像${alt ? `：${alt}` : ""}]`,
		quote: s => `「${s}」`
	}
};

const htmlText = (html: string | undefined, lang: PromptLang) => {
	if (!html) return "";
	const d = new DOMParser().parseFromString(html, "text/html");
	return readable(d.body, lang);
};

/**
 * "review": a finished attempt, asking for model answers and explanations.
 * "practice": an attempt in progress on a quiz the teacher lets students discuss
 * with AI, asking the AI to work through it together and keep a log for the report.
 */
export function buildStudyPrompt({
	mode = "review",
	course,
	quiz,
	questions,
	grade = null,
	lang
}: {
	mode?: "review" | "practice";
	course: string;
	quiz: Pick<Quiz, "name" | "grade">;
	questions: ReviewQuestion[];
	grade?: string | null;
	lang: PromptLang;
}) {
	const s = STRINGS[lang];
	const practice = mode === "practice";
	const asks = practice ? s.practiceAsks : s.asks;
	const out: string[] = [(practice ? s.practiceIntro : s.intro)(course, quiz.name), "", ...asks.map((a, i) => `${i + 1}. ${a}`), ""];
	const c = s.colon;
	if (grade !== null) out.push(`${s.grade}${c}${grade} / ${quiz.grade}`, "");
	questions.forEach((q, i) => {
		out.push("---", "");
		const verdict = practice ? null : q.verdict === "unknown" ? q.status : s.verdicts[q.verdict];
		const marks = practice ? (q.maxmark !== null ? `${s.worth} ${q.maxmark}` : null) : q.mark !== null && q.maxmark !== null ? `${s.score} ${q.mark} / ${q.maxmark}` : null;
		out.push(`## ${[s.question(q.number ?? i + 1), verdict, marks].filter(Boolean).join(" · ")}`, "");
		if (q.text) out.push(q.text, "");
		if (q.options.length) {
			out.push(`${s.options}${c.trim()}`);
			for (const o of q.options) out.push(`${o.label} ${o.text.replace(/\n/g, " ")}${o.chosen ? `  ${practice ? s.current : s.mine}` : ""}`);
			if (!practice && !q.options.some(o => o.chosen)) out.push(s.noAnswer);
			out.push("");
		} else if (q.formulationText) {
			out.push(`${s.answer}${c.trim()}`, q.formulationText, "");
		}
		if (q.rightAnswer) out.push(`${s.right}${c}${q.rightAnswer.replace(/^[^:：]*[:：]\s*/, "")}`);
		const fb = htmlText(q.specificFeedback, lang);
		if (fb) out.push(`${s.feedback}${c}${fb}`);
		const gen = htmlText(q.generalFeedback, lang);
		if (gen) out.push(`${s.explanation}${c}${gen}`);
		out.push("");
	});
	return (
		out
			.join("\n")
			.replace(/\n{3,}/g, "\n\n")
			.trim() + "\n"
	);
}
