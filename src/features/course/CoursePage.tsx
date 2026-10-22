import type { CourseTab } from "@/app/router";
import { useTimetable } from "@/features/timetable/schedule";
import { useCourseIndex } from "@/features/courses/api";
import { AppearanceDialog } from "@/features/courses/AppearanceDialog";
import { altName, CourseGlyph, courseInk, readableOn, useCourseLook } from "@/features/courses/look";
import { classMoment, useNow } from "@/features/timetable/now";
import { periodByCode, slotBlocks } from "@/features/timetable/periods";
import { syllabusUrl } from "@/features/timetable/import";
import { tc } from "@/i18n/common";
import { e3Link } from "@/lib/moodle/files";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { ErrorNote, Lines } from "@/shared/ui/States";
import { ArrowSquareOutIcon, ChalkboardTeacherIcon, ChartBarIcon, FilesIcon, ListChecksIcon, MegaphoneIcon, PaintBrushIcon, ScrollIcon } from "@phosphor-icons/react";
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { motion } from "motion/react";
import { type KeyboardEvent, useState } from "react";
import { useHotkeys } from "@/shared/keyboard/hotkeys";
import { useIsTeaching } from "@/features/teaching/api";
import { TeachTab } from "@/features/teaching/TeachTab";
import { CourseAnnouncements } from "./CourseAnnouncements";
import { CourseTasks } from "./CourseTasks";
import { GradesTab } from "./GradesTab";
import { MaterialsTab } from "./MaterialsTab";
import { t as tr } from "./messages";

type TabLabel = "tabMaterials" | "tabAssignments" | "tabAnnouncements" | "tabGrades" | "tabTeach";

const TABS: { key: CourseTab; label: TabLabel; icon: typeof FilesIcon }[] = [
	{ key: "materials", label: "tabMaterials", icon: FilesIcon },
	{ key: "assignments", label: "tabAssignments", icon: ListChecksIcon },
	{ key: "announcements", label: "tabAnnouncements", icon: MegaphoneIcon },
	{ key: "grades", label: "tabGrades", icon: ChartBarIcon }
];
const TEACH_TAB = { key: "teach" as CourseTab, label: "tabTeach" as TabLabel, icon: ChalkboardTeacherIcon };

