import { useSession } from "@/features/auth/session";
import { type DataMode, useServer } from "@/features/server/store";
import { schoolPeriods } from "./periods";

/** Where the signed-in school's class times are filled in from, if anywhere. */
export type TimesSource = "moodle" | "syllabus" | null;

/** Syllabus times come through the EM3 server, so only the server version has them; the local version stays manual. */
export function timesSource(mode: DataMode | null = useServer.getState().mode): TimesSource {
	const school = schoolPeriods();
	if (school?.fromMoodle) return "moodle";
	if (school?.fromSyllabus && mode === "server") return "syllabus";
	return null;
}

export function useTimesSource(): TimesSource {
	const mode = useServer(s => s.mode);
	// Re-render on a school change too; schoolPeriods() reads the signed-in site.
	useSession(s => s.baseUrl);
	return timesSource(mode);
}
