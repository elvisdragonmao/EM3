import { Fact, FileChips } from "@/features/assignments/AssignmentPage";
import { useCourseIndex, useSiteInfo } from "@/features/courses/api";
import { tc } from "@/i18n/common";
import { copyWhenReady } from "@/lib/clipboard";
import { cleanHtml, e3Link } from "@/lib/moodle/files";
import { countdown, deadlinePhrase, fullDateTime } from "@/lib/time/relative";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { CourseTag } from "@/shared/ui/CourseTag";
import { E3Away, type LeaveNotice } from "@/shared/ui/LeaveToE3";
import { ErrorNote, Lines } from "@/shared/ui/States";
import {
	ArrowLeftIcon,
	ArrowSquareOutIcon,
	CheckCircleIcon,
	CheckIcon,
	ClockIcon,
	ChatsCircleIcon,
	CopyIcon,
	HourglassIcon,
	ListNumbersIcon,
	MinusCircleIcon,
	PencilSimpleLineIcon,
	QuestionIcon,
	TimerIcon,
	TrophyIcon,
	XCircleIcon
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useRouter } from "@tanstack/react-router";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
	attemptQuestions,
	formatGrade,
	gradeFromAttempts,
	type Quiz,
	type QuizAttempt,
	quizE3Reason,
	quizNotes,
	quizState,
	scaledGrade,
	startAttempt,
	useAttemptReview,
	useBestGrade,
	useQuizAttempts,
	useQuizzes
} from "./api";
import { useAttemptSupport } from "./attemptApi";
import { t } from "./messages";
import { buildStudyPrompt, parseQuestion, PROMPT_LANG_LABEL, type PromptLang, promptLang, type ReviewOption, type ReviewQuestion } from "./review";

const STATE_TONE = { graded: "badge-success", submitted: "badge-success", todo: "badge-info", late: "badge-error", upcoming: "badge-ghost", closed: "badge-ghost" } as const;

