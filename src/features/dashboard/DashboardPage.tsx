import { type Announcement, cleanAuthor, postTime, useAnnouncements } from "@/features/announcements/api";
import { TASK_STATE_LABEL } from "@/features/assignments/api";
import { isOpenTask, type Task, useActiveCourses, useTasks } from "@/features/assignments/tasks";
import { CalendarBoard, TaskAnchor, TaskLine } from "@/features/calendar/Board";
import { useSiteInfo } from "@/features/courses/api";
import { CourseGlyph, resolveLook, useCourseLook } from "@/features/courses/look";
import type { ParsedCourse } from "@/features/courses/parse";
import { usePrefs } from "@/features/preferences/store";
import { blockTime, classMoment, useNow } from "@/features/timetable/now";
import { htmlToText } from "@/lib/moodle/files";
import { countdown, deadlineDay, deadlinePhrase, startOfDay, weekdayName } from "@/lib/time/relative";
import { Ago } from "@/shared/ui/Time";
import { CourseTag } from "@/shared/ui/CourseTag";
import { Empty, ErrorNote, Lines, SectionTitle } from "@/shared/ui/States";
import { ArrowRightIcon, BellSimpleIcon, ChalkboardTeacherIcon, ConfettiIcon, FilesIcon, ListChecksIcon, MegaphoneIcon, TableIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { RecentMaterials } from "./RecentMaterials";
import { GradingQueue } from "@/features/teaching/GradingQueue";

const stagger = { animate: { transition: { staggerChildren: 0.05 } } };
const rise = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };

