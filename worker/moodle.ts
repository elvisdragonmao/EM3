import { encodeParams, type WsParams } from "../src/lib/moodle/params";
import { MOODLE_SITES } from "../src/lib/moodle/sites";

export class MoodleError extends Error {
	constructor(
		message: string,
		readonly code: string
	) {
		super(message);
	}
	get isAuthError() {
		return this.code === "invalidtoken";
	}
}

/** The server only talks to schools in the app's list, never to a URL a client made up. */
export const isKnownSite = (site: string) => MOODLE_SITES.some(s => s.baseUrl === site);

export async function moodleCall<T>(site: string, token: string, wsfunction: string, params: WsParams = {}): Promise<T> {
	if (!isKnownSite(site)) throw new MoodleError("unknown site", "unknownsite");
	const body = encodeParams({ ...params, wstoken: token, wsfunction, moodlewsrestformat: "json" });
	const res = await fetch(`${site}/webservice/rest/server.php?wsfunction=${wsfunction}`, { method: "POST", body });
	if (!res.ok) throw new MoodleError(`HTTP ${res.status}`, "http");
	const data = (await res.json()) as unknown;
	if (typeof data === "object" && data !== null && "errorcode" in data && ("exception" in data || "error" in data)) {
		const e = data as { errorcode: string; message?: string; error?: string };
		throw new MoodleError(e.message ?? e.error ?? e.errorcode, e.errorcode);
	}
	return data as T;
}

export interface SiteInfo {
	userid: number;
	fullname: string;
	lang?: string;
}