export function QuizPage() {
	const { courseId, cmid } = useParams({ from: "/app/courses/$courseId/quiz/$cmid" });
	const router = useRouter();
	const { byId } = useCourseIndex();
	const course = byId.get(Number(courseId));
	const ids = useMemo(() => [Number(courseId)], [courseId]);
	const quizzes = useQuizzes(ids);
	const quiz = quizzes.data?.find(q => q.coursemodule === Number(cmid));
	const attemptsQ = useQuizAttempts(quiz ? [quiz.id] : []);
	const best = useBestGrade(quiz?.id);
	const attempts = useMemo(() => [...(attemptsQ.data?.[quiz?.id ?? 0] ?? [])].sort((a, b) => b.attempt - a.attempt), [attemptsQ.data, quiz?.id]);
	const finished = attempts.filter(a => a.state === "finished");
	const [picked, setPicked] = useState<number | null>(null);
	const shown = attempts.find(a => a.id === picked) ?? finished[0];
	const site = useSiteInfo();
	const [langPick, setLang] = useState<PromptLang | null>(null);
	const lang = langPick ?? promptLang(site.data?.lang);
	const courseName = (lang === "en" && course?.nameEn) || course?.name || "";
	useDocumentTitle(quiz?.name);

	if (quizzes.error) return <ErrorNote error={quizzes.error} retry={quizzes.refetch} />;
	if (quizzes.isPending || (quiz && attemptsQ.isPending)) return <Lines n={6} />;
	if (!quiz) return <p className="py-20 text-center text-base-content/65">{t("notFound")}</p>;

	const now = Date.now() / 1000;
	const state = quizState(quiz, attempts, now);
	const cd = quiz.timeclose ? countdown(quiz.timeclose) : null;
	const open = state === "todo" || state === "late";
	const unfinished = attempts.find(a => a.state === "inprogress" || a.state === "overdue");
	const used = attempts.filter(a => a.state !== "abandoned").length;
	const canAttempt = (!quiz.timeclose || quiz.timeclose > now) && quiz.timeopen <= now && (!quiz.attempts || used < quiz.attempts);
	const overall = best.data?.hasgrade && best.data.grade !== undefined ? best.data.grade : gradeFromAttempts(quiz, attempts);
	const notice = { url: e3Link(`/mod/quiz/view.php?id=${quiz.coursemodule}`), title: quiz.name, reason: quizE3Reason(), notes: quizNotes(quiz, attempts) };

	return (
		<div className="mx-auto max-w-5xl">
			<button onClick={() => router.history.back()} className="btn btn-ghost btn-sm mb-4 -ml-2">
				<ArrowLeftIcon size={16} />
				{t("back")}
			</button>

			<header className="mb-6">
				{course && <CourseTag course={course} link />}
				<h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{quiz.name}</h1>
				<div className="mt-3 flex flex-wrap items-center gap-2">
					<span className={`badge badge-soft ${STATE_TONE[state]}`}>{t("taskState", state)}</span>
					{unfinished && <span className="badge badge-soft badge-warning">{t("unfinishedBadge")}</span>}
					{cd && open && <span className={`text-sm ${cd.urgency === "critical" || cd.urgency === "overdue" ? "text-error" : "text-base-content/65"}`}>{cd.text}</span>}
				</div>
			</header>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
				<div className="min-w-0 space-y-6">
					<dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
						{quiz.timeopen > now ? (
							<Fact icon={<HourglassIcon size={16} />} label={t("opensAt")} value={deadlinePhrase(quiz.timeopen)} hint={fullDateTime(quiz.timeopen)} />
						) : (
							<Fact
								icon={<ClockIcon size={16} />}
								label={t("closesAt")}
								value={quiz.timeclose ? deadlinePhrase(quiz.timeclose) : t("noDeadline")}
								hint={quiz.timeclose ? fullDateTime(quiz.timeclose) : undefined}
							/>
						)}
						<Fact icon={<TimerIcon size={16} />} label={t("timeLimit")} value={quiz.timelimit ? t("minutes", Math.round(quiz.timelimit / 60)) : t("noTimeLimit")} />
						<Fact
							icon={<ListNumbersIcon size={16} />}
							label={t("attempts")}
							value={quiz.attempts ? `${used} / ${quiz.attempts}` : t("attemptCount", used)}
							hint={quiz.attempts ? undefined : t("unlimitedAttempts")}
						/>
						<Fact
							icon={<TrophyIcon size={16} />}
							label={t("grade")}
							value={overall !== null ? `${formatGrade(overall, quiz)} / ${formatGrade(quiz.grade, quiz)}` : "—"}
							hint={finished.length > 1 ? t("gradeMethodHint") : undefined}
						/>
					</dl>

					{(quiz.intro?.trim() || !!quiz.introfiles?.length) && (
						<section className="card-quiet p-5">
							<h2 className="mb-2 text-sm font-semibold text-base-content/65">{t("intro")}</h2>
							{quiz.intro && <div className="prose-e3" dangerouslySetInnerHTML={{ __html: cleanHtml(quiz.intro) }} />}
							{!!quiz.introfiles?.length && (
								<div className="mt-4">
									<FileChips files={quiz.introfiles} />
								</div>
							)}
						</section>
					)}

					{shown?.state === "finished" ? (
						<AttemptReview quiz={quiz} attempt={shown} courseName={courseName} lang={lang} onLang={setLang} />
					) : (
						!attempts.length && <section className="card-quiet p-5 text-sm text-base-content/65">{t("noAttempts")}</section>
					)}
				</div>

				<aside className="order-first space-y-4 lg:order-none lg:sticky lg:top-6 lg:self-start">
					{(canAttempt || unfinished) && (
						<section className="card-quiet p-4">
							<TakeQuiz quiz={quiz} attempted={attempts.length > 0} unfinished={unfinished} notice={notice} courseId={courseId} cmid={cmid} />
							<PracticeCopy quiz={quiz} unfinished={unfinished} used={used} courseName={courseName} lang={lang} onLang={setLang} />
						</section>
					)}
					{attempts.length > 0 && (
						<section className="card-quiet p-2" aria-labelledby="quiz-attempts-title">
							<h2 id="quiz-attempts-title" className="px-2 pt-2 pb-1 text-sm font-semibold text-base-content/65">
								{t("myAttempts")}
							</h2>
							<ul>
								{attempts.map(a => (
									<li key={a.id}>
										<AttemptRow quiz={quiz} a={a} active={a.id === shown?.id} onPick={() => setPicked(a.id)} />
									</li>
								))}
							</ul>
						</section>
					)}
					{!canAttempt && !unfinished && (
						<a className="btn btn-ghost btn-sm w-full" href={notice.url} target="_blank" rel="noreferrer">
							<ArrowSquareOutIcon size={15} />
							{t("openOnE3")}
							<span className="sr-only">{tc("openInNewTab")}</span>
						</a>
					)}
				</aside>
			</div>
		</div>
	);
}

