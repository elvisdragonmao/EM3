// EM3 server: serves the static app and the /api routes of the server version (docs/server.md).

import { routes as authRoutes } from "./auth";
import type { Env } from "./env";
import { routes as gradingRoutes, runReleases } from "./grading";
import { assertSameOrigin, HttpError, json, type Route } from "./http";
import { routes as notifyRoutes, runReminders } from "./notify";
import { routes as nycuRoutes } from "./nycu";
import { routes as prefsRoutes } from "./prefs";

const ROUTES: Route[] = [...authRoutes, ...prefsRoutes, ...nycuRoutes, ...notifyRoutes, ...gradingRoutes];

async function handleApi(req: Request, env: Env, exec: ExecutionContext, url: URL): Promise<Response> {
	try {
		assertSameOrigin(req, url, env);
		for (const r of ROUTES) {
			const m = r.method === req.method ? r.path.exec(url.pathname) : null;
			if (m) return await r.handler({ req, env, url, params: m.groups ?? {}, waitUntil: p => exec.waitUntil(p) });
		}
		throw new HttpError(404, "not found");
	} catch (err) {
		if (err instanceof HttpError) return json({ error: err.message }, err.status);
		console.error(err);
		return json({ error: "internal error" }, 500);
	}
}

export default {
	async fetch(req, env, exec) {
		const url = new URL(req.url);
		if (url.pathname.startsWith("/api/")) return handleApi(req, env, exec, url);
		return env.ASSETS.fetch(req);
	},
	async scheduled(_event, env, exec) {
		exec.waitUntil(Promise.allSettled([runReminders(env), runReleases(env)]).then(rs => rs.forEach(r => r.status === "rejected" && console.error(r.reason))));
	}
} satisfies ExportedHandler<Env>;
