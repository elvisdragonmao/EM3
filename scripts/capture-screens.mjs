// Captures the marketing/README screenshots with personal data masked.
// Usage: NODE_PATH=$(npm root -g) node scripts/capture-screens.mjs <outdir>
// Needs `pnpm dev` running and .env.local. Then convert with `python3 scripts/screens-to-webp.py <outdir>`,
// which also puts the phone shots into public/iphone17pro.png.
//
// Privacy: E3 responses are rewritten before the app sees them. The account
// owner becomes 「王小明」, student IDs are replaced, forum authors become
// 「授課教師」, and the two courses named after students are hidden.
// State-changing E3 requests are aborted.
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
const out = process.argv[2];
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? "http://localhost:5173/";

const { token } = await (
	await fetch("https://e3p.nycu.edu.tw/login/token.php", { method: "POST", body: new URLSearchParams({ username: env.E3_USERNAME, password: env.E3_PASSWORD, service: "moodle_mobile_app" }) })
).json();
const site = await (
	await fetch("https://e3p.nycu.edu.tw/webservice/rest/server.php", {
		method: "POST",
		body: new URLSearchParams({ wstoken: token, wsfunction: "core_webservice_get_site_info", moodlewsrestformat: "json" })
	})
).json();

const FAKE = { name: "王小明", id: "110550000" };
const FAKE_PEOPLE =
	"陳怡君 林志豪 黃雅婷 張家豪 李佳穎 王俊傑 吳宜庭 劉冠宇 蔡佩珊 楊承翰 許雅雯 鄭宇軒 謝欣怡 郭柏翰 洪詩涵 曾子豪 邱靖雯 廖彥廷 賴品妤 周哲瑋 葉思妤 蘇柏宇 莊雅筑 呂建宏 江佳蓉 何宗翰 羅心怡 高子傑 潘郁婷 簡浩然".split(
		" "
	);
