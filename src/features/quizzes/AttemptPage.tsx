import { Fact } from "@/features/assignments/AssignmentPage";
import { useCourseIndex } from "@/features/courses/api";
import { tc } from "@/i18n/common";
import { e3Link } from "@/lib/moodle/files";
import { deadlinePhrase, fullDateTime, hhmm } from "@/lib/time/relative";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { CourseTag } from "@/shared/ui/CourseTag";
import { E3Away } from "@/shared/ui/LeaveToE3";
import { ErrorNote, Lines } from "@/shared/ui/States";
import { ArrowLeftIcon, ArrowRightIcon, ArrowSquareOutIcon, ClockIcon, FlagIcon, ListChecksIcon, ListNumbersIcon, TimerIcon, WarningIcon } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams, useRouter } from "@tanstack/react-router";
import { type FormEvent, type MouseEvent, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { type Quiz, type QuizAttempt, quizNotes, useQuizAttempts, useQuizzes } from "./api";
import {
	blocksEverywhere,
	collectFields,
	essayValue,
	type Field,
	type FieldLike,
	fieldsKey,
	formatClock,
	isAnswered,
	needsPassword,
	pageCount,
	unanswered,
	warningLevel,
	withFlags,
	wsData
} from "./attempt";
import {
	attemptEndTime,
	attemptPage,
	type AttemptPage as AttemptPageData,
	type AttemptQuestion,
	attemptSummary,
	type Preflight,
	processAttempt,
	saveAttempt,
	startAttemptWith,
	useAttemptSupport
} from "./attemptApi";
import { t } from "./messages";
import { type PreparedQuestion, prepareQuestion } from "./questionHtml";

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const qNumber = (q: Pick<AttemptQuestion, "questionnumber" | "number" | "slot">) => String(q.questionnumber ?? q.number ?? q.slot);
/** Attempts submitted in this tab, so a stale render never reopens them. */
const finishedIds = new Set<number>();
const QUESTION_STRINGS = () => ({ clearChoice: t("clearChoice"), blank: (n: number) => t("blank", n), choose: t("choose") });

/** Answering a quiz in EM3: start or continue, page through, autosave, submit, then back to the review. */
export function AttemptPage() {
	const { courseId, cmid } = useParams({ from: "/app/courses/$courseId/quiz/$cmid/attempt" });
	const router = useRouter();
	const qc = useQueryClient();
	const { byId } = useCourseIndex();
	const course = byId.get(Number(courseId));
	const ids = useMemo(() => [Number(courseId)], [courseId]);
	const quizzes = useQuizzes(ids);
	const quiz = quizzes.data?.find(q => q.coursemodule === Number(cmid));
	const attemptsQ = useQuizAttempts(quiz ? [quiz.id] : []);
	const attempts = useMemo(() => attemptsQ.data?.[quiz?.id ?? 0] ?? [], [attemptsQ.data, quiz?.id]);
	const [started, setStarted] = useState<QuizAttempt | null>(null);
	const unfinished = started ?? attempts.find(a => a.state === "inprogress" || a.state === "overdue");
	const support = useAttemptSupport(quiz, unfinished);
	const [preflight, setPreflight] = useState<Preflight | null>(null);
	const [preflightError, setPreflightError] = useState<string | null>(null);
	// The shell re-keys <main> on navigation and briefly renders the old route again;
	// once we have left for the review, this page must not load the attempt anew.
	const leaving = useLocation({ select: l => !l.pathname.endsWith("/attempt") });
	useDocumentTitle(quiz?.name);

	if (leaving || (unfinished && finishedIds.has(unfinished.id))) return null;
	if (quizzes.error) return <ErrorNote error={quizzes.error} retry={quizzes.refetch} />;
	if (quizzes.isPending || (quiz && (attemptsQ.isPending || support.pending))) return <Lines n={6} />;
	if (!quiz) return <p className="py-20 text-center text-base-content/65">{t("notFound")}</p>;

	const backToQuiz = () => router.navigate({ to: "/courses/$courseId/quiz/$cmid", params: { courseId, cmid } });
	const onFinished = () => {
		if (unfinished) finishedIds.add(unfinished.id);
		void qc.invalidateQueries({ queryKey: ["quiz-attempts"] });
		void qc.invalidateQueries({ queryKey: ["quiz-best"] });
		void qc.invalidateQueries({ queryKey: ["quiz-attempt-access"] });
		void router.navigate({ to: "/courses/$courseId/quiz/$cmid", params: { courseId, cmid }, replace: true });
	};
	const passwordRule = !!support.access && needsPassword(support.access);
	const needPreflight = !!unfinished && passwordRule && support.attemptAccess?.ispreflightcheckrequired !== false;

	let body;
	if (support.error || support.blockers.length) {
		body = <Blocked quiz={quiz} attempts={attempts} support={support} unfinished={unfinished} />;
	} else if (!unfinished) {
		body = (
			<StartScreen
				quiz={quiz}
				attempts={attempts}
				rules={support.access?.accessrules ?? []}
				password={passwordRule}
				onStarted={(a, pf) => {
					setPreflight(pf);
					setStarted(a);
					void qc.invalidateQueries({ queryKey: ["quiz-attempts"] });
				}}
			/>
		);
	} else if (needPreflight && !preflight) {
		body = (
			<PasswordGate
				error={preflightError}
				onSubmit={pf => {
					setPreflightError(null);
					setPreflight(pf);
				}}
			/>
		);
	} else {
		body = (
			<AttemptRunner
				key={unfinished.id}
				quiz={quiz}
				attempt={unfinished}
				preflight={preflight ?? []}
				onPreflightError={
					passwordRule
						? msg => {
								setPreflight(null);
								setPreflightError(msg);
							}
						: undefined
				}
				onFinished={onFinished}
			/>
		);
	}

	return (
		<div className="mx-auto max-w-5xl">
			<button onClick={backToQuiz} className="btn btn-ghost btn-sm mb-4 -ml-2">
				<ArrowLeftIcon size={16} />
				{t("back")}
			</button>
			<header className="mb-6">
				{course && <CourseTag course={course} link />}
				<h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{quiz.name}</h1>
				{unfinished && <p className="mt-1 text-sm text-base-content/65">{t("attemptKicker", unfinished.attempt)}</p>}
			</header>
			{body}
		</div>
	);
}

function Blocked({ quiz, attempts, support, unfinished }: { quiz: Quiz; attempts: QuizAttempt[]; support: ReturnType<typeof useAttemptSupport>; unfinished: QuizAttempt | undefined }) {
	const everywhere = !support.error && support.blockers.every(blocksEverywhere);
	const notice = {
		url: e3Link(`/mod/quiz/view.php?id=${quiz.coursemodule}`),
		title: quiz.name,
		reason: support.blockers.map(b => t("blocker", b)).join(" ") || t("e3Reason"),
		notes: quizNotes(quiz, attempts)
	};
	return (
		<section className="card-quiet max-w-2xl p-5" aria-labelledby="quiz-blocked-title">
			<h2 id="quiz-blocked-title" className="flex items-center gap-2 font-semibold">
				<WarningIcon size={18} className="text-warning" />
				{everywhere ? t("cannotStart") : t("mustUseE3")}
			</h2>
			<ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-base-content/75">
				{support.error && <li>{t("loadFailed", errText(support.error))}</li>}
				{support.blockers.map((b, i) => (
					<li key={i}>
						{t("blocker", b)}
						{(b.kind === "prevented" || b.kind === "noNew") && b.reasons.length > 0 && (
							<ul className="mt-1 list-[circle] pl-5">
								{b.reasons.map(r => (
									<li key={r}>{r}</li>
								))}
							</ul>
						)}
					</li>
				))}
			</ul>
			{(!everywhere || unfinished) && (
				<E3Away notice={notice} className="btn btn-primary mt-4">
					{unfinished ? t("resumeOnE3") : t("takeOnE3")}
					<ArrowSquareOutIcon size={16} />
				</E3Away>
			)}
		</section>
	);
}

function PasswordField({ id, error, autoFocus }: { id: string; error: string | null; autoFocus?: boolean }) {
	return (
		<label className="block">
			<span className="mb-1 block text-sm font-medium">{t("password")}</span>
			<input
				id={id}
				name="quizpassword"
				type="password"
				autoComplete="off"
				className="input w-full"
				autoFocus={autoFocus}
				aria-invalid={error ? true : undefined}
				aria-describedby={error ? `${id}-err` : `${id}-hint`}
			/>
			<span id={`${id}-hint`} className="mt-1 block text-xs text-base-content/65">
				{t("passwordHint")}
			</span>
			{error && (
				<span id={`${id}-err`} role="alert" className="mt-1 block text-xs text-error">
					{error}
				</span>
			)}
		</label>
	);
}

function readPassword(form: HTMLFormElement): Preflight | null {
	const v = (form.elements.namedItem("quizpassword") as HTMLInputElement | null)?.value ?? "";
	return v ? [{ name: "quizpassword", value: v }] : null;
}

function PasswordGate({ error, onSubmit }: { error: string | null; onSubmit: (pf: Preflight) => void }) {
	const id = useId();
	const [missing, setMissing] = useState(false);
	return (
		<form
			className="card-quiet max-w-md space-y-4 p-5"
			aria-labelledby={`${id}-title`}
			onSubmit={e => {
				e.preventDefault();
				const pf = readPassword(e.currentTarget);
				setMissing(!pf);
				if (pf) onSubmit(pf);
			}}
		>
			<h2 id={`${id}-title`} className="font-semibold">
				{t("passwordTitle")}
			</h2>
			<PasswordField id={`${id}-pw`} error={missing ? t("passwordMissing") : error} autoFocus />
			<button className="btn btn-primary">{t("continueInEm3")}</button>
		</form>
	);
}

function StartScreen({ quiz, attempts, rules, password, onStarted }: { quiz: Quiz; attempts: QuizAttempt[]; rules: string[]; password: boolean; onStarted: (a: QuizAttempt, pf: Preflight) => void }) {
	const dialog = useRef<HTMLDialogElement>(null);
	const id = useId();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const used = attempts.filter(a => a.state !== "abandoned").length;
	const left = quiz.attempts ? quiz.attempts - used : null;
	const minutes = quiz.timelimit ? Math.round(quiz.timelimit / 60) : null;

	async function start(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		let pf: Preflight = [];
		if (password) {
			const p = readPassword(e.currentTarget);
			if (!p) return setError(t("passwordMissing"));
			pf = p;
		}
		setBusy(true);
		setError(null);
		try {
			const a = await startAttemptWith(quiz.id, pf);
			dialog.current?.close();
			onStarted(a, pf);
		} catch (err) {
			setError(t("startFailed", errText(err)));
		} finally {
			setBusy(false);
		}
	}

	return (
		<section className="max-w-3xl space-y-4" aria-labelledby={`${id}-start`}>
			<h2 id={`${id}-start`} className="sr-only">
				{t("startButton")}
			</h2>
			<dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
				<Fact
					icon={<ClockIcon size={16} />}
					label={t("closesAt")}
					value={quiz.timeclose ? deadlinePhrase(quiz.timeclose) : t("noDeadline")}
					hint={quiz.timeclose ? fullDateTime(quiz.timeclose) : undefined}
				/>
				<Fact icon={<TimerIcon size={16} />} label={t("timeLimit")} value={minutes ? t("minutes", minutes) : t("noTimeLimit")} />
				<Fact icon={<ListNumbersIcon size={16} />} label={t("attempts")} value={quiz.attempts ? `${used} / ${quiz.attempts}` : t("attemptCount", used)} />
			</dl>
			{rules.length > 0 && (
				<div className="card-quiet p-4 text-sm">
					<h3 className="mb-1 font-semibold text-base-content/65">{t("e3Rules")}</h3>
					<ul className="list-disc space-y-1 pl-5 text-base-content/80">
						{rules.map(r => (
							<li key={r}>{r}</li>
						))}
					</ul>
				</div>
			)}
			<button
				className="btn btn-primary"
				onClick={() => {
					setError(null);
					dialog.current?.showModal();
				}}
			>
				{t("startButton")}
			</button>

			<dialog ref={dialog} className="modal modal-bottom sm:modal-middle" aria-labelledby={`${id}-title`}>
				<form className="modal-box max-w-md" onSubmit={start}>
					<h2 id={`${id}-title`} className="text-lg font-semibold">
						{t("startConfirmTitle")}
					</h2>
					<ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-base-content/75">
						<li className={minutes ? "font-medium text-base-content" : undefined}>{t("startTimeLimit", minutes)}</li>
						{quiz.timeclose > 0 && <li>{t("startCloses", fullDateTime(quiz.timeclose))}</li>}
						<li>{t("usesAttempt", left !== null ? left - 1 : null)}</li>
						<li>{t("startAutosave")}</li>
					</ul>
					{password && (
						<div className="mt-4">
							<PasswordField id={`${id}-pw`} error={error} />
						</div>
					)}
					{!password && (
						<p role="alert" className={error ? "mt-3 text-sm text-error" : "sr-only"}>
							{error ?? ""}
						</p>
					)}
					<div className="modal-action">
						<button type="button" className="btn btn-ghost" onClick={() => dialog.current?.close()}>
							{tc("cancel")}
						</button>
						<button className="btn btn-primary" disabled={busy}>
							{busy && <span className="loading loading-spinner loading-xs" />}
							{busy ? t("starting") : t("startButton")}
						</button>
					</div>
				</form>
				<form method="dialog" className="modal-backdrop">
					<button>{tc("close")}</button>
				</form>
			</dialog>
		</section>
	);
}

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: number } | { kind: "error"; message: string };

