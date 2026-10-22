import type { Task } from "@/features/assignments/tasks";
import { useTimetable } from "@/features/timetable/schedule";
import { defaultColor, resolveLook } from "@/features/courses/look";
import { type CalendarSpan, usePrefs } from "@/features/preferences/store";
import { blocksFor } from "@/features/timetable/now";
import { dayIndex } from "@/features/timetable/periods";
import { addDays, deadlineClock, deadlineDay, md, sameDay, shortWeekday, startOfDay, startOfWeek } from "@/lib/time/relative";
import { CaretLeftIcon, CaretRightIcon, CheckCircleIcon, ExamIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useMedia } from "@/shared/hooks/useMedia";
import { type ReactNode, useMemo, useRef, useState } from "react";
import { gridArrow, useHotkeys } from "@/shared/keyboard/hotkeys";

const SPANS: { key: CalendarSpan; label: string }[] = [
	{ key: "week", label: "週" },
	{ key: "twoWeeks", label: "兩週" },
	{ key: "month", label: "月" }
];

function rangeFor(span: CalendarSpan, anchor: Date) {
	if (span === "month") {
		const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
		const start = startOfWeek(first);
		const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
		const weeks = Math.ceil((dayIndex(first) + last.getDate()) / 7);
		return { start, days: weeks * 7 };
	}
	return { start: startOfWeek(anchor), days: span === "week" ? 7 : 14 };
}

function shift(span: CalendarSpan, anchor: Date, dir: number) {
	if (span === "month") return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
	return addDays(anchor, dir * (span === "week" ? 7 : 14));
}

