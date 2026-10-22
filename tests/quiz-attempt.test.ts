import assert from "node:assert/strict";
import test from "node:test";
import {
	attemptBlockers,
	collectFields,
	essayValue,
	type FieldLike,
	fieldsKey,
	formatClock,
	pageCount,
	textToHtml,
	unanswered,
	warningLevel,
	withFlags,
	wsData
} from "../src/features/quizzes/attempt.ts";
import { encodeParams } from "../src/lib/moodle/params.ts";

// Controls as they appear in E3's attempt markup (names from a real multichoice
// attempt, q256663:1), in document order.
const input = (name: string, type: string, value: string, extra: Partial<FieldLike> = {}): FieldLike => ({ name, type, tagName: "INPUT", value, ...extra });

const singleChoice = [
	input("q256663:1_:flagged", "hidden", "0"),
	input("q256663:1_:sequencecheck", "hidden", "1"),
	input("q256663:1_answer", "radio", "0"),
	input("q256663:1_answer", "radio", "1", { checked: true }),
	input("q256663:1_answer", "radio", "2"),
	// Moodle's hidden "clear my choice" radio, unchecked once the student picks.
	input("q256663:1_answer", "radio", "-1")
];

test("collectFields sends hidden fields and only the checked radio", () => {
	assert.deepEqual(collectFields(singleChoice), [
		{ name: "q256663:1_:flagged", value: "0" },
		{ name: "q256663:1_:sequencecheck", value: "1" },
		{ name: "q256663:1_answer", value: "1" }
	]);
});

test("collectFields sends the clear-choice value when nothing is picked", () => {
	const none = singleChoice.map(el => (el.type === "radio" ? { ...el, checked: el.value === "-1" } : el));
	assert.deepEqual(
		collectFields(none).find(f => f.name === "q256663:1_answer"),
		{ name: "q256663:1_answer", value: "-1" }
	);
});

test("collectFields lets a checked checkbox override the hidden 0 before it, like PHP", () => {
	const multi = [
		input("q9:2_:sequencecheck", "hidden", "2"),
		input("q9:2_choice0", "hidden", "0"),
		input("q9:2_choice0", "checkbox", "1", { checked: true }),
		input("q9:2_choice1", "hidden", "0"),
		input("q9:2_choice1", "checkbox", "1")
	];
	assert.deepEqual(collectFields(multi), [
		{ name: "q9:2_:sequencecheck", value: "2" },
		{ name: "q9:2_choice0", value: "1" },
		{ name: "q9:2_choice1", value: "0" }
	]);
});

test("collectFields reads selects and textareas, and skips buttons, files and disabled controls", () => {
	const fields = collectFields([
		{ name: "q9:3_sub0", tagName: "SELECT", type: "select-one", value: "2" },
		{ name: "q9:4_answer", tagName: "TEXTAREA", type: "textarea", value: "my essay" },
		input("q9:4_answerformat", "hidden", "1"),
		input("q9:5_-submit", "submit", "Check"),
		{ name: "q9:5_-tryagain", tagName: "BUTTON", type: "submit", value: "" },
		input("q9:6_attachments", "file", ""),
		input("q9:7_answer", "text", "locked", { disabled: true }),
		{ name: "", tagName: "FIELDSET", type: "fieldset", value: "" }
	]);
	assert.deepEqual(fields, [
		{ name: "q9:3_sub0", value: "2" },
		{ name: "q9:4_answer", value: "my essay" },
		{ name: "q9:4_answerformat", value: "1" }
	]);
});

test("collectFields maps values, e.g. essay text back to HTML", () => {
	const original = { html: "<p>first</p>", text: "first" };
	const valueOf = (el: FieldLike) => (el.tagName === "TEXTAREA" ? essayValue(el.value, original) : el.value);
	assert.equal(collectFields([{ name: "a", tagName: "TEXTAREA", value: "first" }], valueOf)[0].value, "<p>first</p>");
	assert.equal(collectFields([{ name: "a", tagName: "TEXTAREA", value: "one\ntwo\n\n<three>" }], valueOf)[0].value, "<p>one<br>two</p><p>&lt;three&gt;</p>");
});

test("textToHtml escapes and keeps paragraphs", () => {
	assert.equal(textToHtml(""), "");
	assert.equal(textToHtml('a & "b"\r\n\r\nc'), "<p>a &amp; &quot;b&quot;</p><p>c</p>");
});