function AttemptRunner({
	quiz,
	attempt,
	preflight,
	onPreflightError,
	onFinished
}: {
	quiz: Quiz;
	attempt: QuizAttempt;
	preflight: Preflight;
	onPreflightError?: (msg: string) => void;
	onFinished: () => void;
}) {
	const id = attempt.id;
	const sequential = quiz.navmethod === "sequential";
	const [page, setPage] = useState(attempt.currentpage ?? 0);
	const [view, setView] = useState<"page" | "summary">(attempt.state === "overdue" ? "summary" : "page");
	const [data, setData] = useState<{ page: AttemptPageData; prepared: PreparedQuestion[] } | null>(null);
	const [summary, setSummary] = useState<AttemptQuestion[] | null>(null);
	const [endTime, setEndTime] = useState(0);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [busy, setBusy] = useState<"load" | "finish" | null>("load");
	const [save, setSave] = useState<SaveState>({ kind: "idle" });
	const [actionError, setActionError] = useState<string | null>(null);
	const [flags, setFlags] = useState<Record<string, boolean>>({});
	const [overdue, setOverdue] = useState(attempt.state === "overdue");
	const [timeUpNote, setTimeUpNote] = useState(false);
	const formRef = useRef<HTMLFormElement>(null);
	const summaryHeading = useRef<HTMLHeadingElement>(null);
	const dataRef = useRef(data);
	const flagsRef = useRef(flags);
	const lastSaved = useRef("");
	const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const queue = useRef<Promise<unknown>>(Promise.resolve());
	const focusSlot = useRef<number | null>(null);
	const finishing = useRef(false);
	const submitDialog = useRef<HTMLDialogElement>(null);
	const dialogId = useId();
	dataRef.current = data;
	flagsRef.current = flags;

	/** Writes to one attempt run one at a time, so an autosave never races a page change. */
	const enqueue = useCallback(<T,>(fn: () => Promise<T>) => {
		const p = queue.current.then(fn, fn);
		queue.current = p.catch(() => undefined);
		return p;
	}, []);

	const collect = useCallback((): Field[] => {
		const form = formRef.current;
		const d = dataRef.current;
		if (!form || !d) return [];
		const essays = Object.assign({}, ...d.prepared.map(p => p.essays)) as PreparedQuestion["essays"];
		const fields = collectFields(Array.from(form.elements) as unknown as FieldLike[], el => (el.tagName === "TEXTAREA" && essays[el.name] ? essayValue(el.value, essays[el.name]) : el.value));
		return withFlags(fields, flagsRef.current);
	}, []);

	const slots = () => dataRef.current?.page.questions.map(q => q.slot) ?? [];

	const refreshSummary = useCallback(async () => {
		try {
			setSummary((await attemptSummary(id, preflight)).questions);
		} catch {
			// The navigator just keeps its last state.
		}
	}, [id, preflight]);

	const loadPage = useCallback(
		async (p: number, focus: number | null) => {
			setBusy("load");
			try {
				const d = await attemptPage(id, p, preflight);
				const strings = QUESTION_STRINGS();
				const prepared = d.questions.map(q => prepareQuestion(q, strings));
				const f: Record<string, boolean> = {};
				prepared.forEach((pq, i) => pq.flagName && (f[pq.flagName] = !!d.questions[i].flagged));
				focusSlot.current = focus;
				setFlags(f);
				setData({ page: d, prepared });
				setPage(p);
				setView("page");
				setLoadError(null);
				void refreshSummary();
			} catch (e) {
				if (!dataRef.current && onPreflightError) onPreflightError(errText(e));
				else setLoadError(errText(e));
			} finally {
				setBusy(null);
			}
		},
		[id, preflight, refreshSummary, onPreflightError]
	);

	const showSummary = useCallback(async () => {
		setBusy("load");
		try {
			setSummary((await attemptSummary(id, preflight)).questions);
			setView("summary");
			setLoadError(null);
			requestAnimationFrame(() => summaryHeading.current?.focus());
		} catch (e) {
			if (!dataRef.current && onPreflightError) onPreflightError(errText(e));
			else setLoadError(errText(e));
		} finally {
			setBusy(null);
		}
	}, [id, preflight, onPreflightError]);

	const loadedOnce = useRef(false);
	useEffect(() => {
		// StrictMode runs this twice in development; one get_attempt_data is enough.
		if (loadedOnce.current) return;
		loadedOnce.current = true;
		void (view === "summary" ? showSummary() : loadPage(page, null));
		attemptEndTime(quiz.id, id)
			.then(setEndTime)
			.catch(() => undefined);
		// Only on mount: later loads are driven by navigation.
	}, []);

	// The rendered page is the baseline autosave compares against; focus follows a page change.
	useLayoutEffect(() => {
		if (!data) return;
		lastSaved.current = fieldsKey(collect());
		const slot = focusSlot.current;
		focusSlot.current = null;
		if (slot === null) return;
		const el = slot === -1 ? formRef.current?.querySelector<HTMLElement>("[id^=quiz-q-]") : document.getElementById(`quiz-q-${slot}`);
		el?.focus();
	}, [data, collect]);

	const autosave = useCallback(() => {
		clearTimeout(saveTimer.current);
		if (!dataRef.current || finishing.current) return;
		const fields = collect();
		const key = fieldsKey(fields);
		if (key === lastSaved.current) return;
		setSave({ kind: "saving" });
		enqueue(() => saveAttempt(id, wsData(fields, slots()), preflight))
			.then(() => {
				lastSaved.current = key;
				setSave({ kind: "saved", at: Date.now() });
				void refreshSummary();
			})
			.catch(e => {
				setSave({ kind: "error", message: errText(e) });
				saveTimer.current = setTimeout(autosave, 15_000);
			});
	}, [collect, enqueue, id, preflight, refreshSummary]);

	const scheduleSave = useCallback(() => {
		clearTimeout(saveTimer.current);
		saveTimer.current = setTimeout(autosave, 2_000);
	}, [autosave]);

	// Save before the tab is hidden or closed, and warn if that may not finish.
	useEffect(() => {
		const onHide = () => document.visibilityState === "hidden" && autosave();
		const onUnload = (e: BeforeUnloadEvent) => {
			if (dataRef.current && !finishing.current && fieldsKey(collect()) !== lastSaved.current) e.preventDefault();
		};
		document.addEventListener("visibilitychange", onHide);
		window.addEventListener("beforeunload", onUnload);
		return () => {
			document.removeEventListener("visibilitychange", onHide);
			window.removeEventListener("beforeunload", onUnload);
			autosave();
			clearTimeout(saveTimer.current);
		};
	}, [autosave, collect]);

	/** Processes the current page (as Moodle does on page change), then goes on. */
	async function go(target: number | "summary", focus: number | null = null) {
		clearTimeout(saveTimer.current);
		setActionError(null);
		if (view === "page" && dataRef.current) {
			try {
				const fields = collect();
				await enqueue(() => processAttempt(id, wsData(fields, slots()), preflight));
				lastSaved.current = fieldsKey(fields);
			} catch (e) {
				setActionError(t("processFailed", errText(e)));
				return;
			}
		}
		if (target === "summary") await showSummary();
		else await loadPage(target, focus ?? -1);
	}

	// "Check" and similar buttons of interactive questions submit the page with that button.
	async function onSubmit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const btn = (e.nativeEvent as SubmitEvent).submitter as HTMLInputElement | HTMLButtonElement | null;
		if (!btn?.name) return autosave();
		clearTimeout(saveTimer.current);
		setActionError(null);
		const slot = Number(btn.closest("[data-slot]")?.getAttribute("data-slot")) || null;
		try {
			await enqueue(() => processAttempt(id, wsData([...collect(), { name: btn.name, value: btn.value }], slots()), preflight));
			await loadPage(page, slot);
		} catch (err) {
			setActionError(t("processFailed", errText(err)));
		}
	}

	function onClick(e: MouseEvent<HTMLFormElement>) {
		const clear = (e.target as Element).closest<HTMLButtonElement>("[data-clear]");
		if (!clear || !formRef.current) return;
		const none = (Array.from(formRef.current.elements) as HTMLInputElement[]).find(el => el.name === clear.dataset.clear && el.type === "radio" && el.value === "-1");
		if (none) none.checked = true;
		scheduleSave();
	}

	async function finish() {
		setBusy("finish");
		setActionError(null);
		finishing.current = true;
		clearTimeout(saveTimer.current);
		try {
			if (view === "page" && dataRef.current) {
				const fields = collect();
				await enqueue(() => processAttempt(id, wsData(fields, slots()), preflight));
			}
			await enqueue(() => processAttempt(id, [], preflight, { finish: true }));
			submitDialog.current?.close();
			onFinished();
		} catch (e) {
			finishing.current = false;
			setActionError(t("submitFailed", errText(e)));
			setBusy(null);
		}
	}

	const timeUp = useCallback(async () => {
		if (finishing.current) return;
		finishing.current = true;
		clearTimeout(saveTimer.current);
		setTimeUpNote(true);
		try {
			const onPage = !!dataRef.current && view === "page";
			const data = onPage ? wsData(collect(), slots()) : [];
			const r = await enqueue(() => processAttempt(id, data, preflight, { timeup: true }));
			if (r.state === "finished" || r.state === "abandoned") return onFinished();
			// Grace period: the student may still submit from the summary.
			finishing.current = false;
			setOverdue(true);
			setTimeUpNote(false);
			await showSummary();
		} catch (e) {
			finishing.current = false;
			setTimeUpNote(false);
			setActionError(t("submitFailed", errText(e)));
		}
	}, [collect, enqueue, id, preflight, view, onFinished, showSummary]);

	const navQuestions = (summary ?? data?.page.questions ?? []).filter(q => q.type !== "description");
	const pages = pageCount(data?.page.attempt.layout, summary ?? []);
	const missing = unanswered(summary ?? []);
	const pageSlots = new Set(data?.page.questions.map(q => q.slot));
	const flaggedSlot = (q: AttemptQuestion) => {
		const i = data?.page.questions.findIndex(x => x.slot === q.slot) ?? -1;
		const name = i >= 0 ? data!.prepared[i].flagName : null;
		return name ? !!flags[name] : !!q.flagged;
	};
	const locked = busy !== null || timeUpNote;

	return (
		<div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_17rem]">
			<div className="min-w-0 space-y-4">
				{overdue && (
					<p role="alert" className="alert alert-warning text-sm">
						{t("overdue")}
					</p>
				)}
				<p role="alert" className={actionError || loadError ? "alert alert-error text-sm" : "sr-only"}>
					{actionError ?? (loadError ? t("loadFailed", loadError) : "")}
				</p>

				{view === "summary" ? (
					<section className="card-quiet p-5" aria-labelledby={`${dialogId}-sum`}>
						<h2 id={`${dialogId}-sum`} ref={summaryHeading} tabIndex={-1} className="text-lg font-semibold focus:outline-none">
							{t("summaryTitle")}
						</h2>
						<p className="mt-1 text-sm text-base-content/75">{missing.length ? t("unansweredN", missing.length) : t("allAnswered")}</p>
						{missing.length > 0 && (
							<ul className="mt-2 flex flex-wrap gap-2">
								{missing.map(q => (
									<li key={q.slot}>
										<button className="btn btn-sm btn-outline" disabled={locked || overdue || (sequential && q.page !== page)} onClick={() => go(q.page, q.slot)}>
											{t("goToQuestion", qNumber(q))}
										</button>
									</li>
								))}
							</ul>
						)}
						<table className="table-sm mt-4 table">
							<thead>
								<tr>
									<th scope="col">{t("colQuestion")}</th>
									<th scope="col">{t("colStatus")}</th>
								</tr>
							</thead>
							<tbody>
								{navQuestions.map(q => (
									<tr key={q.slot}>
										<td className="tabular-nums">{qNumber(q)}</td>
										<td className={isAnswered(q) ? "" : "font-medium text-error"}>
											{q.status}
											{flaggedSlot(q) && <span className="ml-2 text-xs text-base-content/65">· {t("flagged")}</span>}
										</td>
									</tr>
								))}
							</tbody>
						</table>
						<div className="mt-4 flex flex-wrap gap-2">
							{!overdue && (
								<button className="btn" disabled={locked} onClick={() => loadPage(page, -1)}>
									<ArrowLeftIcon size={16} />
									{t("backToAttempt")}
								</button>
							)}
							<button className="btn btn-primary" disabled={locked} onClick={() => submitDialog.current?.showModal()}>
								{t("submitAll")}
							</button>
						</div>
					</section>
				) : data ? (
					<form ref={formRef} onSubmit={onSubmit} onInput={scheduleSave} onChange={scheduleSave} onClick={onClick} aria-busy={busy === "load"} className="space-y-4">
						{data.page.messages.length > 0 && (
							<ul className="alert alert-info text-sm">
								{data.page.messages.map(m => (
									<li key={m}>{m}</li>
								))}
							</ul>
						)}
						{data.page.questions.map((q, i) => (
							<QuestionBlock
								key={`${q.slot}-${q.sequencecheck}`}
								q={q}
								p={data.prepared[i]}
								flagged={!!(data.prepared[i].flagName && flags[data.prepared[i].flagName!])}
								onFlag={on => {
									const name = data.prepared[i].flagName!;
									setFlags(f => ({ ...f, [name]: on }));
									flagsRef.current = { ...flagsRef.current, [name]: on };
									scheduleSave();
								}}
								e3Url={e3Link(`/mod/quiz/attempt.php?attempt=${id}&cmid=${quiz.coursemodule}&page=${page}`)}
							/>
						))}
						<nav className="flex flex-wrap items-center gap-2" aria-label={t("pageOf", page + 1, pages)}>
							{!sequential && page > 0 && (
								<button type="button" className="btn" disabled={locked} onClick={() => go(page - 1)}>
									<ArrowLeftIcon size={16} />
									{t("prevPage")}
								</button>
							)}
							<span className="text-sm text-base-content/65">{t("pageOf", page + 1, pages)}</span>
							<span className="grow" />
							{data.page.nextpage !== -1 ? (
								<button type="button" className="btn btn-primary" disabled={locked} onClick={() => go(data.page.nextpage)}>
									{t("nextPage")}
									<ArrowRightIcon size={16} />
								</button>
							) : (
								<button type="button" className="btn btn-primary" disabled={locked} onClick={() => go("summary")}>
									<ListChecksIcon size={16} />
									{t("toSummary")}
								</button>
							)}
						</nav>
					</form>
				) : busy ? (
					<Lines n={6} />
				) : null}
			</div>

			<aside className="order-first space-y-3 lg:sticky lg:top-6 lg:order-none lg:self-start">
				<section className="card-quiet space-y-3 p-4" aria-labelledby={`${dialogId}-nav`}>
					{endTime > 0 && <Countdown endTime={endTime} onTimeUp={timeUp} paused={timeUpNote || overdue} />}
					{timeUpNote && <p className="text-sm font-medium text-error">{t("timeUp")}</p>}
					<SaveStatus save={save} />
					<h2 id={`${dialogId}-nav`} className="text-sm font-semibold text-base-content/65">
						{t("navigator")}
					</h2>
					<ul className="flex flex-wrap gap-1.5">
						{navQuestions.map(q => {
							const answered = isAnswered(q);
							const flagged = flaggedSlot(q);
							const here = view === "page" && pageSlots.has(q.slot);
							return (
								<li key={q.slot}>
									<button
										type="button"
										aria-label={t("navQuestion", qNumber(q), answered, flagged)}
										aria-current={here ? "true" : undefined}
										disabled={locked || overdue || (sequential && q.page !== page)}
										onClick={() => (here ? document.getElementById(`quiz-q-${q.slot}`)?.focus() : go(q.page, q.slot))}
										className={`btn btn-sm relative w-10 tabular-nums ${answered ? "btn-neutral" : "btn-outline"} ${here ? "ring-2 ring-primary ring-offset-2 ring-offset-base-100" : ""}`}
									>
										{qNumber(q)}
										{flagged && <FlagIcon size={12} weight="fill" className="absolute -top-1 -right-1 text-error" />}
									</button>
								</li>
							);
						})}
					</ul>
					<p className="text-xs text-base-content/65">{t("navLegend")}</p>
					{view === "page" && (
						<button type="button" className="btn btn-sm w-full" disabled={locked || !data} onClick={() => go("summary")}>
							<ListChecksIcon size={16} />
							{t("toSummary")}
						</button>
					)}
				</section>
			</aside>

			<dialog ref={submitDialog} className="modal modal-bottom sm:modal-middle" aria-labelledby={`${dialogId}-submit`}>
				<div className="modal-box max-w-md">
					<h2 id={`${dialogId}-submit`} className="text-lg font-semibold">
						{t("submitTitle")}
					</h2>
					<ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-base-content/75">
						{missing.length > 0 && <li className="font-medium text-base-content">{t("submitUnanswered", missing.length)}</li>}
						<li>{t("submitFinal")}</li>
					</ul>
					<div className="modal-action">
						<button type="button" className="btn btn-ghost" onClick={() => submitDialog.current?.close()}>
							{tc("cancel")}
						</button>
						<button type="button" className="btn btn-primary" disabled={busy === "finish"} onClick={finish}>
							{busy === "finish" && <span className="loading loading-spinner loading-xs" />}
							{busy === "finish" ? t("submitting") : t("submitAll")}
						</button>
					</div>
				</div>
				<form method="dialog" className="modal-backdrop">
					<button>{tc("close")}</button>
				</form>
			</dialog>
		</div>
	);
}

