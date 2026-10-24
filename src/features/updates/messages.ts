import { defineMessages } from "@/i18n";

// Release notes themselves are Markdown in notes/; emoji mode shows them in the system language.

export const t = defineMessages({
	"zh-TW": {
		title: "更新紀錄",
		intro: "EM3 每一版的新功能、改進與修正。",
		currentVersion: (v: string) => `你正在使用 v${v}。`,
		githubReleases: "在 GitHub 上看所有版本",
		latest: "最新",
		released: (date: string) => `${date} 發布`,
		loadFailed: "更新說明載入失敗。",
		whatsNewTitle: "EM3 有什麼新的",
		whatsNewIntro: (n: number) => (n > 1 ? `你上次打開之後，EM3 更新了 ${n} 個版本。` : "這一版的新功能、改進與修正。"),
		seeAll: "看完整更新紀錄",
		gotIt: "知道了",
		openEm3: "打開 EM3",
		signIn: "登入",
		home: "EM3 首頁"
	},
	en: {
		title: "Changelog",
		intro: "New features, improvements and fixes in every EM3 release.",
		currentVersion: (v: string) => `You're using v${v}.`,
		githubReleases: "See all releases on GitHub",
		latest: "Latest",
		released: (date: string) => `Released ${date}`,
		loadFailed: "Couldn't load the release notes.",
		whatsNewTitle: "What's new in EM3",
		whatsNewIntro: (n: number) => (n > 1 ? `EM3 has had ${n} releases since you last opened it.` : "New features, improvements and fixes in this release."),
		seeAll: "See the full changelog",
		gotIt: "Got it",
		openEm3: "Open EM3",
		signIn: "Sign in",
		home: "EM3 home"
	},
	ja: {
		title: "更新履歴",
		intro: "EM3 の各バージョンの新機能・改善・修正です。",
		currentVersion: (v: string) => `現在のバージョンは v${v} です。`,
		githubReleases: "GitHub ですべてのリリースを見る",
		latest: "最新",
		released: (date: string) => `${date} リリース`,
		loadFailed: "リリースノートを読み込めませんでした。",
		whatsNewTitle: "EM3 の新機能",
		whatsNewIntro: (n: number) => (n > 1 ? `前回開いてから、EM3 は ${n} 回アップデートされました。` : "このバージョンの新機能・改善・修正です。"),
		seeAll: "更新履歴をすべて見る",
		gotIt: "OK",
		openEm3: "EM3 を開く",
		signIn: "ログイン",
		home: "EM3 ホーム"
	},
	emoji: {
		title: "📜🆕",
		intro: "🆕 · ✨ · 🐛🔧",
		currentVersion: (v: string) => `👉 v${v}`,
		githubReleases: "🐙📜",
		latest: "🆕",
		released: (date: string) => `🚀 ${date}`,
		loadFailed: "📜❌",
		whatsNewTitle: "🎉🆕",
		whatsNewIntro: (n: number) => (n > 1 ? `🆕 × ${n}` : "🆕 · ✨ · 🐛🔧"),
		seeAll: "📜👀",
		gotIt: "👌",
		openEm3: "🚀",
		signIn: "🔑",
		home: "🏠"
	}
});
