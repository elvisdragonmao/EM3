import { requireUser } from "./auth";
import { HttpError, json, route } from "./http";

// Settings sync: GET/PUT /api/prefs (docs/server.md). One copy per account; the newer
// change wins, by the client clock of the device that made it.
//
// PUT answers 200 either way:
//   { stored: true, updatedAt }          this copy is now the server's
//   { stored: false, data, updatedAt }   the server already had a copy at least as new; here it is

const MAX_BYTES = 256 * 1024;
/** A device whose clock runs ahead would otherwise win every later sync. */
const MAX_SKEW = 5 * 60_000;

interface Row {
	data: string;
	updated_at: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export const routes = [
	route("GET", "/api/prefs", async ctx => {
		const user = await requireUser(ctx);
		const row = await ctx.env.DB.prepare("SELECT data, updated_at FROM prefs WHERE user_id = ?").bind(user.id).first<Row>();
		return json(row ? { data: JSON.parse(row.data), updatedAt: row.updated_at } : { data: null });
	}),

	route("PUT", "/api/prefs", async ctx => {
		const user = await requireUser(ctx);
		if (Number(ctx.req.headers.get("content-length") ?? 0) > MAX_BYTES) throw new HttpError(413, "settings too large");
		const raw = await ctx.req.arrayBuffer();
		if (raw.byteLength > MAX_BYTES) throw new HttpError(413, "settings too large");
		let body: unknown;
		try {
			body = JSON.parse(new TextDecoder().decode(raw));
		} catch {
			throw new HttpError(400, "invalid JSON body");
		}
		if (!isRecord(body) || !isRecord(body.data)) throw new HttpError(400, "data must be an object");
		const { updatedAt } = body;
		if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt) || updatedAt <= 0) throw new HttpError(400, "updatedAt must be a timestamp in ms");
		const at = Math.min(Math.round(updatedAt), Date.now() + MAX_SKEW);

		const res = await ctx.env.DB.prepare(
			`INSERT INTO prefs (user_id, data, updated_at) VALUES (?, ?, ?)
			 ON CONFLICT (user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at WHERE excluded.updated_at > prefs.updated_at`
		)
			.bind(user.id, JSON.stringify(body.data), at)
			.run();
		if (res.meta.changes > 0) return json({ stored: true, updatedAt: at });
		const row = await ctx.env.DB.prepare("SELECT data, updated_at FROM prefs WHERE user_id = ?").bind(user.id).first<Row>();
		return json({ stored: false, data: JSON.parse(row!.data), updatedAt: row!.updated_at });
	})
];
