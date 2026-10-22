import { defineMessages } from "@/i18n";

export const t = defineMessages({
	"zh-TW": {
		notSettingsFile: "這不是 EM3 的設定檔",
		snippets: ["做得很好！", "請補上執行結果的截圖。", "格式請依照作業說明。", "遲交，依規定扣分。"]
	},
	en: {
		notSettingsFile: "This isn't an EM3 settings file",
		snippets: ["Great work!", "Please add a screenshot of the output.", "Please follow the format in the assignment instructions.", "Late submission; points deducted per the policy."]
	},
	ja: {
		notSettingsFile: "EM3 の設定ファイルではありません",
		snippets: ["よくできました！", "実行結果のスクリーンショットを追加してください。", "課題の説明どおりの形式にしてください。", "提出遅れのため、規定により減点します。"]
	},
	emoji: {
		notSettingsFile: "📄❌⚙️",
		snippets: ["👏💯", "📸➕🖥️", "📋👉📐", "⏰🐢➖💯"]
	}
});