export function CalendarBoard({ tasks, compact = false, spanKey = "calendarSpan" }: { tasks: Task[]; compact?: boolean; spanKey?: "calendarSpan" | "calendarPageSpan" }) {
	const span = usePrefs(s => s[spanKey]);
	const setPref = usePrefs(s => s.set);
	const showWeekend = usePrefs(s => s.showWeekend);
	const timetable = useTimetable();
	const looks = usePrefs(s => s.courses);
	const [anchor, setAnchor] = useState(() => new Date());
	const [dir, setDir] = useState(0);
	const [picked, setPicked] = useState<Date>(() => startOfDay(new Date()));
	const today = startOfDay(new Date());
	const narrow = useMedia("(max-width: 639px)");
	const gridRef = useRef<HTMLDivElement>(null);

	const { start, days } = rangeFor(span, anchor);
	const dates = Array.from({ length: days }, (_, i) => addDays(start, i));
	const byDay = useMemo(() => {
		const map = new Map<string, Task[]>();
		for (const t of tasks) {
			if (!t.due) continue;
			const k = deadlineDay(t.due).toDateString();
			map.set(k, [...(map.get(k) ?? []), t]);
		}
		return map;
	}, [tasks]);
	const blocks = useMemo(() => blocksFor(timetable), [timetable]);

	const weekendUsed = dates.some(d => dayIndex(d) >= 5 && (byDay.get(d.toDateString())?.length ?? 0) > 0);
	const cols = showWeekend || weekendUsed || span === "month" ? 7 : 5;
	const visibleDates = dates.filter(d => cols === 7 || dayIndex(d) < 5);

	const title = span === "month" ? `${anchor.getFullYear()} 年 ${anchor.getMonth() + 1} 月` : `${md(start)} – ${md(addDays(start, days - 1))}${sameDay(startOfWeek(today), start) ? " · 本週" : ""}`;

	const go = (d: number) => {
		setDir(d);
		setAnchor(a => (d === 0 ? new Date() : shift(span, a, d)));
		if (d === 0) setPicked(today);
	};

	const pickedTasks = byDay.get(picked.toDateString()) ?? [];
	const pickedVisible = visibleDates.some(d => sameDay(d, picked));
	const order: CalendarSpan[] = ["week", "twoWeeks", "month"];
	useHotkeys([
		{ keys: "arrowleft", run: () => go(-1) },
		{ keys: "arrowright", run: () => go(1) },
		{ keys: "t", run: () => go(0) },
		{ keys: "v", run: () => setPref(spanKey, order[(order.indexOf(span) + 1) % order.length]) }
	]);

	return (
		<section className="card-quiet overflow-hidden">
			<div className="flex flex-wrap items-center gap-2 border-b hairline px-4 py-3">
				<h2 className="mr-auto text-[0.95rem] font-semibold tracking-tight tabular-nums">{title}</h2>
				<div className="flex items-center rounded-full bg-base-200 p-0.5" role="tablist" aria-label="時間範圍">
					{SPANS.map(s => (
						<button key={s.key} role="tab" aria-selected={span === s.key} onClick={() => setPref(spanKey, s.key)} className="relative rounded-full px-3 py-1 text-xs font-medium">
							{span === s.key && <motion.span layoutId="span-pill" className="absolute inset-0 rounded-full bg-base-100 shadow-sm" />}
							<span className="relative">{s.label}</span>
						</button>
					))}
				</div>
				<div className="join">
					<button className="btn join-item btn-ghost btn-sm btn-square" onClick={() => go(-1)} aria-label="上一段">
						<CaretLeftIcon size={16} />
					</button>
					<button className="btn join-item btn-ghost btn-sm" onClick={() => go(0)}>
						今天
					</button>
					<button className="btn join-item btn-ghost btn-sm btn-square" onClick={() => go(1)} aria-label="下一段">
						<CaretRightIcon size={16} />
					</button>
				</div>
			</div>

			<AnimatePresence mode="popLayout" initial={false} custom={dir}>
				<motion.div
					key={`${span}-${start.toDateString()}`}
					custom={dir}
					initial={{ opacity: 0, x: dir * 40 }}
					animate={{ opacity: 1, x: 0 }}
					exit={{ opacity: 0, x: dir * -40 }}
					ref={gridRef}
					onKeyDown={e => gridArrow(e, gridRef.current)}
					role="grid"
					aria-label={title}
					className="grid"
					style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
				>
					{visibleDates.slice(0, cols).map(d => (
						<div key={`h${d.toDateString()}`} className="border-b hairline px-2 py-2 text-center text-[0.7rem] font-medium tracking-wide text-base-content/45">
							{shortWeekday(d)}
						</div>
					))}
					{visibleDates.map((d, i) => {
						const items = byDay.get(d.toDateString()) ?? [];
						const isToday = sameDay(d, today);
						const outside = span === "month" && d.getMonth() !== anchor.getMonth();
						const classes = blocks.filter(b => b.day === dayIndex(d));
						const isPicked = sameDay(d, picked);
						const dense = span === "month" || compact || narrow;
						return (
							<button
								key={d.toDateString()}
								onClick={() => setPicked(d)}
								data-cell={`${Math.floor(i / cols)}:${i % cols}`}
								tabIndex={isPicked || (!pickedVisible && i === 0) ? 0 : -1}
								aria-pressed={isPicked}
								aria-label={`${md(d)} ${shortWeekday(d)}${items.length ? `，${items.length} 個截止` : ""}`}
								onFocus={() => setPicked(d)}
								className={`group relative flex flex-col gap-1 border-r border-b hairline p-1.5 text-left transition-colors last:border-r-0 sm:p-2 ${narrow ? "min-h-14" : dense ? "min-h-20 sm:min-h-24" : "min-h-36 sm:min-h-44"} ${outside ? "bg-base-200/40 text-base-content/35" : ""} ${isPicked ? "bg-primary/[0.04]" : "hover:bg-base-content/[0.02]"}`}
							>
								<div className="flex items-center justify-between">
									<span className={`grid size-6 place-items-center rounded-full text-xs tabular-nums ${isToday ? "bg-primary font-semibold text-primary-content" : "text-base-content/70"}`}>
										{d.getDate()}
									</span>
									<span className="hidden gap-0.5 sm:flex" aria-label={classes.length ? `${classes.length} 堂課` : undefined}>
										{classes.slice(0, 4).map((b, i) => {
											const c = looks[b.courseId]?.color ?? defaultColor(b.courseId);
											return <span key={i} className="h-1 w-2.5 rounded-full opacity-60" style={{ backgroundColor: c }} />;
										})}
									</span>
								</div>
								{narrow ? (
									<div className="flex flex-wrap gap-1 px-0.5">
										{items.map(t => (
											<span
												key={t.key}
												className={`size-2 rounded-full ${t.state === "submitted" || t.state === "graded" ? "opacity-30" : ""}`}
												style={{ backgroundColor: looks[t.course.id]?.color ?? defaultColor(t.course.id) }}
											/>
										))}
									</div>
								) : (
									<div className="flex min-w-0 flex-col gap-1">
										{items.slice(0, dense ? 3 : 6).map(t => (
											<TaskChip key={t.key} t={t} dense={dense} />
										))}
										{items.length > (dense ? 3 : 6) && <span className="px-1 text-[0.65rem] text-base-content/50">+{items.length - (dense ? 3 : 6)}</span>}
									</div>
								)}
							</button>
						);
					})}
				</motion.div>
			</AnimatePresence>

			{/* The picked day's list makes every deadline reachable by click, tap and keyboard. */}
			{
				<div className="border-t hairline px-4 py-3">
					<p className="mb-2 text-xs font-medium text-base-content/50" aria-live="polite">
						{md(picked)} {shortWeekday(picked)}
						{sameDay(picked, today) ? " · 今天" : ""}
					</p>
					{pickedTasks.length ? (
						<ul className="space-y-1.5">
							{pickedTasks.map(t => (
								<li key={t.key}>
									<TaskLine t={t} />
								</li>
							))}
						</ul>
					) : (
						<p className="text-sm text-base-content/45">這天沒有截止的東西</p>
					)}
				</div>
			}
		</section>
	);
}

