import { callAs, requireUser, type User } from "../auth";
import { open, seal } from "../crypto";
import type { Env } from "../env";
import { HttpError, json, readJson, route, type Route } from "../http";
import { type DiscordResult, type Embed, isDiscordWebhook, sendDiscord, webhookHint } from "./discord";
import { messages } from "./messages";
import { type ActionEvent, planReminders, readSkips, type Reminder, reminderText, type ReminderText } from "./reminders";
import { isPushEndpoint, type PushResult, pushService, sendPush, type Vapid } from "./webpush";

// Deadline and grading reminders over Web Push and Discord (DESIGN.md, 伺服器版).

const DEFAULT_LEADS = [24, 3];
const MAX_LEADS = 4;
/** Users checked per cron run, and how many at once; the rest wait for the next run (oldest first). */
const USERS_PER_RUN = 40;
const CONCURRENCY = 6;
/** Reminders per user per run; more stay unsent and go out 15 minutes later. */
const SENDS_PER_USER = 5;
const KEEP_SENT_MS = 30 * 86400_000;

interface SettingsRow {
	enabled: number;
	lead_hours: string;
	deadlines: number;
	grading: number;
	discord_webhook: string | null;
}

interface SubscriptionRow {
	id: number;
	endpoint: string;
	p256dh: string;
	auth: string;
}

const now = () => Date.now();
const appOrigin = (env: Env) => env.DEV_ORIGIN ?? "https://e3.emtech.cc";
const vapid = (env: Env): Vapid => ({ publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT });

function parseLeads(raw: string): number[] {
	try {
		const v = JSON.parse(raw) as unknown;
		if (Array.isArray(v) && v.every(n => Number.isInteger(n) && n >= 1 && n <= 168)) return v as number[];
	} catch {
		// Fall through to the default.
	}
	return DEFAULT_LEADS;
}

async function readSettings(env: Env, userId: number): Promise<SettingsRow> {
	const row = await env.DB.prepare("SELECT enabled, lead_hours, deadlines, grading, discord_webhook FROM notify_settings WHERE user_id = ?").bind(userId).first<SettingsRow>();
	return row ?? { enabled: 0, lead_hours: JSON.stringify(DEFAULT_LEADS), deadlines: 1, grading: 1, discord_webhook: null };
}

async function settingsView(env: Env, userId: number) {
	const s = await readSettings(env, userId);
	const devices = await env.DB.prepare("SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = ?").bind(userId).first<{ n: number }>();
	let hint: string | null = null;
	if (s.discord_webhook) hint = webhookHint(await open(env.TOKEN_KEY, s.discord_webhook).catch(() => ""));
	// The webhook URL is a secret (anyone with it can post); only say whether one is set.
	return {
		enabled: !!s.enabled,
		leadHours: parseLeads(s.lead_hours),
		deadlines: !!s.deadlines,
		grading: !!s.grading,
		discord: { set: !!s.discord_webhook, hint },
		pushDevices: devices?.n ?? 0
	};
}

interface SettingsPatch {
	enabled?: unknown;
	leadHours?: unknown;
	deadlines?: unknown;
	grading?: unknown;
	discordWebhook?: unknown;
}

function bool(v: unknown, name: string, fallback: number) {
	if (v === undefined) return fallback;
	if (typeof v !== "boolean") throw new HttpError(400, `${name} must be a boolean`);
	return v ? 1 : 0;
}

async function updateSettings(env: Env, userId: number, patch: SettingsPatch) {
	const cur = await readSettings(env, userId);
	let leads = cur.lead_hours;
	if (patch.leadHours !== undefined) {
		const v = patch.leadHours;
		if (!Array.isArray(v) || !v.length || v.length > MAX_LEADS || !v.every(n => Number.isInteger(n) && n >= 1 && n <= 168) || new Set(v).size !== v.length)
			throw new HttpError(400, `leadHours must be 1–${MAX_LEADS} different whole hours between 1 and 168`);
		leads = JSON.stringify([...(v as number[])].sort((a, b) => b - a));
	}
	let webhook = cur.discord_webhook;
	if (patch.discordWebhook === null || patch.discordWebhook === "") webhook = null;
	else if (patch.discordWebhook !== undefined) {
		const url = typeof patch.discordWebhook === "string" ? patch.discordWebhook.trim() : "";
		if (!isDiscordWebhook(url, !!env.DEV_ORIGIN)) throw new HttpError(400, "not a Discord webhook URL");
		webhook = await seal(env.TOKEN_KEY, url);
	}
	await env.DB.prepare(
		`INSERT INTO notify_settings (user_id, enabled, lead_hours, deadlines, grading, discord_webhook, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT (user_id) DO UPDATE SET enabled = excluded.enabled, lead_hours = excluded.lead_hours, deadlines = excluded.deadlines,
		 grading = excluded.grading, discord_webhook = excluded.discord_webhook, updated_at = excluded.updated_at`
	)
		.bind(userId, bool(patch.enabled, "enabled", cur.enabled), leads, bool(patch.deadlines, "deadlines", cur.deadlines), bool(patch.grading, "grading", cur.grading), webhook, now())
		.run();
}

