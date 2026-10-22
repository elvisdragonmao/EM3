import { BooksIcon, CalendarDotsIcon, EnvelopeSimpleIcon, GearSixIcon, HouseIcon, ListChecksIcon, MegaphoneIcon, TableIcon } from "@phosphor-icons/react";
import { mailSupported } from "@/features/mail/api";
import { t } from "./messages";

const ITEMS = [
	["/", "navToday", HouseIcon],
	["/tasks", "navTasks", ListChecksIcon],
	["/calendar", "navCalendar", CalendarDotsIcon],
	["/announcements", "navAnnouncements", MegaphoneIcon],
	["/mail", "navMail", EnvelopeSimpleIcon],
	["/courses", "navCourses", BooksIcon],
	["/timetable", "navTimetable", TableIcon],
	["/settings", "navSettings", GearSixIcon]
] as const;

// The label is a getter so it always reads the active language.
export const NAV = ITEMS.map(([to, key, icon]) => ({
	to,
	icon,
	get label() {
		return t(key);
	}
}));

/** NAV without the pages the current school cannot serve; shortcut numbers follow this order. */
export const visibleNav = () => NAV.filter(n => n.to !== "/mail" || mailSupported());
