import assert from "node:assert/strict";
import test from "node:test";
import { isDiscordWebhook, webhookHint } from "../worker/notify/discord.ts";
import { courseName, formatDue, messages } from "../worker/notify/messages.ts";
import { type ActionEvent, classify, em3Url, planReminders, reminderText, sentKey } from "../worker/notify/reminders.ts";

const NOW = 1_792_648_000;
const course = { id: 25294, fullname: "1151.515516.網路程式設計概論 Intro. to Network Programming" };

// Shapes as E3 returns them (core_calendar_get_action_events_by_timesort, Moodle 4.5).
const due = (id: number, hoursLeft: number, actionable = true): ActionEvent => ({
	id,
	name: "Assignment 1 After-Class Upload",
	activityname: "Assignment 1 After-Class Upload",
	modulename: "assign",
	instance: 244654,
	eventtype: "due",
	timesort: NOW + hoursLeft * 3600,
	url: "https://e3p.nycu.edu.tw/mod/assign/view.php?id=244654",
	course,
	action: { name: "繳交作業", url: "https://e3p.nycu.edu.tw/mod/assign/view.php?id=244654&action=editsubmission", itemcount: 1, actionable, showitemcount: false }
});
const grading = (id: number, hoursLeft: number, itemcount: number): ActionEvent => ({
	id,
	name: "期末報告 (計分) 應評分",
	activityname: "期末報告 (計分)",
	modulename: "assign",
	eventtype: "gradingdue",
	timesort: NOW + hoursLeft * 3600,
	url: "https://e3p.nycu.edu.tw/mod/assign/view.php?id=218500",
	course: { id: 23571, fullname: "測試課程" },
	action: { name: "成績", url: "https://e3p.nycu.edu.tw/mod/assign/view.php?id=218500&action=grader", itemcount, actionable: true, showitemcount: true }
});
const prefs = { leadHours: [24, 3], deadlines: true, grading: true };
/** The sent key of event `id` due `hoursLeft` hours after NOW, for lead `lead`. */
const key = (id: number, hoursLeft: number, lead: number) => sentKey(id, NOW + hoursLeft * 3600, lead);

test("classify tells deadlines from grading and skips what's already done", () => {
	assert.equal(classify(due(1, 2)), "deadline");
	assert.equal(classify(due(1, 2, false)), null);
	assert.equal(classify(grading(2, 2, 21)), "grading");
	assert.equal(classify(grading(2, 2, 0)), null);
	assert.equal(classify({ ...due(1, 2), action: null }), null);
});

test("planReminders sends only the smallest applying lead and marks the larger ones with it", () => {
	const { send, silent } = planReminders([due(1, 2), due(2, 10), due(3, 30)], prefs, NOW, new Set());
	assert.deepEqual(
		send.map(r => [r.event.id, r.lead, r.keys]),
		[
			[1, 3, [key(1, 2, 3), key(1, 2, 24)]],
			[2, 24, [key(2, 10, 24)]]
		]
	);
	assert.deepEqual(silent, []);
});

test("planReminders doesn't repeat a lead and sends the next one when it comes", () => {
	const sent = new Set([key(2, 10, 24)]);
	assert.deepEqual(planReminders([due(2, 10)], prefs, NOW, sent).send, []);
	// Eight hours on, the same deadline is two hours away.
	const later = planReminders([due(2, 10)], prefs, NOW + 8 * 3600, sent);
	assert.deepEqual(
		later.send.map(r => [r.lead, r.keys]),
		[[3, [key(2, 10, 3)]]]
	);
});

test("planReminders reminds again after the deadline is extended", () => {
	const sent = new Set([key(2, 2, 3), key(2, 2, 24)]);
	assert.deepEqual(planReminders([due(2, 2)], prefs, NOW, sent).send, []);
	assert.deepEqual(
		planReminders([due(2, 20)], prefs, NOW, sent).send.map(r => r.keys),
		[[key(2, 20, 24)]]
	);
});

test("planReminders marks a newly added larger lead silently when the closer one went out", () => {
	const r = planReminders([due(1, 2)], { ...prefs, leadHours: [72, 3] }, NOW, new Set([key(1, 2, 3)]));
	assert.deepEqual(r.send, []);
	assert.deepEqual(r.silent, [key(1, 2, 72)]);
});

