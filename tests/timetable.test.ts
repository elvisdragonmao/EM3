import assert from "node:assert/strict";
import test from "node:test";
import { formatSlots, overlaps, parseScheduleCode, periodByCode, schoolPeriods, slotBlocks } from "../src/features/timetable/periods.ts";
import { setMoodleBaseUrl } from "../src/lib/moodle/client.ts";
import { DEFAULT_MOODLE_URL } from "../src/lib/moodle/site.ts";

const CCU = "https://ecourse2.ccu.edu.tw";

test("CCU periods match the school's printed timetable", () => {
	setMoodleBaseUrl(CCU);
	const times = (code: string) => `${periodByCode(code)?.start}-${periodByCode(code)?.end}`;
	assert.equal(times("1"), "07:10-08:00");
	assert.equal(times("8"), "14:10-15:00");
	assert.equal(times("15"), "21:10-22:00");
	assert.equal(times("A"), "07:15-08:30");
	assert.equal(times("B"), "08:45-10:00");
	assert.equal(times("E"), "13:15-14:30");
	assert.equal(times("J"), "20:45-22:00");
});

test("CCU schedules parse in Moodle's and students' spellings", () => {
	setMoodleBaseUrl(CCU);
	assert.deepEqual(parseScheduleCode("Tues. 週二 E,F").slots, [
		{ day: 1, period: "E" },
		{ day: 1, period: "F" }
	]);
	assert.deepEqual(parseScheduleCode("二EF").slots, parseScheduleCode("週二 E,F").slots);
	assert.deepEqual(parseScheduleCode("週一 8,9 星期三 C").slots, [
		{ day: 0, period: "8" },
		{ day: 0, period: "9" },
		{ day: 2, period: "C" }
	]);
	assert.deepEqual(parseScheduleCode("一12").slots, [{ day: 0, period: "12" }]);
	assert.equal(formatSlots(parseScheduleCode("週四 F,E 週二 9,8").slots), "週二 8,9 週四 E,F");
});

test("CCU lettered periods fill the hourly rows they overlap and merge into one block", () => {
	setMoodleBaseUrl(CCU);
	assert.deepEqual(
		schoolPeriods()!.rows.filter(row => overlaps("E", row)),
		["7", "8"]
	);
	assert.deepEqual(slotBlocks(parseScheduleCode("週二 E,F").slots), [{ day: 1, from: "E", to: "F" }]);
});

test("NYCU timetables behave as before", () => {
	setMoodleBaseUrl(DEFAULT_MOODLE_URL);
	assert.deepEqual(parseScheduleCode("T34-EC022"), {
		slots: [
			{ day: 1, period: "3" },
			{ day: 1, period: "4" }
		],
		room: "EC022"
	});
	assert.equal(formatSlots(parseScheduleCode("R7T43").slots), "T34R7");
	assert.deepEqual(slotBlocks(parseScheduleCode("M34N5").slots), [{ day: 0, from: "3", to: "5" }]);
	assert.deepEqual(slotBlocks(parseScheduleCode("M45").slots), [
		{ day: 0, from: "4", to: "4" },
		{ day: 0, from: "5", to: "5" }
	]);
});

test("periods from another school are dropped instead of crashing", () => {
	setMoodleBaseUrl(CCU);
	assert.deepEqual(slotBlocks([{ day: 0, period: "n" }]), []);
	setMoodleBaseUrl("https://moodle.example.edu.tw");
	assert.equal(schoolPeriods(), null);
	assert.deepEqual(parseScheduleCode("週二 E,F").slots, []);
});
