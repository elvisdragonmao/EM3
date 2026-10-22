import { defineMessages } from "@/i18n";

// Every phrase ends with the clock time when it has one, so deadlinePhrase can
// turn a trailing 23:59 into 24:00.

const zhWeek = ["日", "一", "二", "三", "四", "五", "六"];
const enWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const enShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const jaWeek = ["日", "月", "火", "水", "木", "金", "土"];
// The Japanese weekday elements: sun, moon, fire, water, wood, gold, earth.
const emojiWeek = ["🌞", "🌙", "🔥", "💧", "🌳", "🪙", "🪐"];

export const t = defineMessages({
	"zh-TW": {
		weekdays: zhWeek.map(w => `星期${w}`),
		shortWeekdays: zhWeek.map(w => `週${w}`),
		justNow: "剛剛",
		minutesAgo: (n: number) => `${n} 分鐘前`,
		todayAt: (time: string) => `今天 ${time}`,
		yesterday: (wd: string) => `昨天 ${wd}`,
		dayBeforeYesterday: (wd: string) => `前天 ${wd}`,
		lastWeek: (md: string, wd: string) => `${md} 上${wd}`,
		tomorrow: (wd: string, time: string) => `明天 ${wd} ${time}`,
		dayAfterTomorrow: (wd: string, time: string) => `後天 ${wd} ${time}`,
		thisWeek: (wd: string, time: string) => `${wd} ${time}`,
		nextWeek: (wd: string, md: string, time: string) => `下${wd} ${md} ${time}`,
		later: (md: string, swd: string, time: string) => `${md} ${swd} ${time}`,
		days: (n: number) => `${n} 天`,
		hours: (h: number, m: number) => `${h} 小時${m ? ` ${m} 分` : ""}`,
		minutes: (n: number) => `${n} 分鐘`,
		overdueBy: (span: string) => `已逾期 ${span}`,
		left: (span: string) => `剩 ${span}`,
		fullDateTime: (date: string, day: number, time: string) => `${date} 星期${zhWeek[day]} ${time}`,
		taipeiTime: "（台北時間）"
	},
	en: {
		weekdays: enWeek,
		shortWeekdays: enShort,
		justNow: "Just now",
		minutesAgo: (n: number) => `${n} min ago`,
		todayAt: (time: string) => `Today ${time}`,
		yesterday: () => "Yesterday",
		dayBeforeYesterday: (wd: string) => wd,
		lastWeek: (md: string, wd: string) => `Last ${wd}, ${md}`,
		tomorrow: (_wd: string, time: string) => `Tomorrow ${time}`,
		dayAfterTomorrow: (wd: string, time: string) => `${wd} ${time}`,
		thisWeek: (wd: string, time: string) => `${wd} ${time}`,
		nextWeek: (wd: string, md: string, time: string) => `Next ${wd}, ${md} ${time}`,
		later: (md: string, swd: string, time: string) => `${swd} ${md} ${time}`,
		days: (n: number) => `${n} ${n === 1 ? "day" : "days"}`,
		hours: (h: number, m: number) => `${h} h${m ? ` ${m} min` : ""}`,
		minutes: (n: number) => `${n} min`,
		overdueBy: (span: string) => `${span} overdue`,
		left: (span: string) => `${span} left`,
		fullDateTime: (date: string, day: number, time: string) => `${enShort[day]}, ${date} ${time}`,
		taipeiTime: " (Taipei time)"
	},
	ja: {
		weekdays: jaWeek.map(w => `${w}曜日`),
		shortWeekdays: jaWeek.map(w => `(${w})`),
		justNow: "たった今",
		minutesAgo: (n: number) => `${n} 分前`,
		todayAt: (time: string) => `今日 ${time}`,
		yesterday: (wd: string) => `昨日 ${wd}`,
		dayBeforeYesterday: (wd: string) => `一昨日 ${wd}`,
		lastWeek: (md: string, wd: string) => `${md} 先週の${wd}`,
		tomorrow: (wd: string, time: string) => `明日 ${wd} ${time}`,
		dayAfterTomorrow: (wd: string, time: string) => `明後日 ${wd} ${time}`,
		thisWeek: (wd: string, time: string) => `${wd} ${time}`,
		nextWeek: (wd: string, md: string, time: string) => `来週の${wd} ${md} ${time}`,
		later: (md: string, swd: string, time: string) => `${md}${swd} ${time}`,
		days: (n: number) => `${n} 日`,
		hours: (h: number, m: number) => `${h} 時間${m ? ` ${m} 分` : ""}`,
		minutes: (n: number) => `${n} 分`,
		overdueBy: (span: string) => `${span} 超過`,
		left: (span: string) => `残り ${span}`,
		fullDateTime: (date: string, day: number, time: string) => `${date}(${jaWeek[day]}) ${time}`,
		taipeiTime: "（台北時間）"
	},
	emoji: {
		weekdays: emojiWeek,
		shortWeekdays: emojiWeek,
		justNow: "⚡",
		minutesAgo: (n: number) => `⏪ ${n}⏲️`,
		todayAt: (time: string) => `📍 ${time}`,
		yesterday: (wd: string) => `⬅️ ${wd}`,
		dayBeforeYesterday: (wd: string) => `⏪ ${wd}`,
		lastWeek: (md: string, wd: string) => `${md} ⬅️🗓️${wd}`,
		tomorrow: (wd: string, time: string) => `➡️ ${wd} ${time}`,
		dayAfterTomorrow: (wd: string, time: string) => `⏩ ${wd} ${time}`,
		thisWeek: (wd: string, time: string) => `${wd} ${time}`,
		nextWeek: (wd: string, md: string, time: string) => `➡️🗓️${wd} ${md} ${time}`,
		later: (md: string, swd: string, time: string) => `${md} ${swd} ${time}`,
		days: (n: number) => `${n}📆`,
		hours: (h: number, m: number) => `${h}🕐${m ? ` ${m}⏲️` : ""}`,
		minutes: (n: number) => `${n}⏲️`,
		overdueBy: (span: string) => `🚨 ${span}`,
		left: (span: string) => `⏳ ${span}`,
		fullDateTime: (date: string, day: number, time: string) => `${date} ${emojiWeek[day]} ${time}`,
		taipeiTime: " 🇹🇼"
	}
});
