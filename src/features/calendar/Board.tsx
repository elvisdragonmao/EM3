import type { Task } from "@/features/assignments/tasks";
import { useTimetable } from "@/features/timetable/schedule";
import { courseText, defaultColor, resolveLook } from "@/features/courses/look";
import { type CalendarSpan, usePrefs } from "@/features/preferences/store";
import { blocksFor } from "@/features/timetable/now";
import { dayIndex } from "@/features/timetable/periods";
import { addDays, deadlineClock, deadlineDay, md, sameDay, shortWeekday, startOfDay, startOfWeek, weekdayName } from "@/lib/time/relative";
import { CaretLeftIcon, CaretRightIcon, CheckCircleIcon, ExamIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useMedia } from "@/shared/hooks/useMedia";
import { type ReactNode, useId, useMemo, useRef, useState } from "react";
import { gridArrow, useHotkeys } from "@/shared/keyboard/hotkeys";
import { t } from "./messages";

const SPANS: CalendarSpan[] = ["week", "twoWeeks", "month"];

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
	const listId = useId();

	const { start, days } = rangeFor(span, anchor);
	const dates = Array.from({ length: days }, (_, i) => addDays(start, i));
	const byDay = useMemo(() => {
		const map = new Map<string, Task[]>();
		for (const x of tasks) {
			if (!x.due) continue;
			const k = deadlineDay(x.due).toDateString();
			map.set(k, [...(map.get(k) ?? []), x]);
		}
		return map;
	}, [tasks]);
	const blocks = useMemo(() => blocksFor(timetable), [timetable]);

	const weekendUsed = dates.some(d => dayIndex(d) >= 5 && (byDay.get(d.toDateString())?.length ?? 0) > 0);
	const cols = showWeekend || weekendUsed || span === "month" ? 7 : 5;
	const visibleDates = dates.filter(d => cols === 7 || dayIndex(d) < 5);
	const weeks = Array.from({ length: Math.ceil(visibleDates.length / cols) }, (_, r) => visibleDates.slice(r * cols, (r + 1) * cols));

	const title =
		span === "month" ? t("monthTitle", anchor.getFullYear(), anchor.getMonth() + 1) : `${md(start)} – ${md(addDays(start, days - 1))}${sameDay(startOfWeek(today), start) ? t("thisWeek") : ""}`;

	const go = (d: number) => {
		setDir(d);
		setAnchor(a => (d === 0 ? new Date() : shift(span, a, d)));
		if (d === 0) setPicked(today);
	};

	const pickedTasks = byDay.get(picked.toDateString()) ?? [];
	const pickedVisible = visibleDates.some(d => sameDay(d, picked));
	useHotkeys([
		{ keys: "arrowleft", run: () => go(-1) },
		{ keys: "arrowright", run: () => go(1) },
		{ keys: "t", run: () => go(0) },
		{ keys: "v", run: () => setPref(spanKey, SPANS[(SPANS.indexOf(span) + 1) % SPANS.length]) }
	]);

	return (
		<section className="card-quiet overflow-hidden">
			<div className="flex flex-wrap items-center gap-2 border-b hairline px-4 py-3">
				<h2 className="mr-auto text-[0.95rem] font-semibold tracking-tight tabular-nums">{title}</h2>
				<div className="flex items-center rounded-full bg-base-200 p-0.5" role="group" aria-label={t("range")}>
					{SPANS.map(k => (
						<button key={k} type="button" aria-pressed={span === k} onClick={() => setPref(spanKey, k)} className="relative rounded-full px-3 py-1 text-xs font-medium">
							{span === k && <motion.span layoutId="span-pill" className="absolute inset-0 rounded-full bg-base-100 shadow-sm" />}
							<span className="relative">{t(k)}</span>
						</button>
					))}
				</div>
				<div className="join">
					<button type="button" className="btn join-item btn-ghost btn-sm btn-square" onClick={() => go(-1)} aria-label={t("prev")} title={t("prev")}>
						<CaretLeftIcon size={16} />
					</button>
					<button type="button" className="btn join-item btn-ghost btn-sm" onClick={() => go(0)}>
						{t("today")}
					</button>
					<button type="button" className="btn join-item btn-ghost btn-sm btn-square" onClick={() => go(1)} aria-label={t("next")} title={t("next")}>
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
					<div role="row" className="col-span-full grid grid-cols-subgrid">
						{visibleDates.slice(0, cols).map(d => (
							<div key={`h${d.toDateString()}`} role="columnheader" className="border-b hairline px-2 py-2 text-center text-[0.7rem] font-medium tracking-wide text-base-content/65">
								<span aria-hidden>{shortWeekday(d)}</span>
								<span className="sr-only">{weekdayName(d)}</span>
							</div>
						))}
					</div>
					{weeks.map((week, r) => (
						<div key={week[0].toDateString()} role="row" className="col-span-full grid grid-cols-subgrid">
							{week.map((d, c) => {
								const i = r * cols + c;
								const items = byDay.get(d.toDateString()) ?? [];
								const isToday = sameDay(d, today);
								const outside = span === "month" && d.getMonth() !== anchor.getMonth();
								const classes = blocks.filter(b => b.day === dayIndex(d));
								const isPicked = sameDay(d, picked);
								const dense = span === "month" || compact || narrow;
								const cap = dense ? 3 : 6;
								return (
									<button
										key={d.toDateString()}
										type="button"
										role="gridcell"
										onClick={() => setPicked(d)}
										data-cell={`${r}:${c}`}
										tabIndex={isPicked || (!pickedVisible && i === 0) ? 0 : -1}
										aria-selected={isPicked}
										aria-current={isToday ? "date" : undefined}
										aria-controls={listId}
										aria-label={`${t("fullDate", d)}${items.length ? t("deadlines", items.length) : ""}${classes.length ? t("classes", classes.length) : ""}`}
										onFocus={() => setPicked(d)}
										className={`group relative flex flex-col gap-1 border-r border-b hairline p-1.5 text-left transition-colors last:border-r-0 sm:p-2 ${narrow ? "min-h-14" : dense ? "min-h-20 sm:min-h-24" : "min-h-36 sm:min-h-44"} ${outside ? "bg-base-200/40 text-base-content/65" : ""} ${isPicked ? "bg-primary/[0.04]" : "hover:bg-base-content/[0.02]"}`}
									>
										<div className="flex items-center justify-between">
											<span className={`grid size-6 place-items-center rounded-full text-xs tabular-nums ${isToday ? "bg-primary font-semibold text-primary-content" : "text-base-content/70"}`}>
												{d.getDate()}
											</span>
											<span className="hidden gap-0.5 sm:flex" aria-hidden>
												{classes.slice(0, 4).map((b, j) => {
													const color = looks[b.courseId]?.color ?? defaultColor(b.courseId);
													return <span key={j} className="h-1 w-2.5 rounded-full opacity-60" style={{ backgroundColor: color }} />;
												})}
											</span>
										</div>
										{narrow ? (
											// Dots only; the cell's label carries the count and the picked-day list below names each one.
											<div className="flex flex-wrap gap-1 px-0.5" aria-hidden>
												{items.map(x => (
													<span
														key={x.key}
														className={`size-2 rounded-full ${x.state === "submitted" || x.state === "graded" ? "opacity-30" : ""}`}
														style={{ backgroundColor: looks[x.course.id]?.color ?? defaultColor(x.course.id) }}
													/>
												))}
											</div>
										) : (
											<div className="flex min-w-0 flex-col gap-1">
												{items.slice(0, cap).map(x => (
													<TaskChip key={x.key} t={x} dense={dense} />
												))}
												{items.length > cap && (
													<span className="px-1 text-[0.65rem] text-base-content/65">
														<span aria-hidden>+{items.length - cap}</span>
														<span className="sr-only">{t("more", items.length - cap)}</span>
													</span>
												)}
											</div>
										)}
									</button>
								);
							})}
						</div>
					))}
				</motion.div>
			</AnimatePresence>

			{/* The picked day's list makes every deadline reachable by click, tap and keyboard. */}
			{
				<div id={listId} className="border-t hairline px-4 py-3">
					<h3 className="mb-2 text-xs font-medium text-base-content/65">
						{md(picked)} {shortWeekday(picked)}
						{sameDay(picked, today) ? t("todaySuffix") : ""}
					</h3>
					{pickedTasks.length ? (
						<ul className="space-y-1.5">
							{pickedTasks.map(x => (
								<li key={x.key}>
									<TaskLine t={x} />
								</li>
							))}
						</ul>
					) : (
						<p className="text-sm text-base-content/65">{t("noDeadlines")}</p>
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

function TaskChip({ t: task, dense }: { t: Task; dense: boolean }) {
	const look = resolveLook(task.course, usePrefs.getState().courses[task.course.id]);
	const done = task.state === "submitted" || task.state === "graded";
	const status = done ? <span className="sr-only">{t("done")}</span> : task.kind === "quiz" ? <span className="sr-only">{t("quiz")}</span> : null;
	if (!dense)
		return (
			<span
				className={`block min-w-0 rounded-lg border-l-[3px] px-1.5 py-1 text-[0.72rem] leading-snug ${done ? "text-base-content/70" : ""}`}
				// Done tasks fade by tint, not opacity, so their text keeps 4.5:1.
				style={{ borderColor: done ? `color-mix(in oklab, ${look.color} 40%, transparent)` : look.color, backgroundColor: `color-mix(in oklab, ${look.color} ${done ? 4 : 10}%, transparent)` }}
				title={`${look.title}｜${task.name}`}
			>
				<span className={`line-clamp-2 font-medium [overflow-wrap:anywhere] ${done ? "line-through" : ""}`}>{task.name}</span>
				<span className="mt-0.5 flex items-center gap-1 text-[0.65rem] text-base-content/75">
					{done ? <CheckCircleIcon size={11} weight="fill" className="shrink-0 text-success" /> : task.kind === "quiz" ? <ExamIcon size={11} className="shrink-0" /> : null}
					{status}
					<span className="tabular-nums">{deadlineClock(task.due)}</span>
					<span className="truncate" lang={look.titleLang}>
						{look.title}
					</span>
				</span>
			</span>
		);
	return (
		<span
			className="flex min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.7rem] leading-tight"
			style={
				done
					? { backgroundColor: "color-mix(in oklab, var(--color-base-content) 5%, transparent)", color: "color-mix(in oklab, var(--color-base-content) 70%, transparent)" }
					: { backgroundColor: `color-mix(in oklab, ${look.color} 14%, transparent)`, color: courseText(look.color) }
			}
			title={`${look.title}｜${task.name}`}
		>
			{done ? <CheckCircleIcon size={11} weight="bold" className="shrink-0" /> : task.kind === "quiz" ? <ExamIcon size={11} className="shrink-0" /> : null}
			{status}
			<span className={`truncate ${done ? "line-through" : ""}`}>{dense ? look.title : task.name}</span>
			{!dense && <span className="ml-auto shrink-0 tabular-nums">{deadlineClock(task.due)}</span>}
		</span>
	);
}

export function TaskLine({ t: task, trailing }: { t: Task; trailing?: ReactNode }) {
	const look = resolveLook(task.course, usePrefs.getState().courses[task.course.id]);
	const done = task.state === "submitted" || task.state === "graded";
	const inner = (
		<>
			<span aria-hidden className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: look.color }} />
			<span className="min-w-0 grow">
				<span className={`block truncate text-sm font-medium ${done ? "text-base-content/65 line-through" : ""}`}>{task.name}</span>
				<span className="block truncate text-xs text-base-content/65">
					{look.title} · {task.due ? deadlineClock(task.due) : t("noDue")}
				</span>
			</span>
			{done && (
				<>
					<CheckCircleIcon size={18} weight="fill" className="shrink-0 text-success" />
					<span className="sr-only">{t("done")}</span>
				</>
			)}
			{trailing}
		</>
	);
	return (
		<TaskAnchor t={task} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-base-content/[0.04]">
			{inner}
		</TaskAnchor>
	);
}