function SaveStatus({ save }: { save: SaveState }) {
	return (
		<>
			<p role="status" className="text-xs text-base-content/65">
				{save.kind === "saved" ? t("savedAt", hhmm(new Date(save.at))) : ""}
			</p>
			{save.kind === "saving" && (
				<p className="flex items-center gap-1.5 text-xs text-base-content/65" aria-hidden>
					<span className="loading loading-spinner loading-xs" />
					{t("saving")}
				</p>
			)}
			<p role="alert" className={save.kind === "error" ? "text-xs text-error" : "sr-only"}>
				{save.kind === "error" ? t("saveFailed", save.message) : ""}
			</p>
		</>
	);
}

/**
 * The visible clock ticks every second but is not a live region; screen
 * readers hear only the 5- and 1-minute warnings, through a polite status.
 */
function Countdown({ endTime, onTimeUp, paused }: { endTime: number; onTimeUp: () => void; paused: boolean }) {
	const [now, setNow] = useState(() => Date.now());
	const [warned, setWarned] = useState<5 | 1 | null>(null);
	const fired = useRef(false);
	const left = endTime - now / 1000;
	const level = warningLevel(left);

	useEffect(() => {
		const iv = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(iv);
	}, []);
	useEffect(() => {
		if (level && (warned === null || level < warned)) setWarned(level);
	}, [level, warned]);
	useEffect(() => {
		if (left <= 0 && !paused && !fired.current) {
			fired.current = true;
			onTimeUp();
		}
	}, [left, paused, onTimeUp]);

	return (
		<div>
			<p className={`flex items-baseline justify-between gap-2 ${level === 1 ? "text-error" : level === 5 ? "text-warning" : ""}`}>
				<span className="text-sm text-base-content/65">{t("timeLeft")}</span>
				<span role="timer" aria-label={t("timeLeft")} className="text-2xl font-semibold tabular-nums">
					{formatClock(left)}
				</span>
			</p>
			<p role="status" className={warned ? "mt-1 text-xs font-medium text-error" : "sr-only"}>
				{warned ? t("timeWarn", warned) : ""}
			</p>
		</div>
	);
}

