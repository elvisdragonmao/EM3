import { defineMessages, plural } from "@/i18n";
import { weekdayName } from "@/lib/time/relative";
import type { ReactNode } from "react";

/** Hour of day → greeting bucket: late night, morning, noon, afternoon, evening. */
const bucket = (h: number) => (h < 5 ? 0 : h < 11 ? 1 : h < 14 ? 2 : h < 18 ? 3 : 4);

export const t = defineMessages({
	"zh-TW": {
		docTitle: "首頁",
		today: (d: Date) => `${d.getMonth() + 1} 月 ${d.getDate()} 日 · ${weekdayName(d)}`,
		greeting: (h: number, name: string) => `${["夜深了", "早安", "午安", "下午好", "晚安"][bucket(h)]}${name ? `，${name}` : ""}`,
		summaryLoading: "正在整理你這週的進度…",
		summaryFree: "這週沒有要交的東西，好好休息。",
		summary: (due: number, overdue: number) => [due ? `接下來 7 天有 ${due} 份要交` : "", overdue ? `${overdue} 份已逾期但還能補交` : ""].filter(Boolean).join("，") + "。",
		nextUp: (link: ReactNode, when: string) => (
			<>
				最近的是 {link}（{when}）。
			</>
		),
		courseTask: (course: string, task: string) => `${course}・${task}`,
		setupTimetable: "設定課表，讓 EM3 知道你現在在上哪堂課",
		setupTimetableDesc: "上課時，那堂課的教材、課堂練習會直接出現在這裡。",
		inClass: (min: number) => `上課中 · 還有 ${min} 分鐘下課`,
		nextClass: (min: number) => `下一堂 · ${min >= 60 ? `${Math.floor(min / 60)} 小時 ${min % 60} 分` : `${min} 分鐘`}後`,
		materials: "教材",
		assignments: "作業",
		announcements: "公告",
		courseShortcuts: (course: string) => `${course} 的捷徑`,
		inClassTasks: "課堂練習",
		attempt: "作答",
		submit: "繳交",
		dueSoon: "即將截止",
		allTasks: "全部待辦",
		groupOverdue: "逾期・還能補交",
		groupToday: "今天",
		groupTomorrow: "明天",
		groupLater: "之後",
		groupNoDue: "沒有截止日",
		allDone: "全部都交了",
		allDoneDesc: "沒有待繳交的作業或測驗。",
		latestAnnouncements: "最新公告",
		allAnnouncements: "全部公告",
		noAnnouncements: "還沒有公告",
		unread: "未讀",
		recentMaterials: "最近更新的教材",
		noMaterials: "這學期還沒有教材",
		showMore: "顯示更多"
	},
	en: {
		docTitle: "Home",
		today: (d: Date) => `${weekdayName(d)}, ${d.toLocaleDateString("en", { month: "long", day: "numeric" })}`,
		greeting: (h: number, name: string) => `${["Up late", "Good morning", "Good afternoon", "Good afternoon", "Good evening"][bucket(h)]}${name ? `, ${name}` : ""}`,
		summaryLoading: "Catching up on your week…",
		summaryFree: "Nothing due this week. Take a break.",
		summary: (due: number, overdue: number) => {
			const late = `${plural(overdue, "task")} overdue that you can still turn in`;
			if (due && overdue) return `You have ${plural(due, "task")} due in the next 7 days, plus ${late}.`;
			if (due) return `You have ${plural(due, "task")} due in the next 7 days.`;
			return `You have ${late}.`;
		},
		nextUp: (link: ReactNode, when: string) => (
			<>
				Next up: {link} ({when}).
			</>
		),
		courseTask: (course: string, task: string) => `${course} · ${task}`,
		setupTimetable: "Set up your timetable so EM3 knows which class you're in",
		setupTimetableDesc: "During class, that course's materials and in-class exercises show up right here.",
		inClass: (min: number) => `In class · ends in ${min} min`,
		nextClass: (min: number) => `Next class · in ${min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`}`,
		materials: "Materials",
		assignments: "Assignments",
		announcements: "Announcements",
		courseShortcuts: (course: string) => `${course} shortcuts`,
		inClassTasks: "In-class exercises",
		attempt: "Attempt",
		submit: "Submit",
		dueSoon: "Due soon",
		allTasks: "All tasks",
		groupOverdue: "Overdue · late submission open",
		groupToday: "Today",
		groupTomorrow: "Tomorrow",
		groupLater: "Later",
		groupNoDue: "No due date",
		allDone: "All caught up",
		allDoneDesc: "No assignments or quizzes left to submit.",
		latestAnnouncements: "Latest announcements",
		allAnnouncements: "All announcements",
		noAnnouncements: "No announcements yet",
		unread: "Unread",
		recentMaterials: "Recently updated materials",
		noMaterials: "No materials this semester yet",
		showMore: "Show more"
	},
	ja: {
		docTitle: "ホーム",
		today: (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日 · ${weekdayName(d)}`,
		greeting: (h: number, name: string) => `${["夜遅くまでお疲れさまです", "おはようございます", "こんにちは", "こんにちは", "こんばんは"][bucket(h)]}${name ? `、${name}さん` : ""}`,
		summaryLoading: "今週の予定をまとめています…",
		summaryFree: "今週は提出物がありません。ゆっくり休みましょう。",
		summary: (due: number, overdue: number) =>
			[due ? `今後 7 日間の締め切りが ${due} 件` : "", overdue ? `期限切れでもまだ提出できるものが ${overdue} 件` : ""].filter(Boolean).join("、") + "あります。",
		nextUp: (link: ReactNode, when: string) => (
			<>
				直近は {link}（{when}）です。
			</>
		),
		courseTask: (course: string, task: string) => `${course}・${task}`,
		setupTimetable: "時間割を設定すると、今どの授業中かを EM3 が把握できます",
		setupTimetableDesc: "授業中は、その授業の教材や授業内課題がここに表示されます。",
		inClass: (min: number) => `授業中 · 終了まであと ${min} 分`,
		nextClass: (min: number) => `次の授業 · ${min >= 60 ? `${Math.floor(min / 60)} 時間 ${min % 60} 分` : `${min} 分`}後`,
		materials: "教材",
		assignments: "課題",
		announcements: "お知らせ",
		courseShortcuts: (course: string) => `${course} のショートカット`,
		inClassTasks: "授業内課題",
		attempt: "受験",
		submit: "提出",
		dueSoon: "締め切り間近",
		allTasks: "すべての課題",
		groupOverdue: "期限切れ・遅延提出可",
		groupToday: "今日",
		groupTomorrow: "明日",
		groupLater: "それ以降",
		groupNoDue: "締め切りなし",
		allDone: "すべて提出済みです",
		allDoneDesc: "未提出の課題や小テストはありません。",
		latestAnnouncements: "最新のお知らせ",
		allAnnouncements: "すべてのお知らせ",
		noAnnouncements: "お知らせはまだありません",
		unread: "未読",
		recentMaterials: "最近更新された教材",
		noMaterials: "今学期の教材はまだありません",
		showMore: "もっと見る"
	},
	emoji: {
		docTitle: "🏠",
		today: (d: Date) => `📅 ${d.getMonth() + 1}/${d.getDate()} · ${weekdayName(d)}`,
		greeting: (h: number, name: string) => `${["🦉🌌", "🌅☕", "☀️🍱", "🌤️👋", "🌙✨"][bucket(h)]}${name ? ` ${name}` : ""}`,
		summaryLoading: "⏳📅",
		summaryFree: "📭🎉😴",
		summary: (due: number, overdue: number) => [due ? `📅7️⃣ → 📝×${due}` : "", overdue ? `🚨📝×${overdue} ⏳📤` : ""].filter(Boolean).join(" · "),
		nextUp: (link: ReactNode, when: string) => (
			<>
				👉 {link} (⏰ {when})
			</>
		),
		courseTask: (course: string, task: string) => `${course} · ${task}`,
		setupTimetable: "🗓️✏️ → 🎓📍",
		setupTimetableDesc: "🎓⏰ → 📚📝👇",
		inClass: (min: number) => `🔴🎓 · ⏳ ${min}′`,
		nextClass: (min: number) => `⏭️🎓 · ⏳ ${min}′`,
		materials: "📚",
		assignments: "📝",
		announcements: "📢",
		courseShortcuts: (course: string) => `${course} 🔗`,
		inClassTasks: "🎓📝",
		attempt: "✍️",
		submit: "📤",
		dueSoon: "⏰🔜",
		allTasks: "📋",
		groupOverdue: "🚨⏳📤",
		groupToday: "📍",
		groupTomorrow: "🌅",
		groupLater: "🔮",
		groupNoDue: "♾️",
		allDone: "🎉✅",
		allDoneDesc: "📝✅🧪✅",
		latestAnnouncements: "📢🆕",
		allAnnouncements: "📢📋",
		noAnnouncements: "📢🤷",
		unread: "🆕",
		recentMaterials: "📚🆕",
		noMaterials: "📚🤷",
		showMore: "➕"
	}
});