export function DashboardPage() {
	const { active, isPending: coursesPending, error: coursesError } = useActiveCourses();
	const { tasks, isPending, error, refetch } = useTasks();
	const announcements = useAnnouncements(
		active.map(c => c.id),
		{ perForum: 6 }
	);

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

function greetingWord(h: number) {
	if (h < 5) return "夜深了";
	if (h < 11) return "早安";
	if (h < 14) return "午安";
	if (h < 18) return "下午好";
	return "晚安";
}

function Greeting({ tasks, loading }: { tasks: Task[]; loading: boolean }) {
	const { data: me } = useSiteInfo();
	const nickname = usePrefs(s => s.nickname.trim());
	const now = useNow(60_000);
	const open = tasks.filter(isOpenTask);
	const weekEnd = startOfDay(new Date(now.getTime() + 7 * 86400_000)).getTime() / 1000;
	const thisWeek = open.filter(t => t.due && t.due < weekEnd);
	const overdue = open.filter(t => t.state === "late");
	const next = open.find(t => t.state === "todo");

	let summary = "這週沒有要交的東西，好好休息。";
	if (loading) summary = "正在整理你這週的進度…";
	else if (thisWeek.length || overdue.length) {
		const parts = [];
		if (thisWeek.length) parts.push(`接下來 7 天有 ${thisWeek.length} 份要交`);
		if (overdue.length) parts.push(`${overdue.length} 份已逾期但還能補交`);
		summary = parts.join("，") + "。";
	}

	return (
		<section className="pt-2">
			<p className="text-sm font-medium text-base-content/50">
				{now.getMonth() + 1} 月 {now.getDate()} 日 · {weekdayName(now)}
			</p>
			<h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
				{greetingWord(now.getHours())}
				{nickname || me ? `，${nickname || me!.firstname}` : ""}
			</h1>
			<p className="mt-2 max-w-2xl text-base text-base-content/65">
				{summary}
				{next && !loading && (
					<>
						{" "}
						最近的是{" "}
						<TaskAnchor t={next} className="font-medium text-base-content underline decoration-base-content/20 underline-offset-4 hover:decoration-base-content">
							{resolveLook(next.course).title}・{next.name}
						</TaskAnchor>
						（{deadlinePhrase(next.due)}）。
					</>
				)}
			</p>
		</section>
	);
}

/** The class happening now (or next), with its materials, live exercises and announcements one tap away. */
function NowCard({ courses, tasks }: { courses: ParsedCourse[]; tasks: Task[] }) {
	const timetable = usePrefs(s => s.timetable);
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
					<p className="font-medium">設定課表，讓 EM3 知道你現在在上哪堂課</p>
					<p className="text-sm text-base-content/55">上課時，那堂課的教材、課堂練習會直接出現在這裡。</p>
				</div>
				<ArrowRightIcon size={18} className="text-base-content/40 transition group-hover:translate-x-1" />
			</Link>
		);
	}
	if (!block || !course || !look) return null;

	const live = !!moment.now;
	const exercises = tasks.filter(t => t.course.id === course.id && isOpenTask(t) && (t.inClass || (t.due && t.due * 1000 - now.getTime() < 6 * 3600_000)));
	const tabs = [
		{ tab: "materials", label: "教材", icon: FilesIcon },
		{ tab: "assignments", label: "作業", icon: ListChecksIcon },
		{ tab: "announcements", label: "公告", icon: MegaphoneIcon }
	] as const;

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
						<p className="flex items-center gap-2 text-xs font-semibold tracking-wide" style={{ color: look.color }}>
							{live ? (
								<>
									<span className="relative flex size-2">
										<span className="absolute inline-flex size-full animate-ping rounded-full opacity-60" style={{ backgroundColor: look.color }} />
										<span className="relative inline-flex size-2 rounded-full" style={{ backgroundColor: look.color }} />
									</span>
									上課中 · 還有 {moment.minutes} 分鐘下課
								</>
							) : (
								<>
									<ChalkboardTeacherIcon size={14} weight="bold" />
									下一堂 · {moment.minutes! >= 60 ? `${Math.floor(moment.minutes! / 60)} 小時 ${moment.minutes! % 60} 分` : `${moment.minutes} 分鐘`}後
								</>
							)}
						</p>
						<h2 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{look.title}</h2>
						<p className="text-sm text-base-content/60">
							{blockTime(block)}
							{block.room ? ` · ${block.room}` : ""}
						</p>
					</div>
				</Link>
				<div className="flex gap-2">
					{tabs.map(t => (
						<Link
							key={t.tab}
							to="/courses/$courseId"
							params={{ courseId: String(course.id) }}
							search={{ tab: t.tab }}
							className="btn flex-1 gap-1.5 border-base-content/10 bg-base-100/70 backdrop-blur md:flex-none"
						>
							<t.icon size={17} weight="duotone" />
							{t.label}
						</Link>
					))}
				</div>
			</div>
			{live && (
				<div className="relative mt-4 h-1 overflow-hidden rounded-full bg-base-content/10">
					<motion.div className="h-full rounded-full" style={{ backgroundColor: look.color }} initial={{ width: 0 }} animate={{ width: `${(moment.progress ?? 0) * 100}%` }} />
				</div>
			)}
			{exercises.length > 0 && (
				<ul className="relative mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
					{exercises.map(t => {
						const cd = countdown(t.due);
						return (
							<li key={t.key}>
								<TaskAnchor t={t} className="flex items-center gap-3 rounded-xl bg-base-100/80 px-3 py-2.5 backdrop-blur transition hover:bg-base-100">
									<span className="min-w-0 grow">
										<span className="block truncate text-sm font-medium">{t.name}</span>
										<span className={`text-xs ${cd.urgency === "critical" || cd.urgency === "overdue" ? "text-error" : "text-base-content/55"}`}>{cd.text}</span>
									</span>
									<span className="btn btn-sm btn-neutral">{t.kind === "quiz" ? "作答" : "繳交"}</span>
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
	const groups: { label: string; items: Task[] }[] = [
		{ label: "逾期・還能補交", items: open.filter(t => t.state === "late") },
		{ label: "今天", items: open.filter(t => t.state === "todo" && t.due && deadlineDay(t.due).getTime() === today) },
		{ label: "明天", items: open.filter(t => t.state === "todo" && t.due && deadlineDay(t.due).getTime() === today + 86400_000) },
		{ label: "之後", items: open.filter(t => t.state === "todo" && t.due && deadlineDay(t.due).getTime() > today + 86400_000).slice(0, 8) },
		{ label: "沒有截止日", items: open.filter(t => !t.due) }
	].filter(g => g.items.length);

	return (
		<section className="card-quiet p-4">
			<SectionTitle
				action={
					<Link to="/tasks" className="text-xs text-base-content/55 hover:text-base-content">
						全部待辦 →
					</Link>
				}
			>
				即將截止
			</SectionTitle>
			{loading ? (
				<Lines n={4} />
			) : !groups.length ? (
				<Empty icon={<ConfettiIcon size={36} weight="duotone" />} title="全部都交了">
					沒有待繳交的作業或測驗。
				</Empty>
			) : (
				<div className="space-y-4">
					{groups.map(g => (
						<div key={g.label}>
							<p className={`mb-1 px-2 text-xs font-medium ${g.label.startsWith("逾期") ? "text-error" : "text-base-content/45"}`}>{g.label}</p>
							<ul>
								{g.items.map(t => (
									<li key={t.key}>
										<TaskLine t={t} trailing={<DueBadge t={t} />} />
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
					<Link to="/announcements" className="text-xs text-base-content/55 hover:text-base-content">
						全部公告 →
					</Link>
				}
			>
				最新公告
			</SectionTitle>
			{loading ? (
				<Lines n={4} />
			) : !list.length ? (
				<Empty icon={<BellSimpleIcon size={36} weight="duotone" />} title="還沒有公告" />
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
										<Ago ts={postTime(a)} className="ml-auto shrink-0 text-xs text-base-content/45" />
									</div>
									<p className={`mt-0.5 flex items-start gap-1.5 text-sm ${unread ? "font-semibold" : "text-base-content/75"}`}>
										{unread && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-label="未讀" />}
										<span className="line-clamp-2">{a.subject}</span>
									</p>
									<p className="mt-0.5 line-clamp-1 text-xs text-base-content/50">
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