function QuestionBlock({ q, p, flagged, onFlag, e3Url }: { q: AttemptQuestion; p: PreparedQuestion; flagged: boolean; onFlag: (on: boolean) => void; e3Url: string }) {
	const info = q.type === "description";
	const n = qNumber(q);
	return (
		<article className="card-quiet p-5" data-slot={q.slot} aria-labelledby={`quiz-q-${q.slot}`}>
			<header className="mb-3 flex flex-wrap items-center gap-2">
				<h2 id={`quiz-q-${q.slot}`} tabIndex={-1} className="text-base font-semibold focus:outline-none focus-visible:underline">
					{info ? t("infoItem") : t("questionN", Number(n) || q.slot)}
				</h2>
				{!info && q.maxmark !== undefined && <span className="text-sm text-base-content/65">{t("marks", q.maxmark)}</span>}
				{!info && q.status && <span className="badge badge-sm badge-soft">{q.status}</span>}
				{p.flagName && !info && (
					<button type="button" aria-pressed={flagged} aria-label={t("flagLabel", n)} onClick={() => onFlag(!flagged)} className={`btn btn-ghost btn-xs ml-auto ${flagged ? "text-error" : ""}`}>
						<FlagIcon size={14} weight={flagged ? "fill" : "regular"} />
						{t("flag")}
					</button>
				)}
			</header>
			{p.unsupported && (
				<div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-warning/10 p-3 text-sm">
					<WarningIcon size={16} className="shrink-0" />
					<span className="grow">{t("unsupportedQuestion")}</span>
					<E3Away notice={{ url: e3Url, title: t("questionN", Number(n) || q.slot), reason: t("unsupportedQuestion") }} className="btn btn-xs">
						{t("answerThisOnE3")}
						<ArrowSquareOutIcon size={12} />
					</E3Away>
				</div>
			)}
			<div className={QUESTION_CLASS} dangerouslySetInnerHTML={{ __html: p.html }} />
		</article>
	);
}

