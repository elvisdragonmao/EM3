import { BooksIcon, CalendarDotsIcon, EnvelopeSimpleIcon, GearSixIcon, HouseIcon, ListChecksIcon, MegaphoneIcon, TableIcon } from "@phosphor-icons/react";

import { mailSupported } from "@/features/mail/api";

export const NAV = [
	{ to: "/", label: "今天", icon: HouseIcon },
	{ to: "/tasks", label: "待辦", icon: ListChecksIcon },
	{ to: "/calendar", label: "行事曆", icon: CalendarDotsIcon },
	{ to: "/announcements", label: "公告", icon: MegaphoneIcon },
	{ to: "/mail", label: "信件", icon: EnvelopeSimpleIcon },
	{ to: "/courses", label: "課程", icon: BooksIcon },
	{ to: "/timetable", label: "課表", icon: TableIcon },
	{ to: "/settings", label: "設定", icon: GearSixIcon }
] as const;

/** NAV without the pages the current school cannot serve; shortcut numbers follow this order. */
export const visibleNav = () => NAV.filter(n => n.to !== "/mail" || mailSupported());