export function CoursePage() {
	const { courseId } = useParams({ from: "/app/courses/$courseId" });
	const search = useSearch({ from: "/app/courses/$courseId" });
	const navigate = useNavigate();
	const { byId, isPending, error } = useCourseIndex();
	const course = byId.get(Number(courseId));
	const look = useCourseLook(course);
	const timetable = useTimetable();
	const entry = timetable[courseId];
	const now = useNow();
	const [editing, setEditing] = useState(false);
	const teaching = useIsTeaching(Number(courseId));
	// Teachers land on 教學 by default; everyone else on 教材.
	const tab = search.tab ?? (teaching ? "teach" : "materials");
	const tabs = teaching ? [TEACH_TAB, ...TABS] : TABS;
	const goTab = (key: CourseTab) => navigate({ to: ".", search: { tab: key }, replace: true });
	const switchTab = (dir: number) => {
		const i = tabs.findIndex(t => t.key === tab);
		return goTab(tabs[(i + dir + tabs.length) % tabs.length].key);
	};
	// Roving focus per the ARIA tabs pattern: arrows move and activate, Home/End jump to the ends.
	const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
		const i = tabs.findIndex(t => t.key === tab);
		const to = ({ ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: tabs.length - 1 } as Record<string, number>)[e.key];
		if (to === undefined) return;
		e.preventDefault();
		const key = tabs[(to + tabs.length) % tabs.length].key;
		void goTab(key).then(() => document.getElementById(`tab-${key}`)?.focus());
	};
	const tabLabel = tabs.find(t => t.key === tab)?.label;
	useDocumentTitle(look ? (tabLabel ? `${tr(tabLabel)} · ${look.title}` : look.title) : undefined);
	useHotkeys([
		{ keys: "[", run: () => void switchTab(-1) },
		{ keys: "]", run: () => void switchTab(1) },
		{ keys: "e", run: () => setEditing(true) }
	]);

	if (error) return <ErrorNote error={error} />;
	if (isPending) return <Lines n={6} />;
	if (!course || !look) return <p className="py-20 text-center text-base-content/65">{tr("courseNotFound")}</p>;

	const live = classMoment(timetable, now).now?.courseId === course.id;
	const weekdays = tr("weekdays");
	const schedule = entry
		? tr(
				"schedule",
				slotBlocks(entry.slots).map(b => `${weekdays[b.day]} ${periodByCode(b.from)!.start}–${periodByCode(b.to)!.end}`),
				entry.room
			)
		: null;
	const syllabus = syllabusUrl(course);
	const alt = altName(course, look);
	const ink = courseInk(look.color);

	return (
		<div>
			<header className="relative mb-6">
				<div aria-hidden className="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full opacity-20 blur-3xl" style={{ backgroundColor: look.color }} />
				<div className="relative flex flex-wrap items-start gap-4">
					<button type="button" onClick={() => setEditing(true)} className="group relative rounded-2xl" aria-label={tr("customize")} aria-haspopup="dialog">
						<CourseGlyph look={look} size="lg" />
						<span className="absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full border hairline bg-base-100 opacity-0 shadow transition group-hover:opacity-100 group-focus-visible:opacity-100">
							<PaintBrushIcon size={13} />
						</span>
					</button>
					<div className="min-w-0 grow">
						<div className="flex flex-wrap items-center gap-2 text-xs text-base-content/65">
							{course.semester && <span className="badge badge-sm badge-ghost">{course.semester.shortLabel}</span>}
							{course.code && <span className="tabular-nums">{course.code}</span>}
							{live && (
								<span className="badge badge-sm border-0 font-medium" style={{ backgroundColor: look.color, color: readableOn(look.color) }}>
									{tr("live")}
								</span>
							)}
						</div>
						<h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl" lang={look.titleLang}>
							{look.title}
						</h1>
						{alt && (
							<p className="text-sm text-base-content/65" lang={alt.lang}>
								{alt.text}
							</p>
						)}
						<p className="mt-2 text-sm text-base-content/65">
							{schedule ?? (
								<Link to="/timetable" className="link link-hover">
									{tr("setSchedule")}
								</Link>
							)}
						</p>
					</div>
					<div className="flex gap-2">
						{syllabus && (
							<a className="btn btn-sm btn-ghost" href={syllabus} target="_blank" rel="noreferrer">
								<ScrollIcon size={16} />
								{tr("syllabus")}
								<span className="sr-only">{tc("openInNewTab")}</span>
							</a>
						)}
						<a className="btn btn-sm btn-ghost" href={e3Link(`/course/view.php?id=${course.id}`)} target="_blank" rel="noreferrer">
							<ArrowSquareOutIcon size={16} />
							{tr("moodle")}
							<span className="sr-only">{tc("openInNewTab")}</span>
						</a>
					</div>
				</div>
			</header>

			<div className="sticky top-[3.25rem] z-20 -mx-4 mb-6 border-b hairline bg-base-200/80 px-4 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border sm:bg-base-100/80 sm:px-1.5 sm:shadow-sm lg:top-3">
				<div role="tablist" aria-label={tr("tabsLabel")} className="relative flex gap-1 overflow-x-auto scrollbar-none" onKeyDown={onTabKey}>
					{tabs.map(t => {
						const active = tab === t.key;
						return (
							<button
								type="button"
								key={t.key}
								role="tab"
								id={`tab-${t.key}`}
								aria-selected={active}
								aria-controls={active ? `panel-${t.key}` : undefined}
								tabIndex={active ? 0 : -1}
								onClick={() => void goTab(t.key)}
								className={`relative flex items-center gap-1.5 px-3 py-3 text-sm whitespace-nowrap transition-colors ${active ? "font-medium text-base-content" : "text-base-content/65 hover:text-base-content"}`}
							>
								<t.icon size={17} weight={active ? "fill" : "regular"} style={active ? { color: ink } : undefined} />
								{tr(t.label)}
								{active && <motion.span layoutId="course-tab" className="absolute inset-x-3 bottom-0 h-0.5 rounded-full sm:bottom-1" style={{ backgroundColor: ink }} />}
							</button>
						);
					})}
				</div>
			</div>

			<motion.div key={tab} id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
				{tab === "materials" && <MaterialsTab course={course} />}
				{tab === "assignments" && <CourseTasks course={course} />}
				{tab === "announcements" && <CourseAnnouncements course={course} />}
				{tab === "grades" && <GradesTab course={course} />}
				{tab === "teach" && teaching && <TeachTab course={course} />}
			</motion.div>

			<AppearanceDialog course={course} open={editing} onClose={() => setEditing(false)} />
		</div>
	);
}
