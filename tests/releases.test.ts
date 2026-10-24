import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { compareVersions, CURRENT_VERSION, RELEASES, unseenReleases } from "../src/features/updates/releases.ts";

test("the newest release matches package.json", () => {
	const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
	assert.equal(CURRENT_VERSION, pkg.version);
});

test("releases are listed newest first", () => {
	for (let i = 1; i < RELEASES.length; i++) assert.ok(compareVersions(RELEASES[i - 1].version, RELEASES[i].version) > 0, RELEASES[i].version);
});

test("every release has notes in each spoken language", () => {
	for (const { version } of RELEASES)
		for (const lang of ["zh-TW", "en", "ja"]) assert.ok(existsSync(new URL(`../src/features/updates/notes/${version}.${lang}.md`, import.meta.url)), `${version}.${lang}.md`);
});

test("compareVersions compares numerically", () => {
	assert.ok(compareVersions("0.10.0", "0.9.0") > 0);
	assert.ok(compareVersions("0.2.0", "0.2.1") < 0);
	assert.equal(compareVersions("1.0", "1.0.0"), 0);
});

test("unseenReleases lists versions newer than the last one seen", () => {
	assert.deepEqual(
		unseenReleases("0.1.0").map(r => r.version),
		RELEASES.filter(r => r.version !== "0.1.0").map(r => r.version)
	);
	assert.deepEqual(unseenReleases(CURRENT_VERSION), []);
	// Nothing recorded: only the latest, not the whole history.
	assert.deepEqual(unseenReleases(null), [RELEASES[0]]);
});