function taskLink(t: Task) {
	const params = { courseId: String(t.course.id), cmid: String(t.cmid) };
	return t.kind === "assign" ? ({ to: "/courses/$courseId/assign/$cmid", params } as const) : ({ to: "/courses/$courseId/quiz/$cmid", params } as const);
}

/** Opens a task's page in EM3. */
export function TaskAnchor({ t, className, children }: { t: Task; className?: string; children: ReactNode }) {
	return (
		<Link {...taskLink(t)} className={className} data-nav>
			{children}
		</Link>
	);
}

function TaskChip({ t, dense }: { t: Task; dense: boolean }) {
	const look = resolveLook(t.course, usePrefs.getState().courses[t.course.id]);
	const done = t.state === "submitted" || t.state === "graded";
	if (!dense)
		return (
			<span
				className={`block min-w-0 rounded-lg border-l-[3px] px-1.5 py-1 text-[0.72rem] leading-snug ${done ? "opacity-50" : ""}`}
				style={{ borderColor: look.color, backgroundColor: `color-mix(in oklab, ${look.color} 10%, transparent)` }}
				title={`${look.title}｜${t.name}`}
			>
				<span className={`line-clamp-2 font-medium [overflow-wrap:anywhere] ${done ? "line-through" : ""}`}>{t.name}</span>
				<span className="mt-0.5 flex items-center gap-1 text-[0.65rem] text-base-content/55">
					{done ? <CheckCircleIcon size={11} weight="fill" className="shrink-0 text-success" /> : t.kind === "quiz" ? <ExamIcon size={11} className="shrink-0" /> : null}
					<span className="tabular-nums">{deadlineClock(t.due)}</span>
					<span className="truncate">{look.title}</span>
				</span>
			</span>
		);
	return (
		<span
			className={`flex min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.7rem] leading-tight ${done ? "opacity-45" : ""}`}
			style={{ backgroundColor: `color-mix(in oklab, ${look.color} 14%, transparent)`, color: `color-mix(in oklab, ${look.color} 70%, var(--color-base-content))` }}
			title={`${look.title}｜${t.name}`}
		>
			{done ? <CheckCircleIcon size={11} weight="bold" className="shrink-0" /> : t.kind === "quiz" ? <ExamIcon size={11} className="shrink-0" /> : null}
			<span className={`truncate ${done ? "line-through" : ""}`}>{dense ? look.title : t.name}</span>
			{!dense && <span className="ml-auto shrink-0 tabular-nums opacity-70">{deadlineClock(t.due)}</span>}
		</span>
	);
}

export function TaskLine({ t, trailing }: { t: Task; trailing?: ReactNode }) {
	const look = resolveLook(t.course, usePrefs.getState().courses[t.course.id]);
	const done = t.state === "submitted" || t.state === "graded";
	const inner = (
		<>
			<span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: look.color }} />
			<span className="min-w-0 grow">
				<span className={`block truncate text-sm font-medium ${done ? "text-base-content/45 line-through" : ""}`}>{t.name}</span>
				<span className="block truncate text-xs text-base-content/55">
					{look.title} · {t.due ? deadlineClock(t.due) : "沒有截止日"}
				</span>
			</span>
			{done && <CheckCircleIcon size={18} weight="fill" className="shrink-0 text-success" />}
			{trailing}
		</>
	);
	return (
		<TaskAnchor t={t} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-base-content/[0.04]">
			{inner}
		</TaskAnchor>
	);
}