/** Answer in EM3 when it can run the quiz; otherwise the E3 link, saying why. */
function TakeQuiz({
	quiz,
	attempted,
	unfinished,
	notice,
	courseId,
	cmid
}: {
	quiz: Quiz;
	attempted: boolean;
	unfinished: QuizAttempt | undefined;
	notice: LeaveNotice;
	courseId: string;
	cmid: string;
}) {
	const support = useAttemptSupport(quiz, unfinished);
	const e3Label = unfinished ? t("resumeOnE3") : attempted ? t("againOnE3") : t("takeOnE3");
	if (support.pending)
		return (
			<button className="btn btn-primary w-full" disabled>
				<span className="loading loading-spinner loading-xs" />
				{t("checkingSupport")}
			</button>
		);
	if (support.error || support.blockers.length) {
		const why = support.error ? t("loadFailed", support.error.message) : support.blockers.map(b => t("blocker", b)).join(" ");
		return (
			<>
				<E3Away notice={{ ...notice, reason: why }} className="btn btn-primary w-full">
					{e3Label}
					<ArrowSquareOutIcon size={16} />
				</E3Away>
				<p className="mt-2 text-xs text-base-content/65">{why}</p>
			</>
		);
	}
	return (
		<>
			<Link to="/courses/$courseId/quiz/$cmid/attempt" params={{ courseId, cmid }} className="btn btn-primary w-full">
				<PencilSimpleLineIcon size={16} />
				{unfinished ? t("continueInEm3") : attempted ? t("againInEm3") : t("answerInEm3")}
			</Link>
			<p className="mt-2 text-xs text-base-content/65">{t("takenOnE3")}</p>
			<E3Away notice={notice} className="btn btn-ghost btn-sm mt-1 w-full">
				{t("orOnE3")}
				<ArrowSquareOutIcon size={14} />
			</E3Away>
		</>
	);
}

