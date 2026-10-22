import { type Announcement, cleanAuthor, postTime, useAnnouncements } from "@/features/announcements/api";
import { useTimetable } from "@/features/timetable/schedule";
import { TASK_STATE_LABEL } from "@/features/assignments/api";
import { isOpenTask, type Task, useActiveCourses, useTasks } from "@/features/assignments/tasks";
import { CalendarBoard, TaskAnchor, TaskLine } from "@/features/calendar/Board";
import { useSiteInfo } from "@/features/courses/api";
import { CourseGlyph, courseText, resolveLook, useCourseLook } from "@/features/courses/look";
import type { ParsedCourse } from "@/features/courses/parse";
import { usePrefs } from "@/features/preferences/store";
import { blockTime, classMoment, useNow } from "@/features/timetable/now";
import { htmlToText } from "@/lib/moodle/files";
import { countdown, deadlineDay, deadlinePhrase, startOfDay } from "@/lib/time/relative";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { Ago } from "@/shared/ui/Time";
import { CourseTag } from "@/shared/ui/CourseTag";
import { Empty, ErrorNote, Lines, SectionTitle } from "@/shared/ui/States";
import { ArrowRightIcon, BellSimpleIcon, ChalkboardTeacherIcon, ConfettiIcon, FilesIcon, ListChecksIcon, MegaphoneIcon, TableIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { RecentMaterials } from "./RecentMaterials";
import { GradingQueue } from "@/features/teaching/GradingQueue";
import { t } from "./messages";

const stagger = { animate: { transition: { staggerChildren: 0.05 } } };
const rise = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };

export function DashboardPage() {
	const { active, isPending: coursesPending, error: coursesError } = useActiveCourses();
	const { tasks, isPending, error, refetch } = useTasks();
	const announcements = useAnnouncements(
		active.map(c => c.id),
		{ perForum: 6 }
	);

	useDocumentTitle(t("docTitle"));

	if (coursesError) return <ErrorNote error={coursesError} />;

	return (
		<motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6 lg:space-y-8">
			<motion.div variants={rise}>
				<Greeting tasks={tasks} loading={isPending} />
			</motion.div>
			<motion.div variants={rise}>
				<NowCard courses={active} tasks={tasks} />
			</motion.div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
				<div className="space-y-6 lg:col-span-8 lg:space-y-8">
					<motion.div variants={rise}>{error ? <ErrorNote error={error} retry={refetch} /> : <CalendarBoard tasks={tasks} />}</motion.div>
					<motion.div variants={rise}>
						<RecentMaterials courses={active} />
					</motion.div>
				</div>
				<div className="space-y-6 lg:col-span-4 lg:space-y-8">
					{/* Renders nothing for students; hide the empty box so it does not push the column down. */}
					<motion.div variants={rise} className="empty:hidden">
						<GradingQueue />
					</motion.div>
					<motion.div variants={rise}>
						<DueSoon tasks={tasks} loading={isPending || coursesPending} />
					</motion.div>
					<motion.div variants={rise}>
						<LatestAnnouncements items={announcements.data} loading={announcements.isPending} byId={new Map(active.map(c => [c.id, c]))} />
					</motion.div>
				</div>
			</div>
		</motion.div>
	);
}

function Greeting({ tasks, loading }: { tasks: Task[]; loading: boolean }) {
	const { data: me } = useSiteInfo();
	const nickname = usePrefs(s => s.nickname.trim());
	const now = useNow(60_000);
	const open = tasks.filter(isOpenTask);
	const weekEnd = startOfDay(new Date(now.getTime() + 7 * 86400_000)).getTime() / 1000;
	const thisWeek = open.filter(x => x.due && x.due < weekEnd);
	const overdue = open.filter(x => x.state === "late");
	const next = open.find(x => x.state === "todo");

	let summary = t("summaryFree");
	if (loading) summary = t("summaryLoading");
	else if (thisWeek.length || overdue.length) summary = t("summary", thisWeek.length, overdue.length);

	return (
		<section className="pt-2">
			<p className="text-sm font-medium text-base-content/65">{t("today", now)}</p>
			<h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{t("greeting", now.getHours(), nickname || me?.firstname || "")}</h1>
			<p className="mt-2 max-w-2xl text-base text-base-content/65">
				{summary}
				{next && !loading && (
					<>
						{" "}
						{t(
							"nextUp",
							<TaskAnchor t={next} className="font-medium text-base-content underline decoration-base-content/20 underline-offset-4 hover:decoration-base-content">
								{t("courseTask", resolveLook(next.course).title, next.name)}
							</TaskAnchor>,
							deadlinePhrase(next.due)
						)}
					</>
				)}
			</p>
		</section>
	);
}