// Hand out fake names in order of first appearance so nobody in a screenshot shares one.
const assigned = new Map();
const fakePerson = id => {
	if (!assigned.has(id)) assigned.set(id, FAKE_PEOPLE[assigned.size % FAKE_PEOPLE.length]);
	return assigned.get(id);
};
/** Real names seen in roster responses; any of them reaching the page aborts the capture. */
const realNames = new Set();
const DEMO_SUBMISSION = "<p>程式原始碼連結：https://github.com/student/react-final-project</p><p>部署網址：https://react-final-project.vercel.app/</p>";
function scrubPeople(users) {
	for (const u of users) {
		if (u.fullname) realNames.add(u.fullname.replace(/^.+?\s\/\s\S+\s+/, "").trim());
		if (u.fullname) u.fullname = `資工系 / CS ${fakePerson(u.id)}`;
		if (u.firstname) u.firstname = fakePerson(u.id);
		if (u.lastname) u.lastname = "";
		if (u.email) u.email = `student${u.id % 1000}@example.edu.tw`;
		if (u.username) u.username = String(113550000 + (u.id % 1000));
		if (u.idnumber) u.idnumber = "";
		u.profileimageurl = u.profileimageurlsmall = "";
	}
	return users;
}
function scrub(text, fn) {
	if (fn === "mod_assign_list_participants") return JSON.stringify(scrubPeople(JSON.parse(text)));
	if (fn === "core_grades_get_gradable_users") {
		const d = JSON.parse(text);
		scrubPeople(d.users);
		return JSON.stringify(d);
	}
	if (fn === "mod_assign_get_submission_status") {
		const d = JSON.parse(text);
		for (const p of d.lastattempt?.submission?.plugins ?? []) for (const e of p.editorfields ?? []) e.text = DEMO_SUBMISSION;
		for (const p of d.feedback?.plugins ?? []) for (const e of p.editorfields ?? []) e.text = "";
		return JSON.stringify(d);
	}
	if (fn === "core_webservice_get_site_info") {
		const d = JSON.parse(text);
		Object.assign(d, { firstname: FAKE.name, lastname: "資工系 / DCP", fullname: `資工系 / DCP ${FAKE.name}`, username: FAKE.id, userpictureurl: "" });
		return JSON.stringify(d);
	}
	return text
		.replaceAll(site.firstname, FAKE.name)
		.replaceAll(site.username, FAKE.id)
		.replace(/(\\*"(?:userfullname|usermodifiedfullname)\\*"\s*:\s*\\*")[^"\\]*/g, "$1授課教師")
		.replace(/(\\*"author\\*"\s*:\s*\{[^{}]*?\\*"fullname\\*"\s*:\s*\\*")[^"\\]*/g, "$1授課教師");
}

const TIMETABLE = {
	25283: "T34R7-EC022",
	25294: "R34-EC114",
	25288: "W34-EC022",
	26454: "F12-CS-PC2",
	26652: "T78-PE",
	25066: "F34-HC103",
	25310: "T56-ED301",
	25309: "M567-ED117",
	27454: "M34-EC114"
};
const DAYS = "MTWRFSU";
const timetable = Object.fromEntries(
	Object.entries(TIMETABLE).map(([id, code]) => {
		const [times, room] = [code.slice(0, code.indexOf("-")), code.slice(code.indexOf("-") + 1)];
		let day = -1;
		const slots = [];
		for (const ch of times) DAYS.includes(ch) ? (day = DAYS.indexOf(ch)) : slots.push({ day, period: ch.toLowerCase() });
		return [id, { slots, room }];
	})
);

async function context(theme, width, height) {
	const browser = await chromium.launch();
	const mobile = width < 600;
	// Desktop: a 1080p window at 2x. Phone: iPhone 17 Pro (402×874 pt at 3x = 1206×2622 px).
	const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: mobile ? 3 : 2, locale: "zh-TW", timezoneId: "Asia/Taipei", isMobile: mobile, hasTouch: mobile });
	if (mobile)
		// Emulate the iPhone safe areas (Dynamic Island / status bar on top, home indicator below).
		await ctx.addInitScript(() =>
			document.addEventListener("DOMContentLoaded", () => {
				const s = document.createElement("style");
				s.textContent = "header.surface{padding-top:62px!important} .dock{height:calc(4rem + 28px)!important;padding-bottom:28px!important}";
				document.head.append(s);
			})
		);
	await ctx.addCookies([{ name: "em3_session", value: encodeURIComponent(JSON.stringify({ token, userid: site.userid })), url: base }]);
	const prefs = {
		state: {
			theme,
			nickname: "",
			timetable,
			snippets: ["做得很好！", "請補上執行結果的截圖。", "格式請依照作業說明。"],
			courses: { 23505: { hidden: true }, 23502: { hidden: true }, 25310: { nickname: "HCI" } },
			seen: {}
		},
		version: 1
	};
	await ctx.addInitScript(p => {
		localStorage.setItem("em3:prefs", p);
		indexedDB.deleteDatabase("keyval-store");
	}, JSON.stringify(prefs));
	await ctx.route(/e3p\.nycu\.edu\.tw\/webservice\/rest/, async route => {
		const body = route.request().postData() ?? "";
		const fn = new URLSearchParams(body).get("wsfunction") ?? "";
		if (/save_|submit_|_view_|mark_|_set_|update_|delete_|add_|start_|process_|send_|create_|get_attempt_data/.test(decodeURIComponent(body))) return route.abort();
		const res = await route.fetch();
		return route.fulfill({ response: res, body: scrub(await res.text(), fn) });
	});
	await ctx.route(/e3p\.nycu\.edu\.tw\/webservice\/upload/, r => r.abort());
	// A Thursday during 演算法概論 so the "now" card is live. Shift Date instead of freezing
	// the clock: frozen time stalls motion's enter animations at opacity 0.
	await ctx.addInitScript(target => {
		const Real = Date;
		const offset = target - Real.now();
		class Shifted extends Real {
			constructor(...args) {
				if (args.length) super(...args);
				else super(Real.now() + offset);
			}
			static now() {
				return Real.now() + offset;
			}
		}
		globalThis.Date = Shifted;
	}, new Date("2026-10-15T15:52:00+08:00").getTime());
	const page = await ctx.newPage();
	page.on("pageerror", e => console.error("pageerror:", e.message));
	return { browser, page };
}

