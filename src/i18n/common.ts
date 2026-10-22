import { defineMessages } from ".";

/** Words shared across many features. Feature-specific strings live next to each feature. */
export const tc = defineMessages({
	"zh-TW": {
		appName: "EM3",
		retry: "重試",
		cancel: "取消",
		close: "關閉",
		confirm: "確定",
		save: "儲存",
		download: "下載",
		loading: "載入中…",
		error: "發生錯誤",
		moodleError: (msg: string) => `無法從 Moodle 取得資料：${msg}`,
		openInNewTab: "（另開新分頁）",
		copied: "已複製",
		copy: "複製"
	},
	en: {
		appName: "EM3",
		retry: "Retry",
		cancel: "Cancel",
		close: "Close",
		confirm: "OK",
		save: "Save",
		download: "Download",
		loading: "Loading…",
		error: "Something went wrong",
		moodleError: (msg: string) => `Couldn't load data from Moodle: ${msg}`,
		openInNewTab: " (opens in a new tab)",
		copied: "Copied",
		copy: "Copy"
	},
	ja: {
		appName: "EM3",
		retry: "再試行",
		cancel: "キャンセル",
		close: "閉じる",
		confirm: "OK",
		save: "保存",
		download: "ダウンロード",
		loading: "読み込み中…",
		error: "エラーが発生しました",
		moodleError: (msg: string) => `Moodle からデータを取得できませんでした：${msg}`,
		openInNewTab: "（新しいタブで開きます）",
		copied: "コピーしました",
		copy: "コピー"
	},
	emoji: {
		appName: "EM3",
		retry: "🔁",
		cancel: "✖️",
		close: "❌",
		confirm: "✅",
		save: "💾",
		download: "⬇️",
		loading: "⏳",
		error: "💥",
		moodleError: (msg: string) => `🎓❌ ${msg}`,
		openInNewTab: " ↗️",
		copied: "📋✅",
		copy: "📋"
	}
});
