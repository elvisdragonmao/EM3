// Screenshots EM3 pages while signed in as the .env.local account.
// Usage: NODE_PATH=$(npm root -g) node scripts/shot.mjs <outdir> <width>x<height> <hash-path>...
//   e.g. NODE_PATH=$(npm root -g) node scripts/shot.mjs /tmp/shots 1440x900 / /courses /timetable
// Needs `pnpm dev` running (BASE overrides http://localhost:5173/) and the global Playwright CLI.
// Any E3 request that could change state is aborted, so clicking around is safe.
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)(process.env.NODE_PATH + "/playwright");
const env = Object.fromEntries(
	readFileSync(new URL("../.env.local", import.meta.url), "utf8")
		.split("\n")
		.filter(l => l.includes("=") && !l.startsWith("#"))
		.map(l => [
			l.slice(0, l.indexOf("=")).trim(),
			l
				.slice(l.indexOf("=") + 1)
				.trim()
				.replace(/^['"]|['"]$/g, "")
		])
);
const [out, size, ...paths] = process.argv.slice(2);
const [width, height] = size.split("x").map(Number);
const base = process.env.BASE ?? "http://localhost:5173/";
mkdirSync(out, { recursive: true });

const tokenRes = await fetch("https://e3p.nycu.edu.tw/login/token.php", {
	method: "POST",
	body: new URLSearchParams({ username: env.E3_USERNAME, password: env.E3_PASSWORD, service: "moodle_mobile_app" })
});
const { token } = await tokenRes.json();
const info = await (
	await fetch("https://e3p.nycu.edu.tw/webservice/rest/server.php", {
		method: "POST",
		body: new URLSearchParams({ wstoken: token, wsfunction: "core_webservice_get_site_info", moodlewsrestformat: "json" })
	})
).json();

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, locale: "zh-TW", timezoneId: "Asia/Taipei", isMobile: width < 600, hasTouch: width < 600 });
await ctx.addCookies([{ name: "em3_session", value: encodeURIComponent(JSON.stringify({ token, userid: info.userid })), url: base }]);
// Quiz attempts are writes too, and get_attempt_data moves the attempt's current page.
const WRITE = /mod_assign_save_submission|mod_assign_submit_for_grading|webservice\/upload\.php|_view_|mark_|_set_|update_|delete_|add_|_attempt(_data)?\b|start_|save_|process_|submit_|send_|create_/;
await ctx.route(/e3p\.nycu\.edu\.tw/, route => {
	const body = decodeURIComponent(route.request().postData() ?? "");
	if (WRITE.test(route.request().url()) || WRITE.test(body)) return route.abort();
	return route.continue();
});
const page = await ctx.newPage();
page.on("pageerror", e => console.error("pageerror:", e.message));
for (const p of paths) {
	await page.goto(base + "#" + p);
	await page.waitForTimeout(Number(process.env.WAIT ?? 3000));
	const file = `${out}/${(p.replace(/[^a-z0-9]+/gi, "_") || "home").replace(/^_+|_+$/g, "") || "home"}_${width}.png`;
	await page.screenshot({ path: file, fullPage: process.env.FULL === "1" });
	console.log(file);
}
await browser.close();
