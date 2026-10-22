import type { CourseTab } from "@/app/router";
import { useTimetable } from "@/features/timetable/schedule";
import { useCourseIndex } from "@/features/courses/api";
import { AppearanceDialog } from "@/features/courses/AppearanceDialog";
import { CourseGlyph, useCourseLook } from "@/features/courses/look";
import { classMoment, useNow } from "@/features/timetable/now";
import { DAY_LABELS, periodByCode, slotBlocks } from "@/features/timetable/periods";
import { syllabusUrl } from "@/features/timetable/import";
import { e3Link } from "@/lib/moodle/files";
import { ErrorNote, Lines } from "@/shared/ui/States";
import { ArrowSquareOutIcon, ChalkboardTeacherIcon, ChartBarIcon, FilesIcon, ListChecksIcon, MegaphoneIcon, PaintBrushIcon, ScrollIcon } from "@phosphor-icons/react";
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useState } from "react";
import { useHotkeys } from "@/shared/keyboard/hotkeys";
import { useIsTeaching } from "@/features/teaching/api";
import { TeachTab } from "@/features/teaching/TeachTab";
import { CourseAnnouncements } from "./CourseAnnouncements";
import { CourseTasks } from "./CourseTasks";
import { GradesTab } from "./GradesTab";
import { MaterialsTab } from "./MaterialsTab";

const TABS: { key: CourseTab; label: string; icon: typeof FilesIcon }[] = [
	{ key: "materials", label: "教材", icon: FilesIcon },
	{ key: "assignments", label: "作業", icon: ListChecksIcon },
	{ key: "announcements", label: "公告", icon: MegaphoneIcon },
	{ key: "grades", label: "成績", icon: ChartBarIcon }
];
const TEACH_TAB = { key: "teach" as CourseTab, label: "教學", icon: ChalkboardTeacherIcon };

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
	const switchTab = (dir: number) => {
		const i = tabs.findIndex(t => t.key === tab);
		void navigate({ to: ".", search: { tab: tabs[(i + dir + tabs.length) % tabs.length].key }, replace: true });
	};
	useHotkeys([
		{ keys: "[", run: () => switchTab(-1) },
		{ keys: "]", run: () => switchTab(1) },
		{ keys: "e", run: () => setEditing(true) }
	]);

	if (error) return <ErrorNote error={error} />;
	if (isPending) return <Lines n={6} />;
	if (!course || !look) return <p className="py-20 text-center text-base-content/60">找不到這門課，可能已經退選或不在你的課程列表中。</p>;

	const live = classMoment(timetable, now).now?.courseId === course.id;
	const schedule = entry
		? slotBlocks(entry.slots)
				.map(b => `週${DAY_LABELS[b.day]} ${periodByCode(b.from)!.start}–${periodByCode(b.to)!.end}`)
				.join("、") + (entry.room ? ` · ${entry.room}` : "")
		: null;
	const syllabus = syllabusUrl(course);

	return (
		<div>
			<header className="relative mb-6">
				<div aria-hidden className="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full opacity-20 blur-3xl" style={{ backgroundColor: look.color }} />
				<div className="relative flex flex-wrap items-start gap-4">
					<button onClick={() => setEditing(true)} className="group relative" aria-label="自訂顏色與圖示">
						<CourseGlyph look={look} size="lg" />
						<span className="absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full border hairline bg-base-100 opacity-0 shadow transition group-hover:opacity-100 group-focus-visible:opacity-100">
							<PaintBrushIcon size={13} />
						</span>
					</button>
					<div className="min-w-0 grow">
						<div className="flex flex-wrap items-center gap-2 text-xs text-base-content/55">
							{course.semester && <span className="badge badge-sm badge-ghost">{course.semester.shortLabel}</span>}
							{course.code && <span className="tabular-nums">{course.code}</span>}
							{live && (
								<span className="badge badge-sm border-0 font-medium text-white" style={{ backgroundColor: look.color }}>
									上課中
								</span>
							)}
						</div>
						<h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{look.title}</h1>
						{(course.nameEn || look.title !== course.name) && <p className="text-sm text-base-content/55">{look.title !== course.name ? course.name : course.nameEn}</p>}
						<p className="mt-2 text-sm text-base-content/65">
							{schedule ?? (
								<Link to="/timetable" className="link link-hover">
									設定上課時間
								</Link>
							)}
						</p>
					</div>
					<div className="flex gap-2">
						{syllabus && (
							<a className="btn btn-sm btn-ghost" href={syllabus} target="_blank" rel="noreferrer">
								<ScrollIcon size={16} />
								課綱
							</a>
						)}
						<a className="btn btn-sm btn-ghost" href={e3Link(`/course/view.php?id=${course.id}`)} target="_blank" rel="noreferrer">
							<ArrowSquareOutIcon size={16} />
							Moodle
						</a>
					</div>
				</div>
			</header>

			<nav
				className="sticky top-[3.25rem] z-20 -mx-4 mb-6 border-b hairline bg-base-200/80 px-4 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border sm:bg-base-100/80 sm:px-1.5 sm:shadow-sm lg:top-3"
				aria-label="課程分頁"
			>
				<div
					role="tablist"
					className="flex gap-1 overflow-x-auto scrollbar-none"
					onKeyDown={e => {
						const dir = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
						if (!dir) return;
						e.preventDefault();
						const list = e.currentTarget;
						switchTab(dir);
						requestAnimationFrame(() => list.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
					}}
				>
					{tabs.map(t => {
						const active = tab === t.key;
						return (
							<button
								key={t.key}
								role="tab"
								id={`tab-${t.key}`}
								aria-selected={active}
								aria-controls="course-panel"
								tabIndex={active ? 0 : -1}
								onClick={() => navigate({ to: ".", search: { tab: t.key }, replace: true })}
								className={`relative flex items-center gap-1.5 px-3 py-3 text-sm whitespace-nowrap transition-colors ${active ? "font-medium text-base-content" : "text-base-content/55 hover:text-base-content"}`}
							>
								<t.icon size={17} weight={active ? "fill" : "regular"} style={active ? { color: look.color } : undefined} />
								{t.label}
								{active && <motion.span layoutId="course-tab" className="absolute inset-x-3 bottom-0 h-0.5 rounded-full sm:bottom-1" style={{ backgroundColor: look.color }} />}
							</button>
						);
					})}
				</div>
			</nav>

			<motion.div key={tab} id="course-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
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