test("withFlags replaces the :flagged field with EM3's toggle", () => {
	const fields = withFlags(collectFields(singleChoice), { "q256663:1_:flagged": true });
	assert.equal(fields.filter(f => f.name === "q256663:1_:flagged").length, 1);
	assert.equal(fields.find(f => f.name === "q256663:1_:flagged")?.value, "1");
});

test("wsData adds the page's slots and encodes as Moodle's data[i][name]/data[i][value]", () => {
	const data = wsData(collectFields(singleChoice), [1, 2]);
	assert.deepEqual(data.at(-1), { name: "slots", value: "1,2" });
	const body = encodeParams({ attemptid: 7, data, finishattempt: false });
	assert.equal(body.get("data[0][name]"), "q256663:1_:flagged");
	assert.equal(body.get("data[2][name]"), "q256663:1_answer");
	assert.equal(body.get("data[2][value]"), "1");
	assert.equal(body.get("data[3][value]"), "1,2");
	assert.equal(body.get("finishattempt"), "0");
});

test("fieldsKey ignores order so autosave only fires on real changes", () => {
	const a = [
		{ name: "x", value: "1" },
		{ name: "y", value: "2" }
	];
	assert.equal(fieldsKey(a), fieldsKey([...a].reverse()));
	assert.notEqual(fieldsKey(a), fieldsKey([{ name: "x", value: "1" }]));
});

const access = { canattempt: true, accessrules: [], activerulenames: ["quizaccess_openclosedate", "quizaccess_timelimit"], preventaccessreasons: [] };
const free = { isfinished: false, preventnewattemptreasons: [] };

test("attemptBlockers allows plain quizzes with supported types and rules", () => {
	assert.deepEqual(attemptBlockers(access, ["multichoice", "truefalse"], free, false), []);
	assert.deepEqual(attemptBlockers({ ...access, activerulenames: [...access.activerulenames, "quizaccess_password"] }, ["essay"], free, false), []);
});

test("attemptBlockers sends Safe Exam Browser, unknown rules and qtypes to E3", () => {
	assert.deepEqual(attemptBlockers({ ...access, activerulenames: ["quizaccess_seb"] }, [], free, false), [{ kind: "seb" }]);
	assert.deepEqual(attemptBlockers({ ...access, activerulenames: ["quizaccess_onesession"] }, ["ddmarker", "multichoice"], free, false), [
		{ kind: "rules", rules: ["onesession"] },
		{ kind: "qtypes", types: ["ddmarker"] }
	]);
});

test("attemptBlockers reports E3's own reasons, and new-attempt limits only without an attempt in progress", () => {
	assert.deepEqual(attemptBlockers({ ...access, canattempt: false, preventaccessreasons: ["Closed"] }, [], free, false), [{ kind: "prevented", reasons: ["Closed"] }]);
	const used = { ...free, preventnewattemptreasons: ["No more attempts"] };
	assert.deepEqual(attemptBlockers(access, [], used, false), [{ kind: "noNew", reasons: ["No more attempts"] }]);
	assert.deepEqual(attemptBlockers(access, [], used, true), []);
});

test("pageCount reads the layout and unanswered skips descriptions and autosaved answers", () => {
	assert.equal(pageCount("1,2,0,3,0"), 2);
	assert.equal(pageCount(undefined, [{ page: 0 }, { page: 2 }]), 3);
	const qs = [
		{ slot: 1, type: "multichoice", page: 0, stateclass: "notyetanswered" },
		{ slot: 2, type: "description", page: 0, stateclass: "notyetanswered" },
		{ slot: 3, type: "shortanswer", page: 0, stateclass: "answersaved" },
		{ slot: 4, type: "essay", page: 1, stateclass: "notyetanswered", hasautosavedstep: true },
		{ slot: 5, type: "numerical", page: 1, stateclass: "invalidanswer" }
	];
	assert.deepEqual(
		unanswered(qs).map(q => q.slot),
		[1, 5]
	);
});

test("the countdown warns at 5 and 1 minutes and formats the clock", () => {
	assert.equal(warningLevel(301), null);
	assert.equal(warningLevel(300), 5);
	assert.equal(warningLevel(61), 5);
	assert.equal(warningLevel(60), 1);
	assert.equal(formatClock(3723), "1:02:03");
	assert.equal(formatClock(59.9), "0:59");
	assert.equal(formatClock(-5), "0:00");
});
