import { useCourseIndex } from "@/features/courses/api";
import { CourseGlyph, resolveLook } from "@/features/courses/look";
import type { ParsedCourse } from "@/features/courses/parse";
import { type TimetableEntry, usePrefs } from "@/features/preferences/store";
import { PageTitle } from "@/shared/ui/States";
import { ArrowCounterClockwiseIcon, ArrowSquareOutIcon, PaintBrushIcon } from "@phosphor-icons/react";
import { gridArrow } from "@/shared/keyboard/hotkeys";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { syllabusUrl } from "./import";
import { blocksFor, blockTime, classMoment, useNow } from "./now";
import { DAY_LABELS, dayIndex, formatSlots, overlaps, parseScheduleCode, periodByCode, periodEndMinutes, periodStartMinutes, schoolPeriods } from "./periods";
import { useManualTimetable, useTimetable } from "./schedule";

/** Height of one grid row. Rows are even, like the school's own timetable, not stretched to the real breaks. */
const ROW = 64;
/** Room above the first row and below the last. */
const PAD = 6;

export function TimetablePage() {
	const { currentCourses, current } = useCourseIndex();
	const looks = usePrefs(s => s.courses);
	const timetable = useTimetable();
	const manual = useManualTimetable();
	const setTimetable = usePrefs(s => s.setTimetable);
	const school = schoolPeriods();
	const [brush, setBrush] = useState<number | null>(null);
	const now = useNow();
	const moment = classMoment(timetable, now);
	const grid = useRef<HTMLDivElement>(null);
	// The staggered entrance plays once, not on every edit.
	const entered = useRef(false);
	useEffect(() => {
		entered.current = true;
	}, []);

	const courses = useMemo(() => currentCourses.filter(c => !looks[c.id]?.hidden), [currentCourses, looks]);
	const blocks = useMemo(() => (school ? blocksFor(timetable) : []), [timetable, school]);
	const byCell = useMemo(() => {
		const m = new Map<string, number>();
		// A period fills every grid row it overlaps: CCU's 75-minute E covers hourly rows 7 and 8.
		for (const [id, e] of Object.entries(timetable))
			for (const s of e.slots) for (const row of school?.rows ?? []) if (periodByCode(s.period) && overlaps(s.period, row)) m.set(`${s.day}:${row}`, Number(id));
		return m;
	}, [timetable, school]);

	if (!school)
		return (
			<div>
				<PageTitle title="課表" subtitle="EM3 還沒有這所學校的節次時間，暫時無法顯示課表。" />
			</div>
		);

	// The view spans the school's usual day plus any class outside it, in whole periods.
	const rows = school.periods.filter(p => school.rows.includes(p.code));
	const core = rows.filter(p => school.core.includes(p.code));
	const from = Math.min(...core.map(p => periodStartMinutes(p.code)), ...blocks.map(b => b.start));
	const to = Math.max(...core.map(p => periodEndMinutes(p.code)), ...blocks.map(b => b.end));
	const inView = (code: string) => periodStartMinutes(code) < to && periodEndMinutes(code) > from;
	// Schools that draw their day in blocks (CCU's Ⅰ-Ⅴ) show whole blocks, as on the school's own timetable.
	const sections = school.sections?.filter(s => s.rows.some(inView));
	const shown = rows.filter(p => (sections ? sections.some(s => s.rows.includes(p.code)) : inView(p.code)));
	const sectionStart = new Set(sections?.map(s => s.rows[0]));
	const rowTop = new Map(shown.map((p, i) => [p.code, PAD + i * ROW]));
	const height = PAD * 2 + shown.length * ROW;
	// A second axis (CCU's A-J) splits each section evenly: three hourly rows hold two lettered periods.
	const secondaryBox = new Map<string, { top: number; height: number }>();
	for (const sec of sections ?? []) {
		const start = periodStartMinutes(sec.rows[0]);
		const end = periodEndMinutes(sec.rows.at(-1)!);
		const inside = school.periods.filter(p => !school.rows.includes(p.code) && periodStartMinutes(p.code) >= start && periodStartMinutes(p.code) < end);
		const h = (sec.rows.length * ROW) / inside.length;
		inside.forEach((p, j) => secondaryBox.set(p.code, { top: rowTop.get(sec.rows[0])! + j * h, height: h }));
	}
	const secondary = school.periods.filter(p => secondaryBox.has(p.code));
	const box = (code: string) => (rowTop.has(code) ? { top: rowTop.get(code)!, height: ROW } : secondaryBox.get(code));
	// The now line moves through each row in proportion to its period, and waits at the next row during breaks.
	const yAt = (min: number) => {
		for (const p of shown) {
			const start = periodStartMinutes(p.code);
			const end = periodEndMinutes(p.code);
			if (min < start) return rowTop.get(p.code)!;
			if (min < end) return rowTop.get(p.code)! + ((min - start) / (end - start)) * ROW;
		}
		return PAD + shown.length * ROW;
	};

	const weekend = blocks.some(b => b.day >= 5);
	const days = weekend ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4];
	const today = dayIndex(now);
	const minute = now.getHours() * 60 + now.getMinutes();

	function toggle(day: number, period: string) {
		const owner = byCell.get(`${day}:${period}`);
		if (owner !== undefined) {
			const e = timetable[owner];
			setTimetable(owner, { ...e, slots: e.slots.filter(s => !(s.day === day && periodByCode(s.period) && overlaps(s.period, period))) });
			if (owner === brush || brush === null) return;
		}
		if (brush === null) return;
		const e = timetable[brush] ?? { slots: [] };
		setTimetable(brush, { ...e, slots: [...e.slots, { day, period }] });
	}

	// A period lights up only while it runs and today has a class in it.
	const isNow = (code: string) => {
		const start = periodStartMinutes(code);
		const end = periodEndMinutes(code);
		return minute >= start && minute < end && blocks.some(b => b.day === today && b.start < end && start < b.end);
	};
	// Gutter periods are the same quiet cards as the course list beside the grid, from their real start to end.
	// The period running now lights up; on CCU an hourly and a lettered period can both be lit.
	const LIT = {
		background: "color-mix(in oklab, var(--color-primary) 14%, var(--color-base-100))",
		boxShadow: "0 0 0 2px var(--color-primary), 0 0 14px color-mix(in oklab, var(--color-primary) 45%, transparent)"
	};
	const tile = (key: string, at: { top: number; height: number }, lit: boolean, tone: string, children: React.ReactNode) => (
		<span
			key={key}
			className={`card-quiet absolute inset-x-0 flex flex-col items-center justify-center leading-tight tabular-nums ${lit ? "text-primary" : tone}`}
			style={{ top: at.top + 2, height: at.height - 4, ...(lit ? LIT : undefined) }}
		>
			{children}
		</span>
	);
	const label = (p: { code: string; start: string; end: string }, secondaryAxis: boolean) =>
		tile(
			p.code,
			box(p.code)!,
			isNow(p.code),
			secondaryAxis ? "text-base-content/45" : "text-base-content/65",
			<>
				<span className="text-xs font-semibold">{p.code.toUpperCase()}</span>
				<span className="text-[0.7rem]">{p.start}</span>
				<span className="text-[0.7rem] opacity-70">{p.end}</span>
			</>
		);

	return (
		<div>
			<PageTitle title="課表" subtitle={`${current?.label ?? "本學期"}。設定之後，首頁和側欄會在上課時把那堂課放到最前面。`} />

			<div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_22rem]">
				<section className="card-quiet overflow-x-auto">
					<div
						ref={grid}
						onKeyDown={e => gridArrow(e, grid.current)}
						role="group"
						aria-label="每週課表"
						className="grid min-w-[36rem] pr-2"
						style={{ gridTemplateColumns: `${secondary.length ? "8.75rem" : "4.25rem"} repeat(${days.length}, minmax(0, 1fr))` }}
					>
						{/* The header's bottom rule is the table's top line, across the gutter too. */}
						<div className="border-b hairline" />
						{days.map(d => (
							<div key={d} className={`border-b hairline py-3 text-center text-xs font-medium ${d === today ? "text-primary" : "text-base-content/50"}`}>
								週{DAY_LABELS[d]}
							</div>
						))}

						<div className="relative" style={{ height }} aria-hidden>
							<div className="absolute inset-0 flex gap-1 px-1.5">
								{sections && (
									<div className="relative w-6 shrink-0">
										{sections.map(s =>
											tile(s.label, { top: rowTop.get(s.rows[0])!, height: s.rows.length * ROW }, false, "text-base-content/45", <span className="text-xs font-semibold">{s.label}</span>)
										)}
									</div>
								)}
								<div className="relative flex-1">{shown.map(p => label(p, false))}</div>
								{secondary.length > 0 && <div className="relative flex-1">{secondary.map(p => label(p, true))}</div>}
							</div>
						</div>

						{days.map((d, di) => (
							<div key={d} className={`relative border-l hairline ${d === today ? "bg-primary/[0.03]" : ""}`} style={{ height }}>
								{shown.map((p, pi) => {
									const id = byCell.get(`${d}:${p.code}`);
									const course = id !== undefined ? currentCourses.find(c => c.id === id) : undefined;
									return (
										<button
											key={p.code}
											onClick={() => toggle(d, p.code)}
											data-cell={`${pi}:${di}`}
											tabIndex={pi === 0 && di === 0 ? 0 : -1}
											className={`absolute inset-x-0 ${pi === 0 ? "" : `border-t ${sectionStart.has(p.code) ? "border-base-content/25" : "hairline"}`} transition-colors active:bg-base-content/10 ${brush !== null ? "hover:bg-base-content/[0.06]" : ""}`}
											style={{ top: rowTop.get(p.code), height: ROW }}
											aria-label={`週${DAY_LABELS[d]} 第 ${p.code} 節${course ? `：${resolveLook(course, looks[course.id]).title}` : ""}`}
										/>
									);
								})}

								<AnimatePresence initial={false}>
									{blocks
										.filter(b => b.day === d)
										.map((b, i) => {
											const course = currentCourses.find(c => c.id === b.courseId);
											if (!course) return null;
											const look = resolveLook(course, looks[course.id]);
											const live = moment.now?.courseId === b.courseId && d === today;
											const first = box(b.from);
											const last = box(b.to);
											if (!first || !last) return null;
											// Inset 4 px on every side, the same as the gap between day columns.
											const h = last.top + last.height - first.top - 8;
											return (
												<motion.div
													key={`${b.courseId}:${b.from}`}
													initial={{ opacity: 0, scale: 0.96 }}
													animate={{ opacity: 1, scale: 1 }}
													exit={{ opacity: 0, scale: 0.96 }}
													transition={{ duration: 0.2, delay: entered.current ? 0 : Math.min(i * 0.06 + di * 0.04, 0.4) }}
													// Without a brush a block opens its course; with one, clicks fall through to the grid to paint or erase.
													className={`absolute inset-x-1 overflow-hidden rounded-lg px-2 py-1.5 leading-tight transition-[filter] ${brush === null ? "hover:brightness-125" : "pointer-events-none"} ${live ? "ring-2" : ""}`}
													style={{
														top: first.top + 4,
														height: h,
														backgroundColor: `color-mix(in oklab, ${look.color} ${live ? 34 : 20}%, var(--color-base-100))`,
														color: `color-mix(in oklab, ${look.color} 70%, var(--color-base-content))`,
														["--tw-ring-color" as string]: look.color
													}}
												>
													<span className={`text-sm font-medium ${h < 90 ? "line-clamp-1" : "line-clamp-2"}`}>{look.title}</span>
													<span className="mt-0.5 block truncate text-xs tabular-nums opacity-80">
														{blockTime(b)}
														{h < 90 && b.room ? ` · ${b.room}` : ""}
													</span>
													{h >= 90 && b.room && <span className="block truncate text-xs opacity-65">{b.room}</span>}
													{brush === null && (
														<Link
															to="/courses/$courseId"
															params={{ courseId: String(b.courseId) }}
															className="absolute inset-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2"
															aria-label={`打開${look.title}`}
														/>
													)}
												</motion.div>
											);
										})}
								</AnimatePresence>
								{d === today && shown.length > 0 && minute >= periodStartMinutes(shown[0].code) && minute <= periodEndMinutes(shown.at(-1)!.code) && (
									<div aria-hidden className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-error" style={{ top: yAt(minute) }}>
										<span className="absolute -top-1 -left-1 size-2.5 rounded-full bg-error" />
									</div>
								)}
							</div>
						))}
					</div>
				</section>

				<section className="space-y-2">
					<p className="flex items-center gap-1.5 px-1 text-xs text-base-content/55">
						<PaintBrushIcon size={14} />
						{school.fromMoodle
							? `上課時間已從學校的 Moodle 帶入。要修改時，輸入上課時間（${school.example}），或選一門課當畫筆再點左邊的格子。`
							: "三種設定方式：輸入課綱上的時間代碼（例如 R34-EC114）、點 ↗ 打開課綱查、或選一門課當畫筆再點左邊的格子。"}
					</p>
					{courses.map(c => (
						<CourseScheduleRow key={c.id} course={c} entry={timetable[c.id]} manual={!!manual[c.id]} selected={brush === c.id} onSelect={() => setBrush(b => (b === c.id ? null : c.id))} />
					))}
					{!courses.length && (
						<p className="px-1 text-sm text-base-content/50">
							本學期沒有課程，或都被隱藏了。到{" "}
							<Link to="/courses" className="link">
								課程
							</Link>{" "}
							看看。
						</p>
					)}
				</section>
			</div>
		</div>
	);
}