// Moodle's markup carries Bootstrap classes EM3 doesn't load; these rules give it EM3's look.
const QUESTION_CLASS = [
	"prose-e3",
	"[&_.qtext]:mb-4",
	"[&_fieldset]:m-0 [&_fieldset]:border-0 [&_fieldset]:p-0",
	"[&_legend]:mb-2 [&_legend]:text-sm [&_legend]:text-base-content/65",
	"[&_.answer>div]:mb-1.5 [&_.answer>div]:flex [&_.answer>div]:items-start [&_.answer>div]:gap-2 [&_.answer>div]:rounded-xl [&_.answer>div]:border [&_.answer>div]:border-base-content/15 [&_.answer>div]:px-3 [&_.answer>div]:py-2",
	"[&_.answer>div:has(input:checked)]:border-primary [&_.answer>div:has(input:checked)]:bg-primary/[0.06]",
	"[&_.answer>div>input]:mt-1 [&_.answer_label]:grow [&_.answer_label]:cursor-pointer [&_label_p]:m-0",
	"[&_.answernumber]:shrink-0 [&_.answernumber]:me-1 [&_.answernumber]:font-medium [&_.answernumber]:text-base-content/65",
	"[&_.d-flex]:flex [&_.flex-fill]:grow",
	"[&_.ablock]:mt-2 [&_.ablock]:flex [&_.ablock]:flex-wrap [&_.ablock]:items-center [&_.ablock]:gap-2",
	"[&_table]:my-2 [&_td]:py-1.5 [&_td]:pe-3 [&_td]:align-middle",
	"[&_.im-controls]:mt-3 [&_.outcome]:mt-3 [&_.outcome]:rounded-xl [&_.outcome]:bg-base-content/[0.04] [&_.outcome]:p-3 [&_.outcome]:text-sm",
	"[&_.validationerror]:text-sm [&_.validationerror]:text-error",
	"[&_.qtype_multichoice_clearchoice]:mt-1"
].join(" ");
