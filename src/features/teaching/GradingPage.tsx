import { useAssignments } from "@/features/assignments/api";
import { t as ta } from "@/features/assignments/messages";
import { SkipToggle, useSkipped } from "@/features/assignments/SkipToggle";
import { useSession } from "@/features/auth/session";
import { FileIcon } from "@/features/course/FileIcon";
import { openFile } from "@/features/course/FilePreview";
import { useCourseIndex } from "@/features/courses/api";
import { useServerReady } from "@/features/server/store";
import { call } from "@/lib/moodle/client";
import { cleanHtml, e3Link, fileExt, humanSize, linkify } from "@/lib/moodle/files";
import type { InlineFile, SubmissionStatus } from "@/lib/moodle/types";
import { ServerError } from "@/lib/server/api";
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
	ClockCountdownIcon,
	PencilSimpleLineIcon,
	TrashIcon,
	UploadSimpleIcon,
	UsersThreeIcon
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
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
import { AllocationDialog } from "./AllocationDialog";
import { BulkDialogs, type BulkKind } from "./BulkDialogs";
import { deleteDraft, type Draft, fetchDraft, invalidateCollab, isHolding, type Lock, saveDraft, useAllocations, useAssignCollab, useGradingLock, useMe } from "./collab-api";
import { t as tk } from "./collab-messages";
import { useConfirm } from "./ConfirmDialog";
import { t } from "./grading-messages";
import { ReleasePanel } from "./ReleasePanel";

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
	const noGrading = useSkipped("grading", Number(cmid));
	useDocumentTitle(a ? t("docTitle", a.name) : undefined);

	// Server version only (useServerReady): allocations, locks and scheduled release.
	const ready = useServerReady();
	const me = useMe();
	const alloc = useAllocations(Number(courseId));
	const collab = useAssignCollab(Number(courseId), a?.id);
	const [allocOpen, setAllocOpen] = useState(false);
	const [mineOnly, setMineOnly] = useState<boolean | null>(null);
	const allocMap = ready ? (alloc.data?.allocations ?? {}) : {};
	const hasAlloc = Object.keys(allocMap).length > 0;
	const inAlloc = hasAlloc && me !== undefined && Object.values(allocMap).includes(me);
	// On by default when there is a split and I'm in it.
	const mine = hasAlloc && (mineOnly ?? inAlloc);
	const graderNames = useMemo(() => new Map((alloc.data?.graders ?? []).map(g => [g.id, displayName(g.name)])), [alloc.data]);
	const release = ready ? collab.data?.release : undefined;
	const holding = isHolding(release);
	const drafts = useMemo(() => new Map<number, Draft>(ready ? (collab.data?.drafts ?? []).map(d => [d.student, d]) : []), [ready, collab.data]);
	const othersLocks = useMemo(() => new Map<number, Lock>(ready ? (collab.data?.locks ?? []).filter(l => l.grader !== me).map(l => [l.student, l]) : []), [ready, collab.data, me]);

	const isGraded = (p: Participant) => {
		if (holding && drafts.has(p.id)) return true;
		const g = grades.data?.[p.id];
		return !!g && Number(g.grade) >= 0;
	};
	const people = useMemo(() => {
		// Suspended enrolments stay visible when they handed something in; E3 hides them.
		const list = (participants.data ?? []).filter(p => (!p.suspended || p.submitted) && (!mine || allocMap[p.id] === me));
		const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
		return list
			.filter(p => terms.every(term => `${displayName(p.fullname)} ${p.email ?? ""} ${sids[p.id] ?? ""}`.toLowerCase().includes(term)))
			.filter(p => (filter === "all" ? true : filter === "missing" ? !p.submitted : filter === "graded" ? isGraded(p) : p.submitted && !isGraded(p)))
			.sort((x, y) => displayName(x.fullname).localeCompare(displayName(y.fullname), "zh-Hant"));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [participants.data, grades.data, filter, q, sids, mine, allocMap, me, holding, drafts]);

	const all = participants.data?.filter(p => !p.suspended || p.submitted) ?? [];
	// The stats follow "my group only".
	const scope = mine ? all.filter(p => allocMap[p.id] === me) : all;
	const counts = {
		submitted: scope.filter(p => p.submitted).length,
		graded: scope.filter(isGraded).length,
		todo: scope.filter(p => p.submitted && !isGraded(p)).length
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
						{noGrading && <span className="mr-2 badge badge-sm badge-soft badge-neutral">{ta("skippedGradingBadge")}</span>}
						{a.duedate ? (
							<>
								{t("due")} <Due ts={a.duedate} /> ·{" "}
							</>
						) : null}
						{max > 0 ? t("outOf", max) : t("rubricScale")}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<SkipToggle kind="grading" cmid={a.cmid} compact />
					<button type="button" className="btn btn-sm" onClick={() => setBulk("download")}>
						<DownloadSimpleIcon size={16} />
						{t("downloadAll")}
					</button>
					<button type="button" className="btn btn-sm" onClick={() => setBulk("csv")}>
						<FileCsvIcon size={16} />
						{t("importCsv")}
					</button>
					{feedbackPlugins(a).files && (
						<button type="button" className="btn btn-sm" disabled={holding} title={holding ? tk("filesHeldTitle") : undefined} onClick={() => setBulk("files")}>
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
				<Stat label={t("submitted")} value={counts.submitted} total={scope.length} />
				<Stat label={t("graded")} value={counts.graded} total={scope.length} />
				<Stat label={t("todo")} value={counts.todo} tone={counts.todo ? "text-warning" : undefined} />
			</div>

			{max <= 0 && (
				<div role="note" className="alert alert-soft alert-warning mb-5 text-sm">
					{t("rubricWarning")}
				</div>
			)}

			{ready && max > 0 && <ReleasePanel courseId={Number(courseId)} assignId={a.id} data={collab.data} names={new Map(all.map(p => [p.id, displayName(p.fullname)]))} />}

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
					{ready && (
						<div className="mb-2 flex flex-wrap items-center gap-1">
							{hasAlloc && (
								<button type="button" aria-pressed={mine} onClick={() => setMineOnly(!mine)} className={`btn btn-xs rounded-full ${mine ? "btn-neutral" : "btn-ghost"}`}>
									<UsersThreeIcon size={13} />
									{tk("mineOnly")}
								</button>
							)}
							<button type="button" className="btn btn-ghost btn-xs rounded-full text-base-content/65" onClick={() => setAllocOpen(true)}>
								{tk("editAllocShort")}
							</button>
						</div>
					)}
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
								const draft = drafts.get(p.id);
								const lock = othersLocks.get(p.id);
								const grader = hasAlloc && !mine ? graderNames.get(allocMap[p.id]) : undefined;
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
											{p.submitted && <span className="sr-only">{holding && drafts.has(p.id) ? tk("heldGraded") : graded ? t("graded") : t("todo")}</span>}
											<span className="min-w-0 grow">
												<span className="block truncate">{displayName(p.fullname)}</span>
												<span className="block truncate text-[0.7rem] text-base-content/65">
													{sids[p.id]}
													{isAuditor(p) && ` · ${t("auditor")}`}
													{p.suspended && <span className="text-warning"> · {t("suspended")}</span>}
													{p.outsideTable && !p.suspended && <span className="text-warning"> · {t("outsideTable")}</span>}
													{grader && ` · ${tk("graderOf", grader)}`}
												</span>
												{lock && (
													<span className="mt-0.5 flex items-center gap-1 text-[0.7rem] text-info">
														<PencilSimpleLineIcon size={11} />
														{tk("isGrading", displayName(lock.graderName))}
													</span>
												)}
												{draft && (
													<span className="mt-0.5 flex items-center gap-1 text-[0.7rem] text-base-content/65">
														<ClockCountdownIcon size={11} />
														{holding ? tk("heldGraded") : tk("draftLeft")}
													</span>
												)}
											</span>
											{holding && draft ? (
												<span className="text-xs tabular-nums text-base-content/65">{draft.grade ?? "–"}</span>
											) : graded ? (
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
					{current ? (
						<StudentPanel
							key={current.id}
							assignmentId={a.id}
							p={current}
							max={max}
							onDone={() => step(1)}
							onBack={() => pick(undefined)}
							holding={holding}
							draft={ready ? drafts.get(current.id) : undefined}
							listLock={othersLocks.get(current.id)}
						/>
					) : (
						<Empty title={t("pickStudent")} />
					)}
				</section>
			</div>

			<BulkDialogs kind={bulk} onClose={() => setBulk(null)} assignment={a} participants={all} grades={grades.data ?? {}} holding={holding} />
			{ready && <AllocationDialog courseId={Number(courseId)} open={allocOpen} onClose={() => setAllocOpen(false)} />}
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

const gradeLabel = (g: string | number | null | undefined) => (g !== null && g !== undefined && Number(g) >= 0 ? String(Number(g)) : t("ungraded"));

interface PanelProps {
	assignmentId: number;
	p: Participant;
	max: number;
	onDone: () => void;
	onBack: () => void;
	/** Server version: a release is scheduled, so saving holds the grade on the EM3 server. */
	holding?: boolean;
	/** Server version: this student's held grade. */
	draft?: Draft;
	/** Server version: someone else's lock on this student, from the polled list. */
	listLock?: Lock;
}

function StudentPanel({ assignmentId, p, max, onDone, onBack, holding = false, draft, listLock }: PanelProps) {
	const { courseId, cmid } = useParams({ from: "/app/courses/$courseId/assign/$cmid/grade" });
	const qc = useQueryClient();
	const ready = useServerReady();
	const me = useMe();
	const myMoodleId = useSession(s => s.userid);
	const serverLock = useGradingLock(Number(courseId), assignmentId, p.id);
	const holder = serverLock && serverLock.grader !== me ? serverLock : listLock;
	const [ask, confirmDialog] = useConfirm();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [savedHeld, setSavedHeld] = useState(false);
	// What the form was loaded from, to notice someone else saving in between.
	const baseline = useRef<{ time: number; draftAt: number | null; fromDraft: boolean }>({ time: 0, draftAt: null, fromDraft: false });
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
		// While a release is held, the held grade is the latest one.
		const fromDraft = holding && !!draft;
		const g = fromDraft ? (draft!.grade === null ? "" : String(draft!.grade)) : existingGrade !== undefined && Number(existingGrade) >= 0 ? String(Number(existingGrade)) : "";
		setGrade(g);
		setComment(htmlToMarkdownish(fromDraft ? (draft!.feedback ?? "") : feedbackComment(st)));
		setKeep(feedbackFiles(st));
		setVersion(v => v + 1);
		setLoaded(true);
		baseline.current = { time: st.feedback?.grade?.timemodified ?? 0, draftAt: draft?.updatedAt ?? null, fromDraft };
		requestAnimationFrame(() => gradeInput.current?.focus());
	}, [st, loaded, existingGrade, holding, draft]);

	/** Re-reads the student from Moodle (read-only) and resets the form to it. */
	async function reload() {
		await status.refetch();
		void invalidateCollab(qc, assignmentId);
		setLoaded(false);
		setCommentDirty(false);
		setAddFiles([]);
	}

	const gradeNum = grade.trim() === "" ? null : Number(grade);
	const invalid = gradeNum !== null && (Number.isNaN(gradeNum) || gradeNum < 0 || gradeNum > max);
	const sub = st?.lastattempt?.submission;
	const text = onlineText(st);
	const files = submittedFiles(st);

	async function submit(next: boolean) {
		if (invalid || !a || busy) return;
		setBusy(true);
		setError(null);
		setSaved(false);
		try {
			if (await write()) {
				setSaved(true);
				setCommentDirty(false);
				setAddFiles([]);
				if (next) onDone();
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	}

	/** Saves to Moodle, or to the EM3 server while a release is held. False when the user backed out. */
	async function write(): Promise<boolean> {
		if (holder && (await ask({ title: tk("confirmTitle"), body: tk("confirmLocked", displayName(holder.graderName)), confirm: tk("saveAnyway") })) !== "ok") return false;
		// Untouched comments go back byte-for-byte so Moodle does not treat them as edited.
		const untouched = baseline.current.fromDraft ? (draft?.feedback ?? "") : feedbackComment(st);
		const commentHtml = commentDirty ? (comment.trim() ? markdownToHtml(comment) : "") : untouched;
		if (holding) {
			const input = { grade: gradeNum, feedback: plugins.comments ? commentHtml : null };
			try {
				const r = await saveDraft(Number(courseId), a!.id, p.id, { ...input, expectedUpdatedAt: baseline.current.draftAt });
				baseline.current.draftAt = r.draft.updatedAt;
			} catch (e) {
				if (!(e instanceof ServerError && e.status === 409)) throw e;
				const other = await fetchDraft(Number(courseId), a!.id, p.id);
				const choice = await ask({
					title: tk("confirmTitle"),
					body: tk("confirmDraftChanged", displayName(other?.graderName ?? ""), gradeLabel(other?.grade)),
					confirm: tk("saveAnyway"),
					alt: tk("loadLatest")
				});
				if (choice === "alt") await reload();
				if (choice !== "ok") return false;
				baseline.current.draftAt = (await saveDraft(Number(courseId), a!.id, p.id, input)).draft.updatedAt;
			}
			void invalidateCollab(qc, a!.id);
			setSavedHeld(true);
			return true;
		}
		// Someone may have saved this student on E3 (or in EM3) since it was opened.
		const fresh = await call<SubmissionStatus>("mod_assign_get_submission_status", { assignid: a!.id, userid: p.id });
		const g = fresh.feedback?.grade;
		if (g && g.timemodified > baseline.current.time && g.grader !== myMoodleId) {
			const choice = await ask({ title: tk("confirmTitle"), body: tk("confirmChanged", gradeLabel(existingGrade), gradeLabel(g.grade)), confirm: tk("saveAnyway"), alt: tk("loadLatest") });
			if (choice === "alt") await reload();
			if (choice !== "ok") return false;
		}
		await save.mutateAsync({
			userid: p.id,
			grade: gradeNum,
			commentHtml,
			files: plugins.files ? addFiles : undefined,
			keepFiles: plugins.files && (addFiles.length || keep.length !== feedbackFiles(st).length) ? keep : undefined
		});
		baseline.current.time = Math.floor(Date.now() / 1000);
		setSavedHeld(false);
		// A grade written straight to E3 replaces any unreleased one, so "write now" can't undo it later.
		if (ready && draft) {
			await deleteDraft(Number(courseId), a!.id, p.id).catch(() => {});
			void invalidateCollab(qc, a!.id);
		}
		return true;
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
			{confirmDialog}

			<aside className="card-quiet space-y-4 self-start p-4 xl:sticky xl:top-6">
				<p role="status" className={holder ? "flex items-start gap-1.5 rounded-box bg-info/10 p-2 text-xs" : "sr-only"}>
					{holder && (
						<>
							<PencilSimpleLineIcon size={14} className="mt-0.5 shrink-0 text-info" />
							{tk("someoneGrading", displayName(holder.graderName))}
						</>
					)}
				</p>
				{!holding && draft && (
					<p className="flex items-start gap-1.5 rounded-box bg-warning/10 p-2 text-xs">
						<ClockCountdownIcon size={14} className="mt-0.5 shrink-0 text-warning" />
						{tk("draftPending", gradeLabel(draft.grade))}
					</p>
				)}
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
						{holding && <p className="mb-1 text-xs text-base-content/65">{tk("filesNotScheduled")}</p>}
						<ul className="space-y-1 text-sm">
							{keep.map(f => (
								<li key={f.fileurl} className="flex items-center gap-2">
									<FileIcon ext={fileExt(f.filename)} size={16} />
									<span className="min-w-0 grow truncate">{f.filename}</span>
									<button type="button" className="btn btn-ghost btn-xs btn-square" disabled={holding} onClick={() => setKeep(k => k.filter(x => x !== f))} aria-label={t("removeFile", f.filename)}>
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
						<button type="button" className="btn btn-ghost btn-sm mt-1 w-full border-dashed border-base-content/15" disabled={holding} onClick={() => fileInput.current?.click()}>
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
						disabled={busy || invalid || max <= 0}
						onClick={() => void submit(true)}
						aria-keyshortcuts={MOD_LABEL === "⌘" ? "Meta+Enter" : "Control+Enter"}
					>
						{busy ? (
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
					<button type="button" className="btn btn-ghost btn-sm" disabled={busy || invalid || max <= 0} onClick={() => void submit(false)}>
						{t("saveOnly")}
					</button>
					<p role="status" className={saved && !busy ? "flex items-center gap-1 text-xs text-success" : "sr-only"}>
						{saved && !busy && (
							<>
								<CheckCircleIcon size={14} weight="fill" />
								{savedHeld ? tk("savedHeld") : t("savedToE3")}
							</>
						)}
					</p>
					<p role="alert" className={error ? "text-xs text-error" : "sr-only"}>
						{error && t("saveFailed", error)}
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
