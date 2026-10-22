import { open, randomBytes, b64url, seal, sha256Hex } from "./crypto";
import type { Env } from "./env";
import { type Ctx, HttpError, json, readJson, route } from "./http";
import { isKnownSite, MoodleError, moodleCall, type SiteInfo } from "./moodle";

const COOKIE = "em3_server";
const SESSION_DAYS = 90;
const LOCALES = ["zh-TW", "en", "ja", "emoji"];

export interface User {
	id: number;
	site: string;
	moodle_userid: number;
	fullname: string;
	token: string;
	token_ok: number;
	locale: string;
}

const now = () => Date.now();

function readCookie(req: Request, name: string) {
	for (const part of (req.headers.get("cookie") ?? "").split(/;\s*/)) {
		const i = part.indexOf("=");
		if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
	}
	return null;
}

const sessionCookie = (value: string, maxAge: number) => `${COOKIE}=${value}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

/** The signed-in EM3 user, or null. */
export async function currentUser(ctx: Ctx): Promise<User | null> {
	const raw = readCookie(ctx.req, COOKIE);
	if (!raw) return null;
	const id = await sha256Hex(raw);
	return ctx.env.DB.prepare("SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.id = ? AND sessions.expires_at > ?").bind(id, now()).first<User>();
}

export async function requireUser(ctx: Ctx): Promise<User> {
	const user = await currentUser(ctx);
	if (!user) throw new HttpError(401, "not signed in to the EM3 server");
	return user;
}

/** The user's Moodle token, decrypted. */
export const userToken = (env: Env, user: Pick<User, "token">) => open(env.TOKEN_KEY, user.token);

/** Calls Moodle as this user; an invalid token marks the account so background jobs stop until the next sign-in. */
export async function callAs<T>(env: Env, user: User, wsfunction: string, params: Parameters<typeof moodleCall>[3] = {}): Promise<T> {
	try {
		return await moodleCall<T>(user.site, await userToken(env, user), wsfunction, params);
	} catch (err) {
		if (err instanceof MoodleError && err.isAuthError) {
			await env.DB.prepare("UPDATE users SET token_ok = 0, updated_at = ? WHERE id = ?").bind(now(), user.id).run();
			user.token_ok = 0;
		}
		throw err;
	}
}

const account = (u: User) => ({ site: u.site, userid: u.moodle_userid, fullname: u.fullname, tokenOk: !!u.token_ok, locale: u.locale });

export const routes = [
	route("POST", "/api/session", async ctx => {
		const { site, token, locale } = await readJson<{ site?: string; token?: string; locale?: string }>(ctx.req);
		if (typeof site !== "string" || !isKnownSite(site)) throw new HttpError(400, "unsupported school");
		if (typeof token !== "string" || !/^[0-9a-f]{32}$/i.test(token)) throw new HttpError(400, "invalid token");
		// Proves the token is real and tells us whose it is; the client's word is never taken for the user id.
		let info: SiteInfo;
		try {
			info = await moodleCall<SiteInfo>(site, token, "core_webservice_get_site_info");
		} catch (err) {
			throw new HttpError(err instanceof MoodleError && err.isAuthError ? 401 : 502, err instanceof Error ? err.message : "Moodle error");
		}
		const sealed = await seal(ctx.env.TOKEN_KEY, token);
		const lang = LOCALES.includes(locale ?? "") ? locale! : "zh-TW";
		const t = now();
		const user = await ctx.env.DB.prepare(
			`INSERT INTO users (site, moodle_userid, fullname, token, token_ok, locale, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?)
			 ON CONFLICT (site, moodle_userid) DO UPDATE SET fullname = excluded.fullname, token = excluded.token, token_ok = 1, locale = excluded.locale, updated_at = excluded.updated_at
			 RETURNING *`
		)
			.bind(site, info.userid, info.fullname, sealed, lang, t, t)
			.first<User>();
		const raw = b64url.encode(randomBytes(32));
		await ctx.env.DB.prepare("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
			.bind(await sha256Hex(raw), user!.id, t, t + SESSION_DAYS * 86400_000)
			.run();
		// Old sessions of this user that have expired are cleaned up on the way.
		ctx.waitUntil(ctx.env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(t).run());
		return json(account(user!), 200, { "set-cookie": sessionCookie(raw, SESSION_DAYS * 86400) });
	}),

	route("GET", "/api/session", async ctx => json(account(await requireUser(ctx)))),

	route("PUT", "/api/session/locale", async ctx => {
		const user = await requireUser(ctx);
		const { locale } = await readJson<{ locale?: string }>(ctx.req);
		if (!LOCALES.includes(locale ?? "")) throw new HttpError(400, "unknown locale");
		await ctx.env.DB.prepare("UPDATE users SET locale = ? WHERE id = ?").bind(locale, user.id).run();
		return json({ ok: true });
	}),

	route("DELETE", "/api/session", async ctx => {
		const raw = readCookie(ctx.req, COOKIE);
		if (raw)
			await ctx.env.DB.prepare("DELETE FROM sessions WHERE id = ?")
				.bind(await sha256Hex(raw))
				.run();
		return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
	}),

	// Everything EM3 keeps about this account goes with it (ON DELETE CASCADE).
	route("DELETE", "/api/account", async ctx => {
		const user = await requireUser(ctx);
		await ctx.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(user.id).run();
		return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
	})
];
