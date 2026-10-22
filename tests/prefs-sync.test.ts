import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_META, merge, nextUpdatedAt, payload, readMeta, stampChanges, type SyncMeta } from "../src/features/server/syncRules.ts";

const KEYS = ["theme", "courses", "nickname"];
const ME = "https://e3p.nycu.edu.tw#59828";
const local = { theme: "dark", courses: { 1: { color: "#f00" } }, nickname: "" };

test("a device that never synced takes the server's copy whole", () => {
	const remote = { data: payload({ theme: "light", courses: {}, nickname: "Em" }, { theme: 50 }), updatedAt: 100 };
	// Even when this device changed things later (e.g. in the local version), its defaults must not win.
	const meta: SyncMeta = { ...EMPTY_META, stamps: { theme: 999, courses: 999 }, dirty: true };
	const m = merge(KEYS, local, meta, ME, remote);
	assert.deepEqual(m.apply, { theme: "light", courses: {}, nickname: "Em" });
	assert.equal(m.push, false);
	assert.deepEqual(m.stamps, { theme: 50, courses: 100, nickname: 100 });
});

test("another account on the same device also starts fresh", () => {
	const remote = { data: payload({ theme: "light", courses: {}, nickname: "" }, {}), updatedAt: 100 };
	const meta: SyncMeta = { owner: "https://other#1", stamps: { theme: 999 }, syncedAt: 500, dirty: false };
	assert.equal(merge(KEYS, local, meta, ME, remote).apply?.theme, "light");
});

test("nothing on the server yet means this device sends its copy", () => {
	const m = merge(KEYS, local, EMPTY_META, ME, { data: null });
	assert.equal(m.push, true);
	assert.equal(m.apply, null);
});

test("each setting keeps its newer side", () => {
	// This device changed the colour at 300; another device changed the theme at 250.
	const meta: SyncMeta = { owner: ME, stamps: { theme: 10, courses: 300, nickname: 10 }, syncedAt: 200, dirty: true };
	const remote = { data: payload({ theme: "light", courses: {}, nickname: "" }, { theme: 250, courses: 20, nickname: 10 }), updatedAt: 250 };
	const m = merge(KEYS, local, meta, ME, remote);
	assert.deepEqual(m.apply, { theme: "light" });
	assert.equal(m.push, true);
	assert.deepEqual(m.stamps, { theme: 250, courses: 300, nickname: 10 });
});

test("an unchanged server copy and an unchanged device do nothing", () => {
	const stamps = { theme: 10, courses: 20, nickname: 30 };
	const meta: SyncMeta = { owner: ME, stamps, syncedAt: 200, dirty: false };
	const m = merge(KEYS, local, meta, ME, { data: payload(local, stamps), updatedAt: 200 });
	assert.deepEqual(m, { apply: null, stamps, push: false });
});

test("a newer server copy without stamps wins wherever this device is older", () => {
	const meta: SyncMeta = { owner: ME, stamps: { theme: 10, courses: 400 }, syncedAt: 100, dirty: false };
	const m = merge(KEYS, local, meta, ME, { data: { theme: "light", courses: {}, nickname: "" }, updatedAt: 300 });
	assert.deepEqual(m.apply, { theme: "light" });
	assert.equal(m.push, true);
});

test("a setting the server's copy doesn't have yet is sent", () => {
	const stamps = { theme: 10, courses: 20 };
	const meta: SyncMeta = { owner: ME, stamps, syncedAt: 200, dirty: false };
	const m = merge(KEYS, local, meta, ME, { data: payload({ theme: "dark", courses: local.courses }, stamps), updatedAt: 200 });
	assert.equal(m.apply, null);
	assert.equal(m.push, true);
});

test("stamps move forward only for the settings that changed", () => {
	const courses = {};
	assert.equal(stampChanges(KEYS, { theme: "a", courses }, { theme: "a", courses }, {}, 100), null);
	assert.deepEqual(stampChanges(KEYS, { theme: "a", courses }, { theme: "b", courses }, { courses: 5 }, 100), { theme: 100, courses: 5 });
	// A clock that went backwards still moves the stamp forward.
	assert.deepEqual(stampChanges(KEYS, { theme: "a" }, { theme: "b" }, { theme: 500 }, 100), { theme: 501 });
	assert.equal(nextUpdatedAt(1000, 500), 1001);
	assert.equal(nextUpdatedAt(null, 500), 500);
});

test("stored sync state survives junk", () => {
	assert.deepEqual(readMeta("not json"), EMPTY_META);
	assert.deepEqual(readMeta(null), EMPTY_META);
	assert.deepEqual(readMeta(JSON.stringify({ owner: ME, stamps: { theme: 1 }, syncedAt: 5, dirty: true })), { owner: ME, stamps: { theme: 1 }, syncedAt: 5, dirty: true });
});
