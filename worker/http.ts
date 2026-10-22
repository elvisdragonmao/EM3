import type { Env } from "./env";

export class HttpError extends Error {
	constructor(
		readonly status: number,
		message: string
	) {
		super(message);
	}
}

export const json = (data: unknown, status = 200, headers: HeadersInit = {}) =>
	new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });

export async function readJson<T>(req: Request): Promise<T> {
	try {
		return (await req.json()) as T;
	} catch {
		throw new HttpError(400, "invalid JSON body");
	}
}

export interface Ctx {
	req: Request;
	env: Env;
	url: URL;
	/** Named groups of the route's pattern. */
	params: Record<string, string>;
	waitUntil: (p: Promise<unknown>) => void;
}

export interface Route {
	method: "GET" | "POST" | "PUT" | "DELETE";
	/** Matched against the whole pathname; use named groups for parameters. */
	path: RegExp;
	handler: (ctx: Ctx) => Promise<Response>;
}

export const route = (method: Route["method"], path: string, handler: Route["handler"]): Route => ({
	method,
	// "/api/grading/:course" → named group "course".
	path: new RegExp(`^${path.replace(/:(\w+)/g, "(?<$1>[^/]+)")}$`),
	handler
});

/** Browsers send Origin on cross-site POSTs; refuse writes that don't come from EM3 itself (or the dev server). */
export function assertSameOrigin(req: Request, url: URL, env: Env) {
	if (req.method === "GET") return;
	const origin = req.headers.get("origin");
	if (origin && origin !== url.origin && origin !== env.DEV_ORIGIN) throw new HttpError(403, "cross-origin request");
}