const subscriptions = (env: Env, userId: number) =>
	env.DB.prepare("SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?")
		.bind(userId)
		.all<SubscriptionRow>()
		.then(r => r.results);

/** Push to every device; subscriptions the push service says are gone are deleted. */
async function pushAll(env: Env, subs: SubscriptionRow[], payload: unknown, opts: Parameters<typeof sendPush>[3]) {
	const results = await Promise.all(subs.map(s => sendPush(vapid(env), s, payload, opts)));
	const gone = subs.filter((_, i) => results[i].gone).map(s => s.id);
	if (gone.length) await env.DB.prepare("DELETE FROM push_subscriptions WHERE id IN (SELECT value FROM json_each(?))").bind(JSON.stringify(gone)).run();
	return results;
}

async function discordUrl(env: Env, sealed: string | null) {
	return sealed ? open(env.TOKEN_KEY, sealed).catch(() => null) : null;
}

/** A dead webhook is forgotten, so EM3 doesn't keep hitting Discord with it. */
async function forgetWebhook(env: Env, userId: number) {
	await env.DB.prepare("UPDATE notify_settings SET discord_webhook = NULL, updated_at = ? WHERE user_id = ?").bind(now(), userId).run();
}

function embedFor(r: Reminder, text: ReminderText, locale: string, nowSec: number): Embed {
	const m = messages(locale);
	const fields = [
		{ name: m.course, value: text.course || "—", inline: true },
		// <t:…:R> renders as relative time in each reader's own Discord client.
		{ name: m.due, value: `${text.at} (<t:${r.event.timesort}:R>)`, inline: true }
	];
	if (text.count !== null) fields.push({ name: m.toGrade, value: m.toGradeCount(text.count), inline: true });
	return {
		title: text.title.slice(0, 256),
		url: text.url,
		color: r.kind === "grading" ? 0x8b5cf6 : r.event.timesort - nowSec < 6 * 3600 ? 0xef4444 : 0xf59e0b,
		fields,
		footer: { text: m.openInEm3 },
		timestamp: new Date(r.event.timesort * 1000).toISOString()
	};
}

interface DueUser extends User, SettingsRow {}

async function remindUser(env: Env, user: DueUser) {
	const leads = parseLeads(user.lead_hours);
	const nowSec = Math.floor(now() / 1000);
	const data = await callAs<{ events: ActionEvent[] }>(env, user, "core_calendar_get_action_events_by_timesort", {
		timesortfrom: nowSec,
		timesortto: nowSec + Math.max(...leads) * 3600,
		limitnum: 50,
		limittononsuspendedevents: 1
	});
	const events = data.events ?? [];
	if (!events.length) return;
	const candidates = leads.flatMap(h => events.map(e => `${e.id}:${h}`));
	const sentRows = await env.DB.prepare("SELECT key FROM sent_notifications WHERE user_id = ? AND key IN (SELECT value FROM json_each(?))")
		.bind(user.id, JSON.stringify(candidates))
		.all<{ key: string }>();
	// Assignments marked "no submission / no grading needed" live in the synced settings.
	const prefs = await env.DB.prepare("SELECT data FROM prefs WHERE user_id = ?").bind(user.id).first<{ data: string }>();
	let skips = readSkips(null);
	try {
		skips = readSkips(prefs ? JSON.parse(prefs.data) : null);
	} catch {
		// Unreadable settings: remind about everything.
	}
	const plan = planReminders(events, { leadHours: leads, deadlines: !!user.deadlines, grading: !!user.grading }, nowSec, new Set(sentRows.results.map(r => r.key)), skips);
	const send = plan.send.slice(0, SENDS_PER_USER);
	const done = [...plan.silent];

	if (send.length) {
		const origin = appOrigin(env);
		const texts = send.map(r => reminderText(r, user.locale, nowSec, origin));
		const subs = await subscriptions(env, user.id);
		const webhook = await discordUrl(env, user.discord_webhook);
		const pushResults = await Promise.all(
			send.map((r, i) =>
				pushAll(
					env,
					subs,
					{ title: texts[i].title, body: texts[i].body, url: texts[i].url, tag: texts[i].tag },
					{ ttl: Math.max(60, r.event.timesort - nowSec), urgency: r.event.timesort - nowSec < 6 * 3600 ? "high" : "normal", topic: `${r.kind}${r.event.id}` }
				)
			)
		);
		let discord: DiscordResult | null = null;
		if (webhook) {
			discord = await sendDiscord(
				webhook,
				send.map((r, i) => embedFor(r, texts[i], user.locale, nowSec))
			);
			if (discord.gone) await forgetWebhook(env, user.id);
		}
		send.forEach((r, i) => {
			const results: (PushResult | DiscordResult)[] = [...pushResults[i], ...(discord ? [discord] : [])];
			// Retry next run only when nothing arrived and the failure looks temporary.
			const retry = !results.some(x => x.ok) && results.some(x => x.status === 0 || x.status === 429 || x.status >= 500);
			if (!retry) done.push(...r.keys);
		});
	}
	if (done.length) {
		const t = now();
		await env.DB.batch(done.map(k => env.DB.prepare("INSERT OR IGNORE INTO sent_notifications (user_id, key, sent_at) VALUES (?, ?, ?)").bind(user.id, k, t)));
	}
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
	let next = 0;
	await Promise.all(
		Array.from({ length: Math.min(size, items.length) }, async () => {
			while (next < items.length) {
				const item = items[next++];
				await fn(item).catch(err => console.error("reminders", err instanceof Error ? err.message : err));
			}
		})
	);
}

