// Discord webhooks: validation, a masked hint for the settings page, and sending embeds.

const WEBHOOK = /^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\/(\d{5,25})\/([\w-]{20,100})$/;
// Local development points the webhook at a mock server instead of Discord.
const DEV_WEBHOOK = /^http:\/\/(?:localhost|127\.0\.0\.1):\d{2,5}\/api\/webhooks\/(\d{5,25})\/([\w-]{20,100})$/;

export function isDiscordWebhook(url: string, dev = false) {
	return WEBHOOK.test(url) || (dev && DEV_WEBHOOK.test(url));
}

/** "discord.com/…/webhooks/…6789" — enough to recognise which webhook, never the token. */
export function webhookHint(url: string) {
	const m = WEBHOOK.exec(url) ?? DEV_WEBHOOK.exec(url);
	if (!m) return null;
	return `${new URL(url).host}/api/webhooks/…${m[1].slice(-4)}`;
}

export interface Embed {
	title: string;
	url?: string;
	description?: string;
	color?: number;
	fields?: { name: string; value: string; inline?: boolean }[];
	timestamp?: string;
	footer?: { text: string };
}

export interface DiscordResult {
	ok: boolean;
	status: number;
	/** The webhook was deleted on Discord's side. */
	gone: boolean;
	error?: string;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Posts up to 10 embeds in one message; a 429 is retried once after Discord's retry_after. */
export async function sendDiscord(url: string, embeds: Embed[], retried = false): Promise<DiscordResult> {
	let res: Response;
	try {
		res = await fetch(`${url}?wait=true`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ username: "EM3", embeds: embeds.slice(0, 10), allowed_mentions: { parse: [] } })
		});
	} catch (err) {
		return { ok: false, status: 0, gone: false, error: err instanceof Error ? err.message : "network error" };
	}
	if (res.status === 429 && !retried) {
		const data = (await res.json().catch(() => ({}))) as { retry_after?: number };
		const wait = Number(data.retry_after ?? res.headers.get("retry-after") ?? 1);
		// Longer waits would hold the cron run; the reminder is retried on the next run instead.
		if (wait <= 10) {
			await sleep(Math.max(0, wait) * 1000 + 50);
			return sendDiscord(url, embeds, true);
		}
	}
	if (res.ok) return { ok: true, status: res.status, gone: false };
	const data = (await res.json().catch(() => ({}))) as { message?: string };
	return { ok: false, status: res.status, gone: res.status === 404 || res.status === 401, error: data.message ?? `HTTP ${res.status}` };
}
