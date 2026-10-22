// Client for the EM3 server's /api (docs/server.md). Only the server version calls it;
// the local version never contacts EM3's server.

export class ServerError extends Error {
	constructor(
		readonly status: number,
		message: string
	) {
		super(message);
		this.name = "ServerError";
	}
}

export async function api<T>(path: string, init: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
	let res: Response;
	try {
		res = await fetch(`/api/${path}`, {
			method: init.method ?? "GET",
			credentials: "same-origin",
			headers: init.body === undefined ? undefined : { "content-type": "application/json" },
			body: init.body === undefined ? undefined : JSON.stringify(init.body),
			signal: init.signal
		});
	} catch {
		throw new ServerError(0, "network");
	}
	const data = (await res.json().catch(() => ({}))) as T & { error?: string };
	if (!res.ok) throw new ServerError(res.status, data.error ?? `HTTP ${res.status}`);
	return data;
}

export interface ServerAccount {
	site: string;
	userid: number;
	fullname: string;
	tokenOk: boolean;
	locale: string;
}