function AttemptRow({ quiz, a, active, onPick }: { quiz: Quiz; a: QuizAttempt; active: boolean; onPick: () => void }) {
	const grade = scaledGrade(quiz, a.sumgrades);
	const minutes = a.timefinish && a.timestart ? Math.max(1, Math.round((a.timefinish - a.timestart) / 60)) : null;
	const reviewable = a.state === "finished";
	return (
		<button
			onClick={onPick}
			disabled={!reviewable}
			aria-pressed={reviewable ? active : undefined}
			data-nav
			className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left disabled:cursor-default ${active ? "bg-base-content/[0.06]" : reviewable ? "hover:bg-base-content/[0.03]" : ""}`}
		>
			<span className="min-w-0 grow">
				<span className="block text-sm font-medium">{t("attemptN", a.attempt)}</span>
				<span className="block truncate text-xs text-base-content/65">
					{t("attemptState", a.state)}
					{a.timefinish ? ` · ${fullDateTime(a.timefinish)}` : ""}
					{minutes ? ` · ${t("took", minutes)}` : ""}
				</span>
			</span>
			{grade !== null && (
				<span className="shrink-0 text-sm font-semibold tabular-nums">
					{formatGrade(grade, quiz)}
					<span className="font-normal text-base-content/65"> / {formatGrade(quiz.grade, quiz)}</span>
				</span>
			)}
		</button>
	);
}

const VERDICT = {
	correct: { tone: "badge-success", Icon: CheckCircleIcon, color: "text-success" },
	incorrect: { tone: "badge-error", Icon: XCircleIcon, color: "text-error" },
	partial: { tone: "badge-warning", Icon: MinusCircleIcon, color: "text-warning" },
	pending: { tone: "badge-ghost", Icon: QuestionIcon, color: "text-base-content/65" },
	unknown: { tone: "badge-ghost", Icon: QuestionIcon, color: "text-base-content/65" }
} as const;

const verdictLabel = (v: keyof typeof VERDICT) => (v === "unknown" ? "" : t("verdict", v));

function AttemptReview({ quiz, attempt, courseName, lang, onLang }: { quiz: Quiz; attempt: QuizAttempt; courseName: string; lang: PromptLang; onLang: (l: PromptLang) => void }) {
	const review = useAttemptReview(attempt.id);
	const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
	const questions = useMemo(() => [...(review.data?.questions ?? [])].sort((a, b) => a.slot - b.slot).map(q => parseQuestion(q, lang)), [review.data, lang]);
	const grade = review.data?.grade;
	const gradeText = grade !== null && grade !== undefined && grade !== "" ? formatGrade(Number(grade), quiz) : null;
	const prompt = useMemo(() => buildStudyPrompt({ course: courseName, quiz, questions, grade: gradeText, lang }), [courseName, quiz, questions, gradeText, lang]);

	useEffect(() => {
		if (!copied) return;
		const timer = setTimeout(() => setCopied(null), 2500);
		return () => clearTimeout(timer);
	}, [copied]);

	async function copy() {
		try {
			await navigator.clipboard.writeText(prompt);
			setCopied("ok");
		} catch {
			setCopied("fail");
		}
	}

	if (review.error)
		return (
			<section className="card-quiet p-5 text-sm">
				<h2 className="mb-1 font-semibold">{t("attemptResult", attempt.attempt)}</h2>
				<p className="text-base-content/65">{t("reviewClosed")}</p>
				<p className="mt-1 text-xs text-base-content/65">{t("e3Reply", review.error.message)}</p>
			</section>
		);
	if (review.isPending) return <Lines n={5} />;

	const counts = questions.reduce<Record<string, number>>((m, q) => ((m[q.verdict] = (m[q.verdict] ?? 0) + 1), m), {});

	return (
		<section className="space-y-4">
			<div className="card-quiet flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
				<div className="min-w-0 grow">
					<h2 className="font-semibold">{t("attemptResult", attempt.attempt)}</h2>
					<p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-base-content/65">
						{gradeText !== null && (
							<span>
								{t("total")}{" "}
								<strong className="text-base-content tabular-nums">
									{gradeText} / {formatGrade(quiz.grade, quiz)}
								</strong>
							</span>
						)}
						{(["correct", "partial", "incorrect", "pending"] as const).map(v => counts[v] && <span key={v}>{t("verdictCount", v, counts[v])}</span>)}
					</p>
				</div>
				{questions.length > 0 && (
					<div className="flex flex-col items-end gap-1">
						<button className="btn btn-sm btn-neutral" onClick={copy}>
							{copied === "ok" ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
							{copied === "ok" ? tc("copied") : t("copyPrompt")}
						</button>
						<LangPicker lang={lang} onLang={onLang} />
					</div>
				)}
				<p role="status" className="sr-only">
					{copied === "ok" ? tc("copied") : ""}
				</p>
				<p role="alert" className={copied === "fail" ? "w-full text-xs text-error" : "sr-only"}>
					{copied === "fail" ? t("clipboardBlocked") : ""}
				</p>
				{questions.length > 0 && (
					<details className="w-full text-sm" open={copied === "fail"}>
						<summary className="cursor-pointer text-xs text-base-content/65">{t("previewPrompt")}</summary>
						<textarea readOnly aria-label={t("promptText")} className="textarea mt-2 h-64 w-full font-mono text-xs" value={prompt} onFocus={e => e.currentTarget.select()} />
					</details>
				)}
			</div>

			{!questions.length && <p className="card-quiet p-5 text-sm text-base-content/65">{t("noReview")}</p>}
			<ol className="space-y-3">
				{questions.map((q, i) => (
					<li key={q.slot}>
						<QuestionCard q={q} index={i + 1} />
					</li>
				))}
			</ol>
		</section>
	);
}

function QuestionCard({ q, index }: { q: ReviewQuestion; index: number }) {
	const v = VERDICT[q.verdict];
	const label = verdictLabel(q.verdict);
	return (
		<article className="card-quiet p-5">
			<header className="mb-3 flex flex-wrap items-center gap-2">
				<h3 className="text-sm font-semibold text-base-content/65">{t("questionN", q.number ?? index)}</h3>
				{(q.status || label) && <span className={`badge badge-sm badge-soft ${v.tone}`}>{q.status || label}</span>}
				{q.mark !== null && q.maxmark !== null && (
					<span className="ml-auto text-sm tabular-nums text-base-content/65">
						{q.mark} / {q.maxmark}
					</span>
				)}
			</header>
			{q.textHtml && <div className="prose-e3" dangerouslySetInnerHTML={{ __html: cleanHtml(q.textHtml) }} />}
			{q.options.length > 0 && (
				<ul className="mt-3 space-y-1.5">
					{q.options.map((o, i) => (
						<OptionRow key={i} o={o} />
					))}
				</ul>
			)}
			{q.formulationHtml && (
				<div
					className="prose-e3 mt-3 rounded-xl bg-base-content/[0.03] p-3 text-sm [&_input]:pointer-events-none [&_select]:pointer-events-none"
					dangerouslySetInnerHTML={{ __html: cleanHtml(q.formulationHtml) }}
				/>
			)}
			{(q.rightAnswer || q.specificFeedback || q.generalFeedback) && (
				<div className="mt-4 space-y-2 text-sm">
					{q.rightAnswer && <p className="rounded-xl bg-success/10 px-3 py-2">{q.rightAnswer}</p>}
					{q.specificFeedback && <div className="prose-e3 text-base-content/75" dangerouslySetInnerHTML={{ __html: cleanHtml(q.specificFeedback) }} />}
					{q.generalFeedback && (
						<div className="rounded-xl border hairline px-3 py-2">
							<p className="mb-1 text-xs font-semibold text-base-content/65">{t("explanation")}</p>
							<div className="prose-e3 text-base-content/80" dangerouslySetInnerHTML={{ __html: cleanHtml(q.generalFeedback) }} />
						</div>
					)}
				</div>
			)}
		</article>
	);
}

function OptionRow({ o }: { o: ReviewOption }) {
	const v = o.verdict ? VERDICT[o.verdict] : null;
	const tone =
		o.verdict === "correct"
			? "border-success/40 bg-success/[0.06]"
			: o.verdict === "incorrect"
				? "border-error/40 bg-error/[0.06]"
				: o.verdict === "partial"
					? "border-warning/40 bg-warning/[0.06]"
					: o.chosen
						? "border-base-content/25"
						: "border-transparent";
	return (
		<li className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${tone}`}>
			<span className="w-5 shrink-0 font-medium text-base-content/65">{o.label}</span>
			<span className="prose-e3 min-w-0 grow [&_p]:m-0" dangerouslySetInnerHTML={{ __html: cleanHtml(o.html) }} />
			{o.chosen && <span className="shrink-0 text-xs text-base-content/65">{t("yourChoice")}</span>}
			{v && o.verdict && (
				<>
					<v.Icon size={18} weight="fill" className={`shrink-0 ${v.color}`} />
					<span className="sr-only">{t("verdict", o.verdict)}</span>
				</>
			)}
		</li>
	);
}

