import { visibleNav } from "@/app/nav";

export interface ShortcutGroup {
	title: string;
	items: { keys: string[][]; label: string }[];
}

/** What the ⌘/ dialog lists. Keys are shown as written; "mod" renders as ⌘ or Ctrl. */
export const shortcutGroups = (): ShortcutGroup[] => [
	{
		title: "全域",
		items: [
			{ keys: [["mod", "K"], ["/"]], label: "快速跳到課程或頁面" },
			{ keys: [["mod", "/"], ["?"]], label: "顯示這份快捷鍵列表" },
			{ keys: [["Esc"]], label: "關閉視窗、預覽或選單" }
		]
	},
	{
		title: "頁面",
		items: visibleNav().map((n, i) => ({ keys: [[String(i + 1)]], label: n.label }))
	},
	{
		title: "列表",
		items: [
			{ keys: [["J"], ["K"]], label: "下一項 / 上一項" },
			{ keys: [["Enter"]], label: "打開選取的項目" },
			{ keys: [["F"]], label: "搜尋這一頁" },
			{ keys: [["Tab"]], label: "依序移動到下一個按鈕或連結" }
		]
	},
	{
		title: "行事曆",
		items: [
			{ keys: [["←"], ["→"]], label: "上一段 / 下一段時間" },
			{ keys: [["T"]], label: "回到今天" },
			{ keys: [["V"]], label: "切換 週 / 兩週 / 月" },
			{ keys: [["↑"], ["↓"], ["←"], ["→"]], label: "在日期格之間移動（焦點在日曆裡時）" }
		]
	},
	{
		title: "課程頁",
		items: [
			{ keys: [["["], ["]"]], label: "上一個 / 下一個分頁（教材、作業、公告、成績）" },
			{ keys: [["E"]], label: "自訂這門課的顏色、圖示、簡稱" }
		]
	},
	{
		title: "作業",
		items: [
			{ keys: [["U"]], label: "選擇要上傳的檔案" },
			{ keys: [["mod", "Enter"]], label: "繳交（會先跳出確認）" }
		]
	},
	{
		title: "課表",
		items: [
			{ keys: [["↑"], ["↓"], ["←"], ["→"]], label: "在節次格子之間移動" },
			{ keys: [["Enter"]], label: "用目前的畫筆填入或清除格子" }
		]
	}
];
