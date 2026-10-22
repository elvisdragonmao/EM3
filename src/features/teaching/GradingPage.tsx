import { useAssignments } from "@/features/assignments/api";
import { FileIcon } from "@/features/course/FileIcon";
import { openFile } from "@/features/course/FilePreview";
import { useCourseIndex } from "@/features/courses/api";
import { cleanHtml, e3Link, fileExt, humanSize, linkify } from "@/lib/moodle/files";
import type { InlineFile } from "@/lib/moodle/types";
import { fullDateTime } from "@/lib/time/relative";
import { MarkdownEditor, markdownToHtml } from "@/shared/editor/MarkdownEditor";
import { MOD_LABEL, useHotkeys } from "@/shared/keyboard/hotkeys";
import { usePrefs } from "@/features/preferences/store";
import { tc } from "@/i18n/common";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { CourseTag } from "@/shared/ui/CourseTag";
import { Empty, ErrorNote, Lines } from "@/shared/ui/States";
import { Ago, Due } from "@/shared/ui/Time";
import {
	ArrowLeftIcon,
	ArrowSquareOutIcon,
	CheckCircleIcon,
	CloudArrowUpIcon,
	DownloadSimpleIcon,
	FileCsvIcon,
	HourglassIcon,
	MagnifyingGlassIcon,
	TrashIcon,
	UploadSimpleIcon
} from "@phosphor-icons/react";
import { useNavigate, useParams, useRouter, useSearch } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
	displayName,
	feedbackComment,
	feedbackFiles,
	feedbackPlugins,
	onlineText,
	type Participant,
	submittedFiles,
	useGrades,
	isAuditor,
	useRoster,
	useSaveGrade,
	useStudentIds,
	useStudentStatus
} from "./api";
import { BulkDialogs, type BulkKind } from "./BulkDialogs";
import { t } from "./grading-messages";

type Filter = "all" | "todo" | "graded" | "missing";
const FILTERS: Filter[] = ["todo", "graded", "missing", "all"];