function LangPicker({ lang, onLang }: { lang: PromptLang; onLang: (l: PromptLang) => void }) {
	return (
		<label className="flex items-center gap-1 text-xs whitespace-nowrap text-base-content/65">
			{t("promptLang")}
			<select className="select select-ghost select-xs w-auto" value={lang} onChange={e => onLang(e.target.value as PromptLang)}>
				{(Object.keys(PROMPT_LANG_LABEL) as PromptLang[]).map(l => (
					<option key={l} value={l} lang={l}>
						{PROMPT_LANG_LABEL[l]}
					</option>
				))}
			</select>
		</label>
	);
}

/**
 * For practice quizzes the teacher lets students discuss with AI: copies the
 * questions of the attempt in progress, starting one first if needed (after an
 * explicit confirmation, since that starts the timer and uses an attempt).
 */
function PracticeCopy({
	quiz,
	unfinished,
	used,
	courseName,
	lang,
	onLang
}: {
	quiz: Quiz;
	unfinished: QuizAttempt | undefined;
	used: number;
	courseName: string;
	lang: PromptLang;
	onLang: (l: PromptLang) => void;
}) {
	const qc = useQueryClient();
	const dialog = useRef<HTMLDialogElement>(null);
	const titleId = useId();
	const [busy, setBusy] = useState(false);
	const [done, setDone] = useState<{ attemptId: number; count: number; text: string; copied: boolean } | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Must run inside the click: the clipboard write is queued before any request.
	function run(start: boolean) {
		dialog.current?.close();
		setBusy(true);
		setError(null);
		let attemptId = unfinished?.id ?? 0;
		let count = 0;
		copyWhenReady(async () => {
			if (start) {
				attemptId = (await startAttempt(quiz.id)).id;
				void qc.invalidateQueries({ queryKey: ["quiz-attempts"] });
			}
			const questions = (await attemptQuestions(attemptId)).sort((a, b) => a.slot - b.slot).map(q => parseQuestion(q, lang));
			count = questions.length;
			return buildStudyPrompt({ mode: "practice", course: courseName, quiz, questions, lang });
		})
			.then(r => setDone({ attemptId, count, ...r }))
			.catch(e => setError(e instanceof Error ? e.message : String(e)))
			.finally(() => setBusy(false));
	}

	const attemptUrl = done ? e3Link(`/mod/quiz/attempt.php?attempt=${done.attemptId}&cmid=${quiz.coursemodule}`) : "";
	const left = quiz.attempts ? quiz.attempts - used : null;

	return (
		<div className="mt-4 border-t hairline pt-4">
			<button className="btn btn-sm w-full" disabled={busy} onClick={() => (unfinished ? run(false) : dialog.current?.showModal())}>
				{busy ? <span className="loading loading-spinner loading-xs" /> : <ChatsCircleIcon size={16} />}
				{unfinished ? t("copyForAi") : t("startAndCopy")}
			</button>
			<p className="mt-1.5 text-xs text-base-content/65">{t("practiceHint")}</p>
			<div className="mt-1 flex justify-end">
				<LangPicker lang={lang} onLang={onLang} />
			</div>
			<p role="alert" className={error ? "mt-2 text-xs text-error" : "sr-only"}>
				{error ? t("startError", error) : ""}
			</p>
			<p role="status" className="sr-only">
				{done ? (done.copied ? t("copiedN", done.count) : t("readNoClipboard", done.count)) : ""}
			</p>
			{done && (
				<div className="mt-2 rounded-xl bg-success/10 p-3 text-sm">
					<p className="flex items-center gap-1.5 font-medium">
						<CheckIcon size={16} />
						{done.copied ? t("copiedN", done.count) : t("readNoClipboard", done.count)}
					</p>
					{!done.copied && <textarea readOnly aria-label={t("promptText")} className="textarea mt-2 h-40 w-full font-mono text-xs" value={done.text} onFocus={e => e.currentTarget.select()} />}
					<a className="link mt-1 inline-flex items-center gap-1 text-xs" href={attemptUrl} target="_blank" rel="noreferrer">
						{t("submitOnE3")} <ArrowSquareOutIcon size={12} />
						<span className="sr-only">{tc("openInNewTab")}</span>
					</a>
				</div>
			)}

			<dialog ref={dialog} className="modal modal-bottom sm:modal-middle" aria-labelledby={titleId}>
				<div className="modal-box max-w-md">
					<h2 id={titleId} className="text-lg font-semibold">
						{t("startTitle")}
					</h2>
					<ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-base-content/75">
						<li>{t("startWillBegin", used + 1, quiz.timelimit ? Math.round(quiz.timelimit / 60) : null)}</li>
						<li>{t("usesAttempt", left !== null ? left - 1 : null)}</li>
						<li>{t("noAutoSubmit")}</li>
						<li className="font-medium text-base-content">{t("checkAllowed")}</li>
					</ul>
					<div className="modal-action">
						<form method="dialog">
							<button className="btn btn-ghost">{tc("cancel")}</button>
						</form>
						<button className="btn btn-primary" onClick={() => run(true)}>
							{t("startAndCopyShort")}
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
