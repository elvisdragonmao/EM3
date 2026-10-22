// Notification text in the user's locale (users.locale). The app's dictionaries live
// with the client code; the Worker only needs these few lines.

export type NotifyLocale = "zh-TW" | "en" | "ja" | "emoji";

interface Dict {
	/** "in 3 hours", from minutes left. */
	left: (minutes: number) => string;
	dueBody: (course: string, left: string, at: string) => string;
	gradingTitle: (activity: string) => string;
	gradingBody: (course: string, count: number, left: string, at: string) => string;
	course: string;
	due: string;
	toGrade: string;
	toGradeCount: (n: number) => string;
	openInEm3: string;
	testTitle: string;
	testBody: string;
}

const split = (m: number) => (m < 60 ? { n: Math.max(1, Math.round(m)), u: "m" } : m < 48 * 60 ? { n: Math.round(m / 60), u: "h" } : { n: Math.round(m / 1440), u: "d" });

const dicts: Record<NotifyLocale, Dict> = {
	"zh-TW": {
		left: m => {
			const { n, u } = split(m);
			return `${n} ${u === "m" ? "分鐘" : u === "h" ? "小時" : "天"}後`;
		},
		dueBody: (course, left, at) => `${course}・${left}截止（${at}）`,
		gradingTitle: a => `評分提醒：${a}`,
		gradingBody: (course, n, left, at) => `${course}・還有 ${n} 份待評分，${left}到期（${at}）`,
		course: "課程",
		due: "截止時間",
		toGrade: "待評分",
		toGradeCount: n => `${n} 份`,
		openInEm3: "在 EM3 打開",
		testTitle: "EM3 測試通知",
		testBody: "收到這則通知，表示截止提醒會送到這裡。"
	},
	en: {
		left: m => {
			const { n, u } = split(m);
			return `in ${n} ${u === "m" ? "minute" : u === "h" ? "hour" : "day"}${n === 1 ? "" : "s"}`;
		},
		dueBody: (course, left, at) => `${course} · due ${left} (${at})`,
		gradingTitle: a => `To grade: ${a}`,
		gradingBody: (course, n, left, at) => `${course} · ${n} submission${n === 1 ? "" : "s"} to grade, due ${left} (${at})`,
		course: "Course",
		due: "Due",
		toGrade: "To grade",
		toGradeCount: n => `${n} submission${n === 1 ? "" : "s"}`,
		openInEm3: "Open in EM3",
		testTitle: "EM3 test notification",
		testBody: "If you can see this, deadline reminders will reach you here."
	},
	ja: {
		left: m => {
			const { n, u } = split(m);
			return `${n} ${u === "m" ? "分" : u === "h" ? "時間" : "日"}後`;
		},
		dueBody: (course, left, at) => `${course}・${left}に締め切り（${at}）`,
		gradingTitle: a => `採点リマインダー：${a}`,
		gradingBody: (course, n, left, at) => `${course}・未採点 ${n} 件、${left}に期限（${at}）`,
		course: "授業",
		due: "締め切り",
		toGrade: "未採点",
		toGradeCount: n => `${n} 件`,
		openInEm3: "EM3 で開く",
		testTitle: "EM3 テスト通知",
		testBody: "この通知が届いていれば、締め切りリマインダーもここに届きます。"
	},
	emoji: {
		left: m => {
			const { n, u } = split(m);
			return `⏳${n}${u}`;
		},
		dueBody: (course, left, at) => `📚 ${course} · ${left} · 🗓️ ${at}`,
		gradingTitle: a => `✍️💯 ${a}`,
		gradingBody: (course, n, left, at) => `📚 ${course} · 📝×${n} · ${left} · 🗓️ ${at}`,
		course: "📚",
		due: "⏰",
		toGrade: "✍️💯",
		toGradeCount: n => `📝×${n}`,
		openInEm3: "👉 EM3",
		testTitle: "🔔🧪 EM3",
		testBody: "🔔✅👍"
	}
};

export const notifyLocale = (l: string): NotifyLocale => (l in dicts ? (l as NotifyLocale) : "zh-TW");

export const messages = (locale: string) => dicts[notifyLocale(locale)];

const INTL: Record<NotifyLocale, string> = { "zh-TW": "zh-Hant-TW", en: "en", ja: "ja", emoji: "zh-Hant-TW" };

/** A deadline as students read it: always Taiwan time, in the user's language. */
export function formatDue(sec: number, locale: string) {
	const l = notifyLocale(locale);
	const options: Intl.DateTimeFormatOptions =
		l === "emoji"
			? { timeZone: "Asia/Taipei", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
			: { timeZone: "Asia/Taipei", month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
	return new Intl.DateTimeFormat(INTL[l], options).format(new Date(sec * 1000));
}

/** 「1151.515516.網路程式設計概論 Intro. to Network Programming」 → the half the user reads. */
export function courseName(fullname: string, locale: string) {
	const title = fullname.replace(/^\d{3}[12X]\.[0-9A-Z]+\./i, "").trim();
	const m = /^(.*[㐀-鿿＀-￯][)）\]】」]*)\s+([A-Za-z].*)$/s.exec(title);
	if (!m) return title;
	return notifyLocale(locale) === "en" ? m[2].trim() : m[1].trim();
}