test("planReminders honours the deadline and grading switches and skips past events", () => {
	const events = [due(1, 2), grading(2, 2, 5), due(3, -1)];
	assert.deepEqual(
		planReminders(events, { ...prefs, grading: false }, NOW, new Set()).send.map(r => r.event.id),
		[1]
	);
	assert.deepEqual(
		planReminders(events, { ...prefs, deadlines: false }, NOW, new Set()).send.map(r => r.event.id),
		[2]
	);
});

test("em3Url links to the EM3 page for the activity", () => {
	assert.equal(em3Url("https://e3.emtech.cc", due(1, 1), "deadline"), "https://e3.emtech.cc/#/courses/25294/assign/244654");
	assert.equal(em3Url("https://e3.emtech.cc", grading(1, 1, 3), "grading"), "https://e3.emtech.cc/#/courses/23571/assign/218500/grade");
	const quiz = { ...due(1, 1), modulename: "quiz", url: "https://e3p.nycu.edu.tw/mod/quiz/view.php?id=248567" };
	assert.equal(em3Url("https://e3.emtech.cc", quiz, "deadline"), "https://e3.emtech.cc/#/courses/25294/quiz/248567");
	assert.equal(em3Url("https://e3.emtech.cc", { ...due(1, 1), modulename: "forum" }, "deadline"), "https://e3.emtech.cc/#/courses/25294");
});

test("reminder text is in the user's language with Taiwan time", () => {
	const at = NOW + 3 * 3600;
	const r = { kind: "deadline" as const, event: due(1, 3), lead: 3, keys: ["1:3"] };
	const zh = reminderText(r, "zh-TW", NOW, "https://e3.emtech.cc");
	assert.equal(zh.title, "Assignment 1 After-Class Upload");
	assert.equal(zh.course, "網路程式設計概論");
	assert.match(zh.body, /^網路程式設計概論・3 小時後截止（/);
	assert.equal(reminderText(r, "en", NOW, "").course, "Intro. to Network Programming");
	assert.match(reminderText(r, "en", NOW, "").body, /due in 3 hours/);
	assert.match(reminderText({ ...r, kind: "grading", event: grading(2, 50, 21) }, "ja", NOW, "").body, /未採点 21 件、2 日後に期限/);
	// 2026-10-22 05:46 UTC + 3 h → 16:46 in Taipei.
	assert.match(formatDue(at, "en"), /16:46/);
	assert.match(formatDue(at, "zh-TW"), /16:46/);
	assert.doesNotMatch(reminderText(r, "emoji", NOW, "").body, /[A-Za-z]{3,}/);
	assert.equal(messages("xx").course, "課程");
	assert.equal(courseName("微積分甲(一) Calculus A (I)", "ja"), "微積分甲(一)");
});

test("isDiscordWebhook accepts only Discord's webhook URLs (and localhost in development)", () => {
	const id = "123456789012345678";
	const token = "abcdefghijklmnopqrstuvwxyz_ABCDEFGHIJ-0123456789";
	assert.ok(isDiscordWebhook(`https://discord.com/api/webhooks/${id}/${token}`));
	assert.ok(isDiscordWebhook(`https://discordapp.com/api/webhooks/${id}/${token}`));
	assert.ok(!isDiscordWebhook(`http://discord.com/api/webhooks/${id}/${token}`));
	assert.ok(!isDiscordWebhook(`https://discord.com.evil.example/api/webhooks/${id}/${token}`));
	assert.ok(!isDiscordWebhook(`https://discord.com/api/webhooks/${id}`));
	assert.ok(!isDiscordWebhook(`https://discord.com/api/webhooks/${id}/${token}?x=1`));
	assert.ok(!isDiscordWebhook(`http://localhost:9999/api/webhooks/${id}/${token}`));
	assert.ok(isDiscordWebhook(`http://localhost:9999/api/webhooks/${id}/${token}`, true));
	assert.equal(webhookHint(`https://discord.com/api/webhooks/${id}/${token}`), "discord.com/api/webhooks/…5678");
});