/** The class happening now (or next), with its materials, live exercises and announcements one tap away. */
function NowCard({ courses, tasks }: { courses: ParsedCourse[]; tasks: Task[] }) {
	const timetable = useTimetable();
	const now = useNow();
	const moment = classMoment(timetable, now);
	const block = moment.now ?? moment.next;
	const course = block ? courses.find(c => c.id === block.courseId) : undefined;
	const look = useCourseLook(course);
	const hasTimetable = Object.keys(timetable).length > 0;

	if (!hasTimetable) {
		return (
			<Link to="/timetable" className="card-quiet group flex items-center gap-4 p-4 transition hover:-translate-y-0.5 sm:p-5">
				<span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
					<TableIcon size={22} weight="duotone" />
				</span>
				<div className="min-w-0 grow">
					<p className="font-medium">{t("setupTimetable")}</p>
					<p className="text-sm text-base-content/65">{t("setupTimetableDesc")}</p>
				</div>
				<ArrowRightIcon size={18} className="text-base-content/65 transition group-hover:translate-x-1" />
			</Link>
		);
	}
	if (!block || !course || !look) return null;

	const live = !!moment.now;
	const exercises = tasks.filter(x => x.course.id === course.id && isOpenTask(x) && (x.inClass || (x.due && x.due * 1000 - now.getTime() < 6 * 3600_000)));
	const tabs = [
		{ tab: "materials", label: t("materials"), icon: FilesIcon },
		{ tab: "assignments", label: t("assignments"), icon: ListChecksIcon },
		{ tab: "announcements", label: t("announcements"), icon: MegaphoneIcon }
	] as const;
	// Course colours can be light; mix with the text colour so the label keeps 4.5:1.
	const ink = courseText(look.color);

	return (
		<section
			className="relative overflow-hidden rounded-[1.5rem] border hairline p-5 sm:p-6"
			style={{ background: `linear-gradient(135deg, color-mix(in oklab, ${look.color} 16%, var(--color-base-100)), var(--color-base-100) 70%)` }}
		>
			<div aria-hidden className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full opacity-30 blur-3xl" style={{ backgroundColor: look.color }} />
			<div className="relative flex flex-col gap-5 md:flex-row md:items-center">
				<Link to="/courses/$courseId" params={{ courseId: String(course.id) }} className="flex min-w-0 grow items-center gap-4">
					<CourseGlyph look={look} size="lg" />
					<div className="min-w-0">
						<p className="flex items-center gap-2 text-xs font-semibold tracking-wide" style={{ color: ink }}>
							{live ? (
								<>
									<span aria-hidden className="relative flex size-2">
										<span className="absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping" style={{ backgroundColor: look.color }} />
										<span className="relative inline-flex size-2 rounded-full" style={{ backgroundColor: look.color }} />
									</span>
									{t("inClass", moment.minutes!)}
								</>
							) : (
								<>
									<ChalkboardTeacherIcon size={14} weight="bold" />
									{t("nextClass", moment.minutes!)}
								</>
							)}
						</p>
						<h2 className="truncate text-xl font-semibold tracking-tight sm:text-2xl" lang={look.titleLang}>
							{look.title}
						</h2>
						<p className="text-sm text-base-content/65">
							{blockTime(block)}
							{block.room ? ` · ${block.room}` : ""}
						</p>
					</div>
				</Link>
				<nav className="flex gap-2" aria-label={t("courseShortcuts", look.title)}>
					{tabs.map(x => (
						<Link
							key={x.tab}
							to="/courses/$courseId"
							params={{ courseId: String(course.id) }}
							search={{ tab: x.tab }}
							className="btn flex-1 gap-1.5 border-base-content/10 bg-base-100/70 backdrop-blur md:flex-none"
						>
							<x.icon size={17} weight="duotone" />
							{x.label}
						</Link>
					))}
				</nav>
			</div>
			{live && (
				<div aria-hidden className="relative mt-4 h-1 overflow-hidden rounded-full bg-base-content/10">
					<motion.div className="h-full rounded-full" style={{ backgroundColor: look.color }} initial={{ width: 0 }} animate={{ width: `${(moment.progress ?? 0) * 100}%` }} />
				</div>
			)}
			{exercises.length > 0 && (
				<ul className="relative mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label={t("inClassTasks")}>
					{exercises.map(x => {
						const cd = countdown(x.due);
						return (
							<li key={x.key}>
								<TaskAnchor t={x} className="flex items-center gap-3 rounded-xl bg-base-100/80 px-3 py-2.5 backdrop-blur transition hover:bg-base-100">
									<span className="min-w-0 grow">
										<span className="block truncate text-sm font-medium">{x.name}</span>
										<span className={`text-xs ${cd.urgency === "critical" || cd.urgency === "overdue" ? "text-error" : "text-base-content/65"}`}>{cd.text}</span>
									</span>
									<span className="btn btn-sm btn-neutral">{x.kind === "quiz" ? t("attempt") : t("submit")}</span>
								</TaskAnchor>
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}

function DueSoon({ tasks, loading }: { tasks: Task[]; loading: boolean }) {
	const open = tasks.filter(isOpenTask);
	const today = startOfDay(new Date()).getTime();
	const groups: { label: string; late?: boolean; items: Task[] }[] = [
		{ label: t("groupOverdue"), late: true, items: open.filter(x => x.state === "late") },
		{ label: t("groupToday"), items: open.filter(x => x.state === "todo" && x.due && deadlineDay(x.due).getTime() === today) },
		{ label: t("groupTomorrow"), items: open.filter(x => x.state === "todo" && x.due && deadlineDay(x.due).getTime() === today + 86400_000) },
		{ label: t("groupLater"), items: open.filter(x => x.state === "todo" && x.due && deadlineDay(x.due).getTime() > today + 86400_000).slice(0, 8) },
		{ label: t("groupNoDue"), items: open.filter(x => !x.due) }
	].filter(g => g.items.length);

	return (
		<section className="card-quiet p-4">
			<SectionTitle
				action={
					<Link to="/tasks" className="text-xs text-base-content/65 hover:text-base-content">
						{t("allTasks")} <span aria-hidden>→</span>
					</Link>
				}
			>
				{t("dueSoon")}
			</SectionTitle>
			{loading ? (
				<Lines n={4} />
			) : !groups.length ? (
				<Empty icon={<ConfettiIcon size={36} weight="duotone" />} title={t("allDone")}>
					{t("allDoneDesc")}
				</Empty>
			) : (
				<div className="space-y-4">
					{groups.map(g => (
						<div key={g.label}>
							<h3 className={`mb-1 px-2 text-xs font-medium ${g.late ? "text-error" : "text-base-content/65"}`}>{g.label}</h3>
							<ul>
								{g.items.map(x => (
									<li key={x.key}>
										<TaskLine t={x} trailing={<DueBadge t={x} />} />
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			)}
		</section>
	);
}

function DueBadge({ t }: { t: Task }) {
	if (!t.due) return null;
	const cd = countdown(t.due);
	const tone = { overdue: "badge-error", critical: "badge-warning", soon: "badge-ghost", later: "badge-ghost" }[cd.urgency];
	return (
		<span className={`badge badge-sm badge-soft shrink-0 ${tone}`} title={TASK_STATE_LABEL[t.state]}>
			{cd.text}
		</span>
	);
}

function LatestAnnouncements({ items, loading, byId }: { items?: Announcement[]; loading: boolean; byId: Map<number, ParsedCourse> }) {
	const seen = usePrefs(s => s.seen);
	const list = (items ?? []).slice(0, 6);
	return (
		<section className="card-quiet p-4">
			<SectionTitle
				action={
					<Link to="/announcements" className="text-xs text-base-content/65 hover:text-base-content">
						{t("allAnnouncements")} <span aria-hidden>→</span>
					</Link>
				}
			>
				{t("latestAnnouncements")}
			</SectionTitle>
			{loading ? (
				<Lines n={4} />
			) : !list.length ? (
				<Empty icon={<BellSimpleIcon size={36} weight="duotone" />} title={t("noAnnouncements")} />
			) : (
				<ul className="-mx-1 space-y-0.5">
					{list.map(a => {
						const course = byId.get(a.courseId);
						const unread = !seen[a.discussion];
						return (
							<li key={a.id}>
								<Link
									to="/courses/$courseId/discussion/$discussionId"
									params={{ courseId: String(a.courseId), discussionId: String(a.discussion) }}
									className="block rounded-xl px-2 py-2 hover:bg-base-content/[0.04]"
									data-nav
								>
									<div className="flex items-center gap-2">
										{course && <CourseTag course={course} />}
										<Ago ts={postTime(a)} className="ml-auto shrink-0 text-xs text-base-content/65" />
									</div>
									<p className={`mt-0.5 flex items-start gap-1.5 text-sm ${unread ? "font-semibold" : "text-base-content/75"}`}>
										{unread && (
											<>
												<span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
												<span className="sr-only">{t("unread")}</span>
											</>
										)}
										<span className="line-clamp-2">{a.subject}</span>
									</p>
									<p className="mt-0.5 line-clamp-1 text-xs text-base-content/65">
										{cleanAuthor(a.userfullname)}・{htmlToText(a.message, 80)}
									</p>
								</Link>
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}
