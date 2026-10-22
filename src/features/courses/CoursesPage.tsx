import { isOpenTask, useTasks } from "@/features/assignments/tasks";
import { usePrefs } from "@/features/preferences/store";
import { getLanguage } from "@/i18n";
import { ErrorNote, Lines, PageTitle } from "@/shared/ui/States";
import { CaretDownIcon, EyeIcon, EyeSlashIcon, MagnifyingGlassIcon, PushPinIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { useCourseIndex } from "./api";
import { altName, CourseGlyph, defaultTitle, resolveLook } from "./look";
import { t } from "./messages";
import { type CourseKind, kindLabel, listSemesters, type ParsedCourse } from "./parse";

interface Group {
	id: string;
	label: string;
	short: string;
	current?: boolean;
	courses: ParsedCourse[];
}

/** Every course on one page, grouped by semester (newest first), then micro-credit, online and other courses. */
export function CoursesPage() {
	const { list, current, isPending, error } = useCourseIndex();
	const looks = usePrefs(s => s.courses);
	const [q, setQ] = useState("");
	const [showHidden, setShowHidden] = useState(false);

	const { tasks } = useTasks();
	const openByCourse = useMemo(() => {
		const m = new Map<number, number>();
		for (const t of tasks.filter(isOpenTask)) m.set(t.course.id, (m.get(t.course.id) ?? 0) + 1);
		return m;
	}, [tasks]);

	const { groups, hidden } = useMemo(() => {
		const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
		const match = (c: ParsedCourse) => {
			const look = resolveLook(c, looks[c.id]);
			const hay = `${look.title} ${c.name} ${c.nameEn ?? ""} ${c.code ?? ""} ${c.semester?.code ?? ""} ${c.semester?.shortLabel ?? ""}`.toLowerCase();
			return terms.every(term => hay.includes(term));
		};
		const collation = getLanguage() === "en" ? "en" : "zh-Hant";
		const order = (a: ParsedCourse, b: ParsedCourse) => Number(!!looks[b.id]?.pinned) - Number(!!looks[a.id]?.pinned) || defaultTitle(a).localeCompare(defaultTitle(b), collation);
		const visible = list.filter(c => !looks[c.id]?.hidden && match(c));
		const groups: Group[] = [
			...listSemesters(list).map(s => ({
				id: `sem-${s.code}`,
				label: s.label,
				short: s.shortLabel,
				current: s.code === current?.code,
				courses: visible.filter(c => c.semester?.code === s.code).sort(order)
			})),
			...(["micro", "online", "other"] as CourseKind[]).map(k => ({ id: `kind-${k}`, label: kindLabel(k), short: kindLabel(k), courses: visible.filter(c => c.kind === k).sort(order) }))
		].filter(g => g.courses.length);
		return { groups, hidden: list.filter(c => looks[c.id]?.hidden && match(c)).sort(order) };
	}, [list, looks, current, q]);

	if (error) return <ErrorNote error={error} />;

	function jump(id: string) {
		const el = document.getElementById(id);
		el?.scrollIntoView({ behavior: "smooth", block: "start" });
		el?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
	}

	return (
		<div>
			<PageTitle title={t("title")} subtitle={t("subtitle", list.length)}>
				<label className="input input-sm w-full sm:w-64">
					<MagnifyingGlassIcon size={15} className="opacity-50" />
					<input data-search type="search" placeholder={t("searchPlaceholder")} value={q} onChange={e => setQ(e.target.value)} aria-label={t("searchLabel")} />
					<kbd className="kbd kbd-xs" aria-hidden>
						F
					</kbd>
				</label>
			</PageTitle>
			<p role="status" className="sr-only">
				{q && !isPending
					? t(
							"resultCount",
							groups.reduce((n, g) => n + g.courses.length, 0)
						)
					: ""}
			</p>

			{groups.length > 1 && (
				<nav aria-label={t("jumpNav")} className="sticky top-[3.25rem] z-20 -mx-4 mb-6 flex gap-1.5 overflow-x-auto bg-base-200/80 px-4 py-2 backdrop-blur-xl scrollbar-none sm:mx-0 sm:px-0 lg:top-0">
					{groups.map(g => (
						<button type="button" key={g.id} onClick={() => jump(g.id)} className={`btn btn-sm shrink-0 rounded-full ${g.current ? "btn-neutral" : "btn-ghost border-base-content/10"}`}>
							{g.short}
							{g.current && <span className="sr-only">{t("currentSr")}</span>}
							<span className="text-xs opacity-75" aria-hidden>
								{g.courses.length}
							</span>
							<span className="sr-only">{t("courseCount", g.courses.length)}</span>
						</button>
					))}
				</nav>
			)}

			{isPending ? (
				<Lines n={6} />
			) : (
				<div className="space-y-10">
					{groups.map(g => (
						<section key={g.id} id={g.id} className="scroll-mt-20 lg:scroll-mt-16">
							<h2 tabIndex={-1} className="mb-3 flex items-baseline gap-2 px-1 outline-none">
								<span className="text-lg font-semibold tracking-tight">{g.label}</span>
								{g.current && <span className="badge badge-sm badge-primary badge-soft">{t("thisSemester")}</span>}
								<span className="text-sm text-base-content/65">{t("courseCount", g.courses.length)}</span>
							</h2>
							<CourseGrid courses={g.courses} open={openByCourse} />
						</section>
					))}
					{!groups.length && <p className="py-16 text-center text-base-content/65">{t("noMatch", q)}</p>}

					{hidden.length > 0 && (
						<section>
							<button type="button" className="flex items-center gap-2 px-1 text-sm text-base-content/65 hover:text-base-content" onClick={() => setShowHidden(v => !v)} aria-expanded={showHidden}>
								<CaretDownIcon size={14} className={`transition ${showHidden ? "" : "-rotate-90"}`} />
								{t("hiddenCount", hidden.length)}
							</button>
							{showHidden && (
								<div className="mt-3">
									<CourseGrid courses={hidden} open={openByCourse} showSemester />
								</div>
							)}
						</section>
					)}
				</div>
			)}
		</div>
	);
}

function CourseGrid({ courses, open, showSemester = false }: { courses: ParsedCourse[]; open: Map<number, number>; showSemester?: boolean }) {
	return (
		<motion.ul layout className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" initial="i" animate="a" variants={{ a: { transition: { staggerChildren: 0.02 } } }}>
			{courses.map(c => (
				<CourseCard key={c.id} c={c} open={open.get(c.id) ?? 0} showSemester={showSemester} />
			))}
		</motion.ul>
	);
}

function CourseCard({ c, open, showSemester }: { c: ParsedCourse; open: number; showSemester: boolean }) {
	const overrides = usePrefs(s => s.courses[c.id]);
	const look = resolveLook(c, overrides);
	const alt = altName(c, look);
	const setCourse = usePrefs(s => s.setCourse);
	return (
		<motion.li layout variants={{ i: { opacity: 0, y: 10 }, a: { opacity: 1, y: 0 } }} className="group relative">
			<Link data-nav to="/courses/$courseId" params={{ courseId: String(c.id) }} className="card-quiet flex h-full items-start gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-lg">
				<CourseGlyph look={look} />
				<span className="min-w-0 grow pr-12">
					<span className="block truncate font-semibold" lang={look.titleLang}>
						{look.title}
					</span>
					{alt && (
						<span className="block truncate text-xs text-base-content/65" lang={alt.lang}>
							{alt.text}
						</span>
					)}
					<span className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-base-content/65">
						{showSemester && <span className="badge badge-xs badge-ghost">{c.semester?.shortLabel ?? kindLabel(c.kind)}</span>}
						{c.code && <span className="tabular-nums">{c.code}</span>}
						{open > 0 && <span className="badge badge-xs badge-soft badge-info">{t("openTasks", open)}</span>}
					</span>
				</span>
			</Link>
			<div className="absolute top-2 right-2 flex gap-0.5 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
				<button
					type="button"
					className="btn btn-ghost btn-xs btn-square"
					onClick={() => setCourse(c.id, { pinned: !look.pinned })}
					aria-label={look.pinned ? t("unpin", look.title) : t("pin", look.title)}
					title={look.pinned ? t("unpinTip") : t("pinTip")}
				>
					<PushPinIcon size={14} weight={look.pinned ? "fill" : "regular"} />
				</button>
				<button
					type="button"
					className="btn btn-ghost btn-xs btn-square"
					onClick={() => setCourse(c.id, { hidden: !look.hidden })}
					aria-label={look.hidden ? t("unhide", look.title) : t("hide", look.title)}
					title={look.hidden ? t("unhideTip") : t("hideTip")}
				>
					{look.hidden ? <EyeIcon size={14} /> : <EyeSlashIcon size={14} />}
				</button>
			</div>
			{look.pinned && <PushPinIcon size={12} weight="fill" className="absolute top-3 right-3 text-base-content/65 group-focus-within:hidden group-hover:hidden" />}
		</motion.li>
	);
}