/** Called by the cron every 15 minutes. */
export async function runReminders(env: Env) {
	const t = now();
	await env.DB.prepare("DELETE FROM sent_notifications WHERE sent_at < ?")
		.bind(t - KEEP_SENT_MS)
		.run();
	// Only users with somewhere to send to; checked within the last 10 minutes means this run already saw them.
	const { results: users } = await env.DB.prepare(
		`SELECT users.*, n.lead_hours, n.deadlines, n.grading, n.discord_webhook, n.enabled
		 FROM notify_settings n JOIN users ON users.id = n.user_id
		 WHERE n.enabled = 1 AND users.token_ok = 1 AND n.checked_at < ?
		   AND (n.discord_webhook IS NOT NULL OR EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.user_id = n.user_id))
		 ORDER BY n.checked_at LIMIT ?`
	)
		.bind(t - 10 * 60_000, USERS_PER_RUN)
		.all<DueUser>();
	if (!users.length) return;
	// Marked first, so a user whose check keeps failing doesn't hold the front of the queue.
	await env.DB.prepare("UPDATE notify_settings SET checked_at = ? WHERE user_id IN (SELECT value FROM json_each(?))")
		.bind(t, JSON.stringify(users.map(u => u.id)))
		.run();
	await pool(users, CONCURRENCY, u => remindUser(env, u));
}

interface PushBody {
	endpoint?: unknown;
	keys?: { p256dh?: unknown; auth?: unknown };
}

const isB64url = (v: unknown, min: number, max: number): v is string => typeof v === "string" && v.length >= min && v.length <= max && /^[A-Za-z0-9_-]+=*$/.test(v);

export const routes: Route[] = [
	route("GET", "/api/notify", async ctx => {
		const user = await requireUser(ctx);
		return json(await settingsView(ctx.env, user.id));
	}),

	route("PUT", "/api/notify", async ctx => {
		const user = await requireUser(ctx);
		await updateSettings(ctx.env, user.id, await readJson<SettingsPatch>(ctx.req));
		return json(await settingsView(ctx.env, user.id));
	}),

	route("POST", "/api/notify/test", async ctx => {
		const user = await requireUser(ctx);
		const { env } = ctx;
		const m = messages(user.locale);
		const url = `${appOrigin(env)}/#/settings`;
		const subs = await subscriptions(env, user.id);
		const push = await pushAll(env, subs, { title: m.testTitle, body: m.testBody, url, tag: "em3-test" }, { ttl: 600, urgency: "high" });
		const results: { channel: "push" | "discord"; ok: boolean; status: number; gone: boolean; service?: string; endpoint?: string; error?: string }[] = subs.map((s, i) => ({
			channel: "push",
			service: pushService(s.endpoint),
			endpoint: s.endpoint,
			...push[i]
		}));
		const s = await readSettings(env, user.id);
		const webhook = await discordUrl(env, s.discord_webhook);
		if (webhook) {
			const r = await sendDiscord(webhook, [{ title: m.testTitle, description: m.testBody, url, color: 0x22c55e, footer: { text: "EM3" } }]);
			if (r.gone) await forgetWebhook(env, user.id);
			results.push({ channel: "discord", ...r });
		}
		return json({ results });
	}),

	route("GET", "/api/push/key", async ctx => json({ key: ctx.env.VAPID_PUBLIC_KEY })),

	route("POST", "/api/push", async ctx => {
		const user = await requireUser(ctx);
		const body = await readJson<PushBody>(ctx.req);
		const endpoint = body.endpoint;
		if (typeof endpoint !== "string" || endpoint.length > 2048 || !isPushEndpoint(endpoint, !!ctx.env.DEV_ORIGIN)) throw new HttpError(400, "unsupported push endpoint");
		const { p256dh, auth } = body.keys ?? {};
		if (!isB64url(p256dh, 86, 90) || !isB64url(auth, 22, 24)) throw new HttpError(400, "invalid subscription keys");
		// An endpoint belongs to one browser; if someone else signs in there, it moves to them.
		await ctx.env.DB.prepare(
			`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`
		)
			.bind(user.id, endpoint, p256dh.replace(/=+$/, ""), auth.replace(/=+$/, ""), now())
			.run();
		return json({ ok: true });
	}),

	route("DELETE", "/api/push", async ctx => {
		const user = await requireUser(ctx);
		const { endpoint } = await readJson<{ endpoint?: unknown }>(ctx.req);
		if (typeof endpoint !== "string") throw new HttpError(400, "endpoint required");
		await ctx.env.DB.prepare("DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?").bind(user.id, endpoint).run();
		return json({ ok: true });
	})
];