async function shot(page, name, path, prep) {
	await page.goto(base + "#" + path);
	await page.waitForTimeout(4500);
	if (prep) await prep(page);
	await page.evaluate(() => scrollTo(0, 0));
	await page.waitForTimeout(900);
	const html = await page.content();
	if (html.includes(site.firstname) || html.includes(site.username)) throw new Error(`personal data leaked on ${path}`);
	for (const n of realNames) if (n.length >= 2 && html.includes(n)) throw new Error(`student name leaked on ${path}`);
	await page.screenshot({ path: `${out}/${name}.png` });
	console.log(name);
}

for (const [theme, suffix] of [
	["em3-dark", "dark"],
	["em3", "light"]
]) {
	const desk = await context(theme, 1920, 1080);
	await shot(desk.page, `dashboard-${suffix}`, "/");
	await shot(desk.page, `materials-${suffix}`, "/courses/25288");
	await shot(desk.page, `submit-${suffix}`, "/courses/25288/assign/239512", async p => {
		await p.locator('input[type="file"]').setInputFiles({ name: "HW1_王小明.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n") });
	});
	await shot(desk.page, `courses-${suffix}`, "/courses");
	await shot(desk.page, `timetable-${suffix}`, "/timetable");
	// Teacher views (the account teaches course 23571).
	await shot(desk.page, `grading-${suffix}`, "/courses/23571/assign/218500/grade", async p => {
		await p.locator('input[placeholder="未評分"]').fill("92");
		await p.getByRole("tab", { name: "Markdown" }).first().click();
		await p.locator("textarea[aria-label='評語']").fill("**很完整的作品！**\n\n- 部署成功，互動流暢\n- README 可以再補上安裝步驟");
		await p.getByRole("tab", { name: "編輯器" }).first().click();
	});
	await shot(desk.page, `quiz-${suffix}`, "/courses/23571/quiz-builder", async p => {
		await p.evaluate(() => localStorage.removeItem("em3:quiz-draft:23571"));
		await p.reload();
		await p.waitForTimeout(1500);
		await p.getByRole("button", { name: /從試算表貼上/ }).click();
		await p.locator("dialog[open] textarea").fill("JSX 最後會被編譯成什麼？\tHTML 字串\tReact.createElement 呼叫\tCSS\tJSON\tB\nuseState 會回傳一個陣列\tO\n$2^{10}$ 等於多少？\t1024");
		await p.getByRole("button", { name: /加入 \d+ 題/ }).click();
		await p.locator("input[placeholder='例如：第 3 週小考']").fill("第 5 週 Hooks 小考");
	});
	await shot(desk.page, `announce-${suffix}`, "/courses/23571/announce", async p => {
		await p.locator('input[aria-label="公告標題"]').fill("期末報告繳交提醒");
		await p.getByRole("tab", { name: "Markdown" }).first().click();
		await p.locator("textarea[aria-label='公告內容']").fill("各位同學好，\n\n**期末報告**請在 6/1 23:59 前上傳，記得附上：\n\n1. GitHub 原始碼連結\n2. Vercel 部署網址\n\n有問題歡迎在討論區發問。");
		await p.getByRole("tab", { name: "編輯器" }).first().click();
	});
	// Last: the shortcuts dialog stays open across same-document navigations.
	await shot(desk.page, `shortcuts-${suffix}`, "/", p => p.keyboard.press("Meta+/"));
	await desk.browser.close();

	const phone = await context(theme, 402, 874);
	await shot(phone.page, `mobile-dashboard-${suffix}`, "/");
	await shot(phone.page, `mobile-course-${suffix}`, "/courses/25283");
	await phone.browser.close();
}