function CourseScheduleRow({
	course,
	entry,
	manual,
	selected,
	onSelect
}: {
	course: ParsedCourse;
	entry?: TimetableEntry;
	/** Set by the student, as opposed to filled in from Moodle. */
	manual: boolean;
	selected: boolean;
	onSelect: () => void;
}) {
	const look = resolveLook(
		course,
		usePrefs(s => s.courses[course.id])
	);
	const setTimetable = usePrefs(s => s.setTimetable);
	const school = schoolPeriods();
	// NYCU codes carry the room after a dash; schools that fill times from Moodle keep the room out of the code.
	const code = entry ? formatSlots(entry.slots) + (entry.room && !school?.fromMoodle ? `-${entry.room}` : "") : "";
	const [draft, setDraft] = useState<string | null>(null);
	const syllabus = syllabusUrl(course);

	function commit() {
		if (draft === null) return;
		const parsed = parseScheduleCode(draft);
		setTimetable(course.id, parsed.slots.length ? { ...parsed, room: parsed.room ?? (school?.fromMoodle ? entry?.room : undefined) } : null);
		setDraft(null);
	}

	return (
		<motion.div
			layout
			className={`card-quiet flex items-center gap-3 p-2.5 transition ${selected ? "ring-2" : ""}`}
			style={selected ? ({ "--tw-ring-color": look.color } as React.CSSProperties) : undefined}
		>
			<button onClick={onSelect} className="flex min-w-0 grow items-center gap-2.5 text-left" aria-pressed={selected}>
				<CourseGlyph look={look} size="sm" />
				<span className="truncate text-sm font-medium">{look.title}</span>
			</button>
			<input
				className="input input-xs w-28 font-mono uppercase placeholder:normal-case placeholder:font-sans"
				placeholder={school?.example}
				value={draft ?? code}
				onChange={e => setDraft(e.target.value)}
				onBlur={commit}
				onKeyDown={e => e.key === "Enter" && commit()}
				aria-label={`${look.title} 上課時間代碼`}
			/>
			{/* Both slots always render so every row's input lines up. */}
			{syllabus ? (
				<a href={syllabus} target="_blank" rel="noreferrer" className="btn btn-ghost btn-xs btn-square" title="打開課綱查時間" aria-label={`打開${look.title}的課綱`}>
					<ArrowSquareOutIcon size={14} />
				</a>
			) : (
				<span className="size-6 shrink-0" aria-hidden />
			)}
			<button
				className={`btn btn-ghost btn-xs btn-square ${manual ? "" : "invisible"}`}
				onClick={() => setTimetable(course.id, null)}
				aria-label={`清除${look.title}自訂的上課時間`}
				title={school?.fromMoodle ? "清除自訂時間，改用 Moodle 上的時間" : "清除時間"}
				tabIndex={manual ? 0 : -1}
			>
				<ArrowCounterClockwiseIcon size={14} />
			</button>
		</motion.div>
	);
}
