// Release history, newest first. Each release's notes are Markdown in
// notes/<version>.<language>.md; the zh-TW file is also the GitHub release body.
// Keep this module import-free: tests load it with tsx.

export interface Release {
	version: string;
	/** Release day in Taiwan, YYYY-MM-DD. */
	date: string;
}

export const RELEASES: readonly Release[] = [
	{ version: "0.3.0", date: "2026-10-24" },
	{ version: "0.2.0", date: "2026-10-22" },
	{ version: "0.1.0", date: "2026-10-22" }
];

export const CURRENT_VERSION = RELEASES[0].version;

/** Numeric semver comparison: negative when a is older than b. */
export function compareVersions(a: string, b: string): number {
	const pa = a.split(".").map(Number);
	const pb = b.split(".").map(Number);
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const d = (pa[i] ?? 0) - (pb[i] ?? 0);
		if (d) return d;
	}
	return 0;
}

/**
 * Releases to show in the what's-new dialog. Someone who has never seen one
 * (they signed in before EM3 kept track) gets only the latest.
 */
export function unseenReleases(seen: string | null): Release[] {
	if (!seen) return [RELEASES[0]];
	return RELEASES.filter(r => compareVersions(r.version, seen) > 0);
}
