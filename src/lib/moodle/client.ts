// Thin client for Moodle's mobile web service API. Compatible sites expose
// CORS headers so this static SPA can talk to them directly without a proxy.

import { t } from "./messages";
import { DEFAULT_MOODLE_URL, moodleUrl, normalizeMoodleUrl } from "./site";

let currentBaseUrl = DEFAULT_MOODLE_URL;

export function setMoodleBaseUrl(baseUrl: string) {
	currentBaseUrl = normalizeMoodleUrl(baseUrl);
}

export function getMoodleBaseUrl() {
	return currentBaseUrl;
}

export class MoodleError extends Error {
	constructor(
		message: string,
		readonly code: string
	) {
		super(message);
		this.name = "MoodleError";
	}

	/** True when the token is gone or revoked and the user must sign in again. */
	get isAuthError() {
		return this.code === "invalidtoken";
	}
}

export { encodeParams, type WsParams } from "./params";
import { encodeParams, type WsParams } from "./params";

let currentToken: string | null = null;
let onAuthLost: (() => void) | null = null;

export function setToken(token: string | null) {
	currentToken = token;
}

export function getToken() {
	return currentToken;
}

export function setAuthLostHandler(handler: () => void) {
	onAuthLost = handler;
}

function isErrorPayload(data: unknown): data is { exception?: string; errorcode: string; message?: string; error?: string } {
	return typeof data === "object" && data !== null && "errorcode" in data && ("exception" in data || "error" in data);
}

export async function call<T>(wsfunction: string, params: WsParams = {}, signal?: AbortSignal): Promise<T> {
	if (!currentToken) throw new MoodleError(t("notLoggedIn"), "notloggedin");
	const body = encodeParams({ ...params, wstoken: currentToken, wsfunction, moodlewsrestformat: "json" });
	const res = await fetch(`${moodleUrl(currentBaseUrl, "webservice/rest/server.php")}?wsfunction=${wsfunction}`, { method: "POST", body, signal });
	if (!res.ok) throw new MoodleError(t("httpStatus", res.status), "http");
	const data: unknown = await res.json();
	if (isErrorPayload(data)) {
		const err = new MoodleError(data.message ?? data.error ?? data.errorcode, data.errorcode);
		if (err.isAuthError) onAuthLost?.();
		throw err;
	}
	return data as T;
}

export interface TokenResponse {
	token: string;
	privatetoken?: string;
}

export async function requestToken(baseUrl: string, username: string, password: string): Promise<TokenResponse> {
	const body = new URLSearchParams({ username, password, service: "moodle_mobile_app" });
	let res: Response;
	try {
		res = await fetch(moodleUrl(baseUrl, "login/token.php"), { method: "POST", body });
	} catch {
		throw new MoodleError(t("unreachable"), "network");
	}
	if (!res.ok) throw new MoodleError(t("httpStatus", res.status), "http");
	let data: TokenResponse | { error: string; errorcode: string };
	try {
		data = (await res.json()) as TokenResponse | { error: string; errorcode: string };
	} catch {
		throw new MoodleError(t("notMoodle"), "notmoodle");
	}
	if ("error" in data) throw new MoodleError(data.error, data.errorcode);
	return data;
}

export interface UploadedFile {
	component: string;
	contextid: number;
	userid: string;
	filearea: string;
	filename: string;
	filepath: string;
	itemid: number;
	license: string;
	author: string;
	source: string;
}

/**
 * Uploads files into a fresh draft area and returns its item id. Passing an
 * existing `itemid` appends to that draft area instead.
 */
export async function uploadToDraft(files: File[], itemid = 0, onProgress?: (fraction: number) => void): Promise<number> {
	if (!currentToken) throw new MoodleError(t("notLoggedIn"), "notloggedin");
	const form = new FormData();
	form.append("token", currentToken);
	form.append("filearea", "draft");
	form.append("itemid", String(itemid));
	files.forEach((file, i) => form.append(`file_${i}`, file, file.name));

	// XHR instead of fetch so we can report upload progress.
	const text = await new Promise<string>((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("POST", moodleUrl(currentBaseUrl, "webservice/upload.php"));
		xhr.upload.onprogress = e => e.lengthComputable && onProgress?.(e.loaded / e.total);
		xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve(xhr.responseText) : reject(new MoodleError(t("uploadFailed", xhr.status), "http")));
		xhr.onerror = () => reject(new MoodleError(t("uploadNetwork"), "network"));
		xhr.send(form);
	});
	const data = JSON.parse(text) as UploadedFile[] | { error: string; errorcode: string };
	if (!Array.isArray(data)) throw new MoodleError(data.error, data.errorcode);
	return data[0].itemid;
}

interface BatchResult {
	responses: { error: boolean; data?: string; exception?: string }[];
}

/**
 * Runs several read-only WS calls in one HTTP round trip through
 * tool_mobile_call_external_functions. Failed calls resolve to `null`.
 */
export async function callMany<T>(requests: { fn: string; args: WsParams }[], signal?: AbortSignal): Promise<(T | null)[]> {
	if (!requests.length) return [];
	const res = await call<BatchResult>(
		"tool_mobile_call_external_functions",
		{
			requests: requests.map(r => ({ function: r.fn, arguments: JSON.stringify(r.args), settingfilter: 1, settingfileurl: 1 }))
		},
		signal
	);
	return res.responses.map(r => (r.error || !r.data ? null : (JSON.parse(r.data) as T)));
}