export function GradingPage() {
	const { courseId, cmid } = useParams({ from: "/app/courses/$courseId/assign/$cmid/grade" });
	const { student } = useSearch({ from: "/app/courses/$courseId/assign/$cmid/grade" });
	const navigate = useNavigate();
	const router = useRouter();
	const { byId } = useCourseIndex();
	const course = byId.get(Number(courseId));
	const ids = useMemo(() => [Number(courseId)], [courseId]);
	const assignments = useAssignments(ids);
	const a = assignments.data?.find(x => x.cmid === Number(cmid));
	const participants = useRoster(Number(courseId), a?.id);
	const sids = useStudentIds(Number(courseId)).data ?? {};
	const grades = useGrades(a?.id);
	const [filter, setFilter] = useState<Filter>("todo");
	const [q, setQ] = useState("");
	const [bulk, setBulk] = useState<BulkKind | null>(null);
	useDocumentTitle(a ? t("docTitle", a.name) : undefined);

	const isGraded = (p: Participant) => {
		const g = grades.data?.[p.id];
		return !!g && Number(g.grade) >= 0;
	};
	const people = useMemo(() => {
		// Suspended enrolments stay visible when they handed something in; E3 hides them.
		const list = (participants.data ?? []).filter(p => !p.suspended || p.submitted);
		const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
		return list
			.filter(p => terms.every(term => `${displayName(p.fullname)} ${p.email ?? ""} ${sids[p.id] ?? ""}`.toLowerCase().includes(term)))
			.filter(p => (filter === "all" ? true : filter === "missing" ? !p.submitted : filter === "graded" ? isGraded(p) : p.submitted && !isGraded(p)))
			.sort((x, y) => displayName(x.fullname).localeCompare(displayName(y.fullname), "zh-Hant"));
	}, [participants.data, grades.data, filter, q, sids]);

	const all = participants.data?.filter(p => !p.suspended || p.submitted) ?? [];
	const counts = {
		submitted: all.filter(p => p.submitted).length,
		graded: all.filter(isGraded).length,
		todo: all.filter(p => p.submitted && !isGraded(p)).length
	};
	const current = people.find(p => p.id === student) ?? (student ? all.find(p => p.id === student) : undefined);
	const pick = (id: number | undefined) => navigate({ to: ".", search: { student: id }, replace: true });
	const step = (dir: 1 | -1) => {
		const i = people.findIndex(p => p.id === current?.id);
		const next = people[i < 0 ? 0 : Math.min(people.length - 1, Math.max(0, i + dir))];
		if (next) pick(next.id);
	};

	useHotkeys([
		{ keys: "j", run: () => step(1) },
		{ keys: "k", run: () => step(-1) }
	]);

	useEffect(() => {
		if (!student && people.length) pick(people[0].id);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [people.length]);

	if (assignments.error) return <ErrorNote error={assignments.error} retry={assignments.refetch} />;
	if (assignments.isPending) return <Lines n={6} />;
	if (!a) return <p className="py-20 text-center text-base-content/65">{t("notFound")}</p>;
	const max = a.grade;

	return (
		<div className="mx-auto max-w-7xl">
			<button type="button" onClick={() => router.history.back()} className="btn btn-ghost btn-sm mb-3 -ml-2">
				<ArrowLeftIcon size={16} />
				{t("back")}
			</button>
			<header className="mb-5 flex flex-wrap items-end gap-4">
				<div className="min-w-0 grow">
					{course && <CourseTag course={course} link />}
					<h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{a.name}</h1>
					<p className="mt-1 text-sm text-base-content/65">
						{a.duedate ? (
							<>
								{t("due")} <Due ts={a.duedate} /> ·{" "}
							</>
						) : null}
						{max > 0 ? t("outOf", max) : t("rubricScale")}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<button type="button" className="btn btn-sm" onClick={() => setBulk("download")}>
						<DownloadSimpleIcon size={16} />
						{t("downloadAll")}
					</button>
					<button type="button" className="btn btn-sm" onClick={() => setBulk("csv")}>
						<FileCsvIcon size={16} />
						{t("importCsv")}
					</button>
					{feedbackPlugins(a).files && (
						<button type="button" className="btn btn-sm" onClick={() => setBulk("files")}>
							<UploadSimpleIcon size={16} />
							{t("uploadFeedback")}
						</button>
					)}
					<button type="button" className="btn btn-sm" onClick={() => setBulk("extend")}>
						<HourglassIcon size={16} />
						{t("extend")}
					</button>
					<a className="btn btn-ghost btn-sm" href={e3Link(`/mod/assign/view.php?id=${a.cmid}&action=grading`)} target="_blank" rel="noreferrer">
						<ArrowSquareOutIcon size={16} />
						E3
						<span className="sr-only">
							{t("e3Grading")}
							{tc("openInNewTab")}
						</span>
					</a>
				</div>
			</header>

			<div className="mb-5 grid grid-cols-3 gap-3 sm:max-w-xl">
				<Stat label={t("submitted")} value={counts.submitted} total={all.length} />
				<Stat label={t("graded")} value={counts.graded} total={all.length} />
				<Stat label={t("todo")} value={counts.todo} tone={counts.todo ? "text-warning" : undefined} />
			</div>

			{max <= 0 && (
				<div role="note" className="alert alert-soft alert-warning mb-5 text-sm">
					{t("rubricWarning")}
				</div>
			)}

			<div className="grid grid-cols-1 gap-5 lg:grid-cols-[18rem_1fr]">
				<aside className={`min-w-0 ${current ? "hidden lg:block" : ""}`} aria-label={t("studentsLabel")}>
					<label className="input input-sm mb-2 w-full">
						<MagnifyingGlassIcon size={15} className="opacity-50" />
						<input data-search type="search" aria-label={t("searchLabel")} placeholder={t("searchPlaceholder")} autoComplete="off" value={q} onChange={e => setQ(e.target.value)} />
					</label>
					<fieldset className="mb-2 flex flex-wrap gap-1">
						<legend className="sr-only">{t("filterLabel")}</legend>
						{FILTERS.map(f => (
							<button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`btn btn-xs rounded-full ${filter === f ? "btn-neutral" : "btn-ghost"}`}>
								{t(f)}
							</button>
						))}
					</fieldset>
					<p role="status" className="sr-only">
						{participants.isPending ? "" : people.length ? t("matchCount", people.length) : t("noMatch")}
					</p>
					{participants.isPending ? (
						<Lines n={6} />
					) : (
						<ul className="card-quiet max-h-[70vh] divide-y divide-base-content/[0.06] overflow-y-auto">
							{people.map(p => {
								const g = grades.data?.[p.id];
								const graded = isGraded(p);
								return (
									<li key={p.id}>
										<button
											type="button"
											data-nav
											aria-current={current?.id === p.id ? "true" : undefined}
											onClick={() => pick(p.id)}
											className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm ${current?.id === p.id ? "bg-primary/[0.07]" : "hover:bg-base-content/[0.03]"}`}
										>
											<span className={`size-2 shrink-0 rounded-full ${!p.submitted ? "bg-base-content/15" : graded ? "bg-success" : "bg-warning"}`} />
											{p.submitted && <span className="sr-only">{graded ? t("graded") : t("todo")}</span>}
											<span className="min-w-0 grow">
												<span className="block truncate">{displayName(p.fullname)}</span>
												<span className="block truncate text-[0.7rem] text-base-content/65">
													{sids[p.id]}
													{isAuditor(p) && ` · ${t("auditor")}`}
													{p.suspended && <span className="text-warning"> · {t("suspended")}</span>}
													{p.outsideTable && !p.suspended && <span className="text-warning"> · {t("outsideTable")}</span>}
												</span>
											</span>
											{graded ? (
												<span className="text-xs tabular-nums text-base-content/65">{Number(g!.grade)}</span>
											) : !p.submitted ? (
												<span className="text-xs text-base-content/65">{t("missingShort")}</span>
											) : null}
											{p.grantedextension && (
												<span title={t("extended")}>
													<HourglassIcon size={12} className="text-info" />
													<span className="sr-only">{t("extended")}</span>
												</span>
											)}
										</button>
									</li>
								);
							})}
							{!people.length && <li className="px-3 py-8 text-center text-sm text-base-content/65">{t("noMatch")}</li>}
						</ul>
					)}
					<p className="mt-2 px-1 text-xs text-base-content/65">{t("jkHint")}</p>
				</aside>

				<section className="min-w-0" aria-label={current ? displayName(current.fullname) : undefined}>
					{current ? <StudentPanel key={current.id} assignmentId={a.id} p={current} max={max} onDone={() => step(1)} onBack={() => pick(undefined)} /> : <Empty title={t("pickStudent")} />}
				</section>
			</div>

			<BulkDialogs kind={bulk} onClose={() => setBulk(null)} assignment={a} participants={all} grades={grades.data ?? {}} />
		</div>
	);
}

function Stat({ label, value, total, tone }: { label: string; value: number; total?: number; tone?: string }) {
	return (
		<div className="card-quiet px-4 py-3">
			<p className="text-xs text-base-content/65">{label}</p>
			<p className={`text-2xl font-semibold tabular-nums ${tone ?? ""}`}>
				{value}
				{total !== undefined && <span className="text-sm font-normal text-base-content/65"> / {total}</span>}
			</p>
		</div>
	);
}

function htmlToMarkdownish(html: string) {
	// Existing E3 feedback is HTML; keep it readable when shown in the Markdown editor.
	const doc = new DOMParser().parseFromString(html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n"), "text/html");
	return (doc.body.textContent ?? "").trim();
}

function StudentPanel({ assignmentId, p, max, onDone, onBack }: { assignmentId: number; p: Participant; max: number; onDone: () => void; onBack: () => void }) {
	const { courseId, cmid } = useParams({ from: "/app/courses/$courseId/assign/$cmid/grade" });
	const ids = useMemo(() => [Number(courseId)], [courseId]);
	const a = useAssignments(ids).data?.find(x => x.cmid === Number(cmid));
	const status = useStudentStatus(assignmentId, p.id);
	const save = useSaveGrade(a);
	const plugins = a ? feedbackPlugins(a) : { comments: false, files: false };
	const st = status.data;
	const existingGrade = st?.feedback?.grade?.grade;
	const [grade, setGrade] = useState<string>("");
	const [comment, setComment] = useState<string>("");
	const [version, setVersion] = useState(0);
	const snippets = usePrefs(s => s.snippets);
	const setPref = usePrefs(s => s.set);
	const [commentDirty, setCommentDirty] = useState(false);
	const [loaded, setLoaded] = useState(false);
	const [keep, setKeep] = useState<InlineFile[]>([]);
	const [addFiles, setAddFiles] = useState<File[]>([]);
	const [saved, setSaved] = useState(false);
	const gradeInput = useRef<HTMLInputElement>(null);
	const fileInput = useRef<HTMLInputElement>(null);
	const uid = useId();
	const gradeId = `${uid}-grade`;
	const maxId = `${uid}-max`;
	const errId = `${uid}-err`;
	const feedbackId = `${uid}-feedback`;
	const filesId = `${uid}-files`;

	useEffect(() => {
		if (!st || loaded) return;
		const g = existingGrade !== undefined && Number(existingGrade) >= 0 ? String(Number(existingGrade)) : "";
		setGrade(g);
		setComment(htmlToMarkdownish(feedbackComment(st)));
		setKeep(feedbackFiles(st));
		setVersion(v => v + 1);
		setLoaded(true);
		requestAnimationFrame(() => gradeInput.current?.focus());
	}, [st, loaded, existingGrade]);

	const gradeNum = grade.trim() === "" ? null : Number(grade);
	const invalid = gradeNum !== null && (Number.isNaN(gradeNum) || gradeNum < 0 || gradeNum > max);
	const sub = st?.lastattempt?.submission;
	const text = onlineText(st);
	const files = submittedFiles(st);

	async function submit(next: boolean) {
		if (invalid || !a) return;
		await save.mutateAsync({
			userid: p.id,
			grade: gradeNum,
			// Untouched comments go back byte-for-byte so Moodle does not treat them as edited.
			commentHtml: commentDirty ? (comment.trim() ? markdownToHtml(comment) : "") : feedbackComment(st),
			files: plugins.files ? addFiles : undefined,
			keepFiles: plugins.files && (addFiles.length || keep.length !== feedbackFiles(st).length) ? keep : undefined
		});
		setSaved(true);
		setCommentDirty(false);
		setAddFiles([]);
		if (next) onDone();
	}

	useHotkeys([{ keys: "mod+enter", run: () => void submit(true), inInput: true }]);

	if (status.error) return <ErrorNote error={status.error} retry={status.refetch} />;
	if (status.isPending) return <Lines n={6} />;

	return (
		<motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_22rem]">
			<div className="min-w-0 space-y-4">
				<div className="flex items-center gap-2">
					<button type="button" onClick={onBack} className="btn btn-ghost btn-sm -ml-2 lg:hidden" aria-label={t("backToList")}>
						<ArrowLeftIcon size={16} />
					</button>
					<h2 className="text-xl font-semibold">{displayName(p.fullname)}</h2>
					{p.submitted ? <span className="badge badge-sm badge-soft badge-success">{t("submitted")}</span> : <span className="badge badge-sm badge-soft badge-ghost">{t("missing")}</span>}
					{sub?.timemodified ? (
						<span className="text-xs text-base-content/65" title={fullDateTime(sub.timemodified)}>
							<Ago ts={sub.timemodified} />
							{a?.duedate && sub.timemodified > a.duedate ? <span className="ml-1 text-error">{t("late")}</span> : null}
						</span>
					) : null}
				</div>
				{text && (
					<section className="card-quiet p-5">
						<h3 className="mb-2 text-xs font-semibold text-base-content/65">{t("onlineText")}</h3>
						<div className="prose-e3" dangerouslySetInnerHTML={{ __html: cleanHtml(linkify(text)) }} />
					</section>
				)}
				{files.length > 0 && (
					<section className="card-quiet p-4">
						<h3 className="mb-2 text-xs font-semibold text-base-content/65">{t("submittedFiles")}</h3>
						<FileList files={files} />
					</section>
				)}
				{!text && !files.length && <Empty title={p.submitted ? t("emptySubmission") : t("notYet")} />}
			</div>

			<aside className="card-quiet space-y-4 self-start p-4 xl:sticky xl:top-6">
				{max > 0 && (
					<div>
						<p className="mb-1 text-xs font-semibold text-base-content/65">
							<label htmlFor={gradeId}>{t("score")}</label>
							<span id={maxId}>{t("outOfParen", max)}</span>
						</p>
						<input
							ref={gradeInput}
							id={gradeId}
							className={`input input-lg w-full tabular-nums ${invalid ? "input-error" : ""}`}
							inputMode="decimal"
							autoComplete="off"
							aria-describedby={invalid ? `${maxId} ${errId}` : maxId}
							aria-invalid={invalid || undefined}
							placeholder={t("ungraded")}
							value={grade}
							onChange={e => {
								setGrade(e.target.value);
								setSaved(false);
							}}
							onKeyDown={e => e.key === "Enter" && !e.metaKey && !e.ctrlKey && void submit(true)}
						/>
						<p id={errId} role="alert" className={invalid ? "mt-1 text-xs text-error" : "sr-only"}>
							{invalid ? t("scoreRange", max) : ""}
						</p>
					</div>
				)}
				{plugins.comments && (
					<div role="group" aria-labelledby={feedbackId}>
						<p id={feedbackId} className="mb-1 text-xs font-semibold text-base-content/65">
							{t("feedbackHeading")}
						</p>
						<MarkdownEditor
							value={comment}
							onChange={v => {
								if (v.trim() === comment.trim()) return;
								setComment(v);
								setCommentDirty(true);
								setSaved(false);
							}}
							placeholder={t("feedbackPlaceholder")}
							minHeight="7rem"
							label={t("feedback")}
							version={version}
						/>
						<Snippets
							items={snippets}
							onInsert={snippet => {
								setComment(c => (c.trim() ? `${c.trimEnd()}\n\n${snippet}` : snippet));
								setCommentDirty(true);
								setSaved(false);
								setVersion(v => v + 1);
							}}
							onSave={() => comment.trim() && !snippets.includes(comment.trim()) && setPref("snippets", [...snippets, comment.trim()])}
							onRemove={snippet =>
								setPref(
									"snippets",
									snippets.filter(x => x !== snippet)
								)
							}
						/>
					</div>
				)}
				{plugins.files && (
					<div role="group" aria-labelledby={filesId}>
						<p id={filesId} className="mb-1 text-xs font-semibold text-base-content/65">
							{t("feedbackFiles")}
						</p>
						<ul className="space-y-1 text-sm">
							{keep.map(f => (
								<li key={f.fileurl} className="flex items-center gap-2">
									<FileIcon ext={fileExt(f.filename)} size={16} />
									<span className="min-w-0 grow truncate">{f.filename}</span>
									<button type="button" className="btn btn-ghost btn-xs btn-square" onClick={() => setKeep(k => k.filter(x => x !== f))} aria-label={t("removeFile", f.filename)}>
										<TrashIcon size={13} />
									</button>
								</li>
							))}
							{addFiles.map(f => (
								<li key={f.name + f.size} className="flex items-center gap-2 rounded bg-primary/5 px-1">
									<FileIcon ext={fileExt(f.name)} size={16} />
									<span className="min-w-0 grow truncate">{f.name}</span>
									<button type="button" className="btn btn-ghost btn-xs btn-square" onClick={() => setAddFiles(x => x.filter(y => y !== f))} aria-label={t("removeFile", f.name)}>
										<TrashIcon size={13} />
									</button>
								</li>
							))}
						</ul>
						<button type="button" className="btn btn-ghost btn-sm mt-1 w-full border-dashed border-base-content/15" onClick={() => fileInput.current?.click()}>
							<CloudArrowUpIcon size={16} />
							{t("addFeedbackFile")}
						</button>
						<input ref={fileInput} type="file" multiple hidden onChange={e => e.target.files && (setAddFiles(x => [...x, ...Array.from(e.target.files!)]), (e.target.value = ""))} />
					</div>
				)}
				<div className="flex flex-col gap-2">
					<button
						type="button"
						className="btn btn-primary"
						disabled={save.isPending || invalid || max <= 0}
						onClick={() => void submit(true)}
						aria-keyshortcuts={MOD_LABEL === "⌘" ? "Meta+Enter" : "Control+Enter"}
					>
						{save.isPending ? (
							<>
								<span className="loading loading-spinner loading-sm" aria-hidden="true" />
								<span className="sr-only">{t("saving")}</span>
							</>
						) : (
							t("saveNext")
						)}
						<kbd className="kbd kbd-xs border-primary-content/30 bg-transparent text-primary-content/70" aria-hidden="true">
							{MOD_LABEL}↵
						</kbd>
					</button>
					<button type="button" className="btn btn-ghost btn-sm" disabled={save.isPending || invalid || max <= 0} onClick={() => void submit(false)}>
						{t("saveOnly")}
					</button>
					<p role="status" className={saved && !save.isPending ? "flex items-center gap-1 text-xs text-success" : "sr-only"}>
						{saved && !save.isPending && (
							<>
								<CheckCircleIcon size={14} weight="fill" />
								{t("savedToE3")}
							</>
						)}
					</p>
					<p role="alert" className={save.error ? "text-xs text-error" : "sr-only"}>
						{save.error && t("saveFailed", save.error.message)}
					</p>
				</div>
			</aside>
		</motion.div>
	);
}

/** Reusable comment phrases, stored locally and exported with the rest of the settings. */
function Snippets({ items, onInsert, onSave, onRemove }: { items: string[]; onInsert: (t: string) => void; onSave: () => void; onRemove: (t: string) => void }) {
	const [editing, setEditing] = useState(false);
	return (
		<div className="mt-2">
			<ul className="flex flex-wrap gap-1" aria-label={t("snippets")}>
				{items.map(s => (
					<li key={s} className="group inline-flex max-w-full items-center">
						<button
							type="button"
							className="btn btn-xs max-w-56 justify-start truncate rounded-full font-normal"
							onClick={() => (editing ? onRemove(s) : onInsert(s))}
							title={editing ? t("removeSnippet") : s}
							aria-label={editing ? t("removeSnippetNamed", s) : undefined}
						>
							{editing && <TrashIcon size={11} />}
							<span className="truncate">{s}</span>
						</button>
					</li>
				))}
			</ul>
			<div className="mt-1 flex gap-2 text-xs">
				<button type="button" className="link link-hover text-base-content/65" onClick={onSave}>
					{t("saveSnippet")}
				</button>
				<button type="button" className="link link-hover text-base-content/65" onClick={() => setEditing(e => !e)}>
					{editing ? t("done") : t("manageSnippets")}
				</button>
			</div>
		</div>
	);
}

function FileList({ files }: { files: InlineFile[] }) {
	return (
		<ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
			{files.map(f => {
				const mf = { key: f.fileurl, name: f.filename, url: f.fileurl, size: f.filesize, mime: f.mimetype, ext: fileExt(f.filename), time: f.timemodified, path: "/" };
				return (
					<li key={f.fileurl}>
						<button type="button" onClick={() => openFile(mf)} className="flex w-full items-center gap-3 rounded-xl border hairline bg-base-100 px-3 py-2.5 text-left hover:bg-base-content/[0.03]">
							<FileIcon ext={mf.ext} size={26} />
							<span className="min-w-0">
								<span className="block truncate text-sm font-medium">{f.filename}</span>
								<span className="text-xs text-base-content/65">{humanSize(f.filesize)}</span>
							</span>
						</button>
					</li>
				);
			})}
		</ul>
	);
}
