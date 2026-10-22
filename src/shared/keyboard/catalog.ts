import { visibleNav } from "@/app/nav";
import { t } from "./messages";

export interface ShortcutGroup {
	title: string;
	items: { keys: string[][]; label: string }[];
}

/**
 * What the ⌘/ dialog lists. Keys are shown as written; "mod" renders as ⌘ or Ctrl.
 * A function, not a constant, so the labels follow the active language.
 */
export function shortcutGroups(): ShortcutGroup[] {
	return [
		{
			title: t("groupGlobal"),
			items: [
				{ keys: [["mod", "K"], ["/"]], label: t("jump") },
				{ keys: [["mod", "/"], ["?"]], label: t("showList") },
				{ keys: [["Esc"]], label: t("escape") }
			]
		},
		{
			title: t("groupPages"),
			items: visibleNav().map((n, i) => ({ keys: [[String(i + 1)]], label: n.label }))
		},
		{
			title: t("groupList"),
			items: [
				{ keys: [["J"], ["K"]], label: t("nextPrev") },
				{ keys: [["Enter"]], label: t("openSelected") },
				{ keys: [["F"]], label: t("searchPage") },
				{ keys: [["Tab"]], label: t("tab") }
			]
		},
		{
			title: t("groupCalendar"),
			items: [
				{ keys: [["←"], ["→"]], label: t("prevNextRange") },
				{ keys: [["T"]], label: t("today") },
				{ keys: [["V"]], label: t("view") },
				{ keys: [["↑"], ["↓"], ["←"], ["→"]], label: t("calendarArrows") }
			]
		},
		{
			title: t("groupCourse"),
			items: [
				{ keys: [["["], ["]"]], label: t("courseTabs") },
				{ keys: [["E"]], label: t("courseLook") }
			]
		},
		{
			title: t("groupAssignment"),
			items: [
				{ keys: [["U"]], label: t("upload") },
				{ keys: [["mod", "Enter"]], label: t("submit") }
			]
		},
		{
			title: t("groupTimetable"),
			items: [
				{ keys: [["↑"], ["↓"], ["←"], ["→"]], label: t("timetableArrows") },
				{ keys: [["Enter"]], label: t("paint") }
			]
		}
	];
}
