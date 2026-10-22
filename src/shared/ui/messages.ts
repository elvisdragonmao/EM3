import { defineMessages } from "@/i18n";

export const t = defineMessages({
	"zh-TW": {
		language: "語言",
		system: "跟隨系統",
		// CommandPalette
		paletteLabel: "快速跳到課程或頁面",
		paletteSearch: "搜尋課程或頁面",
		palettePlaceholder: "搜尋課程、頁面…（中文、英文、課號都可以）",
		paletteResults: "搜尋結果",
		palettePage: "頁面",
		paletteNoMatch: (q: string) => `找不到「${q}」`,
		paletteCount: (n: number) => (n ? `${n} 個結果，用上下鍵選擇，Enter 開啟` : "沒有結果"),
		// LeaveToE3
		leaveKicker: "要在 Moodle 上完成",
		leaveGo: "前往 Moodle"
	},
	en: {
		language: "Language",
		system: "System default",
		paletteLabel: "Jump to a course or page",
		paletteSearch: "Search courses or pages",
		palettePlaceholder: "Search courses, pages… (Chinese, English or course code)",
		paletteResults: "Results",
		palettePage: "Page",
		paletteNoMatch: (q: string) => `No matches for “${q}”`,
		paletteCount: (n: number) => (n ? `${n} ${n === 1 ? "result" : "results"}. Use the up and down arrows to choose, Enter to open.` : "No results"),
		leaveKicker: "To be done on Moodle",
		leaveGo: "Go to Moodle"
	},
	ja: {
		language: "言語",
		system: "システムに合わせる",
		paletteLabel: "コースやページへ移動",
		paletteSearch: "コースやページを検索",
		palettePlaceholder: "コース・ページを検索…（中国語・英語・科目コード可）",
		paletteResults: "検索結果",
		palettePage: "ページ",
		paletteNoMatch: (q: string) => `「${q}」は見つかりません`,
		paletteCount: (n: number) => (n ? `${n} 件の結果。上下キーで選択、Enter で開きます` : "結果なし"),
		leaveKicker: "Moodle で行う操作です",
		leaveGo: "Moodle へ移動"
	},
	emoji: {
		language: "🌐",
		system: "🖥️",
		paletteLabel: "🚀📚📄",
		paletteSearch: "🔍📚📄",
		palettePlaceholder: "🔍 📚 📄 …",
		paletteResults: "🔍📋",
		palettePage: "📄",
		paletteNoMatch: (q: string) => `🔍🤷 ${q}`,
		paletteCount: (n: number) => (n ? `🔍 ${n} · ⬆️⬇️ · ↩️` : "🔍🤷"),
		leaveKicker: "🎓👉",
		leaveGo: "🎓↗️"
	}
});
