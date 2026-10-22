import { cleanHtml } from "@/lib/moodle/files";
import type { AttemptQuestion } from "./attemptApi";

// Turns the HTML of a question on an attempt page into a form EM3 can show:
// Moodle's flag widget, scripts and sesskeys go, labels are made clickable,
// controls get EM3's styles and drag-and-drop gaps (ddwtos) become selects.
// DOMParser never runs scripts; cleanHtml sanitises the result and adds the
// token to image URLs. Ids, `for` and the control names are kept.

export interface PreparedQuestion {
	html: string;
	/** Name of the `:flagged` field, when the student may flag the question. */
	flagName: string | null;
	/** Essay textareas stored as HTML: their original HTML and the text EM3 shows. */
	essays: Record<string, { html: string; text: string }>;
	/** Needs something EM3 can't offer, such as a file upload or a drag-and-drop canvas. */
	unsupported: boolean;
}

export interface QuestionStrings {
	clearChoice: string;
	blank: (n: number) => string;
	choose: string;
}

const CONTROL_CLASS: [string, string][] = [
	["input[type=radio]", "radio radio-sm"],
	["input[type=checkbox]", "checkbox checkbox-sm"],
	["input[type=text], input[type=number], input:not([type])", "input input-sm"],
	["select", "select select-sm w-auto"],
	["textarea", "textarea w-full"],
	["input[type=submit], button", "btn btn-sm"]
];

/** Plain text of stored essay HTML, one paragraph per blank line. */
function htmlToPlain(html: string) {
	const doc = new DOMParser().parseFromString(html, "text/html");
	doc.querySelectorAll("br").forEach(br => br.replaceWith("\n"));
	doc.querySelectorAll("p, div, li, h1, h2, h3, h4, h5, h6").forEach(n => n.append("\n\n"));
	return (doc.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}

export function prepareQuestion(q: AttemptQuestion, s: QuestionStrings): PreparedQuestion {
	const doc = new DOMParser().parseFromString(q.html, "text/html");
	const root = doc.querySelector(".que") ?? doc.body;
	root.querySelectorAll("script, style, link, noscript").forEach(n => n.remove());

	// EM3 shows its own number, mark and flag toggle above the question.
	const flagName = root.querySelector<HTMLInputElement>(".questionflag input[type=hidden][name$=':flagged']")?.name ?? null;
	root.querySelector(".info")?.remove();
	root.querySelectorAll("h4.accesshide").forEach(n => n.remove());
	root.querySelectorAll(".accesshide").forEach(n => n.classList.replace("accesshide", "sr-only"));

	// Multichoice rows: make the whole answer text a <label> for its control.
	root.querySelectorAll<HTMLInputElement>("input[aria-labelledby]").forEach(input => {
		const target = doc.getElementById(input.getAttribute("aria-labelledby")!);
		if (!target || target.tagName === "LABEL" || !input.id) return;
		const label = doc.createElement("label");
		for (const a of target.attributes) label.setAttribute(a.name, a.value);
		label.setAttribute("for", input.id);
		label.append(...target.childNodes);
		target.replaceWith(label);
	});

	// Moodle's "clear my choice" is a JS-driven link; EM3 uses a real button that checks the hidden "-1" radio.
	root.querySelectorAll(".qtype_multichoice_clearchoice").forEach(wrap => {
		const none = wrap.querySelector<HTMLInputElement>("input[type=radio]");
		if (!none) return wrap.remove();
		wrap.removeAttribute("aria-hidden");
		wrap.classList.remove("sr-only");
		wrap.querySelectorAll("label").forEach(l => l.remove());
		none.setAttribute("tabindex", "-1");
		const btn = doc.createElement("button");
		btn.type = "button";
		btn.dataset.clear = none.name;
		btn.className = "btn btn-ghost btn-xs";
		btn.textContent = s.clearChoice;
		wrap.append(btn);
	});

	let unsupported = !!root.querySelector("input[type=file], .filemanager, canvas, object, embed, .ddarea, .droparea");
	if (root.classList.contains("ddwtos") && !dragWordsToSelects(doc, root, s)) unsupported = true;

	const essays: PreparedQuestion["essays"] = {};
	root.querySelectorAll("textarea").forEach(ta => {
		const format = root.querySelector<HTMLInputElement>(`input[name="${ta.name}format"]`)?.value;
		if (format !== "1") return;
		const html = ta.value || ta.textContent || "";
		const text = htmlToPlain(html);
		essays[ta.name] = { html, text };
		ta.textContent = text;
	});
	root.querySelectorAll("textarea").forEach(ta => Number(ta.getAttribute("rows")) < 8 && ta.setAttribute("rows", "8"));
	for (const [sel, cls] of CONTROL_CLASS) root.querySelectorAll(sel).forEach(n => n.classList.add(...cls.split(" ")));

	return { html: cleanHtml(root.outerHTML), flagName, essays, unsupported };
}

/**
 * Drag-and-drop into text keeps each gap's answer in a hidden "placeN" input
 * and the choices in "draggrouphomesN" boxes. Without Moodle's JS EM3 offers the
 * same choices as a select per gap. Returns false when the markup isn't recognised.
 */
function dragWordsToSelects(doc: Document, root: Element, s: QuestionStrings) {
	const inputs = [...root.querySelectorAll<HTMLInputElement>("input.placeinput")];
	if (!inputs.length) return false;
	for (const input of inputs) {
		const place = /\bplace(\d+)\b/.exec(input.className)?.[1];
		const group = /\bgroup(\d+)\b/.exec(input.className)?.[1];
		if (!place || !group) return false;
		const choices = new Map<string, string>();
		root.querySelectorAll(`.draggrouphomes${group} .draghome`).forEach(home => {
			const n = /\bchoice(\d+)\b/.exec(home.className)?.[1];
			const text = (home.textContent ?? "").replace(/\s+/g, " ").trim();
			if (n && !choices.has(n)) choices.set(n, text);
		});
		if (!choices.size) return false;
		const select = doc.createElement("select");
		select.name = input.name;
		select.id = input.id || `${input.name}_select`;
		const empty = doc.createElement("option");
		empty.value = "";
		empty.textContent = s.choose;
		select.append(empty);
		for (const [n, text] of choices) {
			const o = doc.createElement("option");
			o.value = n;
			o.textContent = text;
			if (input.value === n) o.setAttribute("selected", "");
			select.append(o);
		}
		const label = doc.createElement("label");
		label.className = "sr-only";
		label.setAttribute("for", select.id);
		label.textContent = s.blank(Number(place));
		root.querySelectorAll(`.drop.place${place}`).forEach(n => n.remove());
		input.replaceWith(label, select);
	}
	root.querySelectorAll("[class*=draggrouphomes]").forEach(n => n.remove());
	return true;
}
