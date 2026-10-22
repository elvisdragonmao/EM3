import { useCourseIndex } from "@/features/courses/api";
import { saveBlob } from "@/lib/download";
import { cleanHtml, e3Link } from "@/lib/moodle/files";
import { tc } from "@/i18n/common";
import { markdownToHtml } from "@/shared/editor/markdown";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { CourseTag } from "@/shared/ui/CourseTag";
import { ArrowDownIcon, ArrowLeftIcon, ArrowUpIcon, ClipboardTextIcon, DownloadSimpleIcon, PlusIcon, TrashIcon, WarningIcon } from "@phosphor-icons/react";
import { useParams, useRouter } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { t } from "./messages";
import { fromSpreadsheet, newQuestion, problems, type QType, QTYPES, qtypeLabel, type Question, toMoodleXml } from "./quizXml";

const KEY = (id: string) => `em3:quiz-draft:${id}`;

function load(courseId: string): { category: string; questions: Question[] } {
	try {
		const d = JSON.parse(localStorage.getItem(KEY(courseId)) ?? "null");
		if (d?.questions?.length) return d;
	} catch {
		/* ignore */
	}
	return { category: "", questions: [newQuestion()] };
}

export function QuizBuilderPage() {
	const { courseId } = useParams({ from: "/app/courses/$courseId/quiz-builder" });
	const router = useRouter();
	const course = useCourseIndex().byId.get(Number(courseId));
	const [state, setState] = useState(() => load(courseId));
	const [pasting, setPasting] = useState(false);
	const [announcement, setAnnouncement] = useState("");
	const { questions, category } = state;
	useDocumentTitle(course ? `${t("quizBuilder")} · ${course.name}` : t("quizBuilder"));

	useEffect(() => {
		try {
			localStorage.setItem(KEY(courseId), JSON.stringify(state));
		} catch {
			/* ignore */
		}
	}, [courseId, state]);

	const update = (id: string, patch: Partial<Question>) => setState(s => ({ ...s, questions: s.questions.map(q => (q.id === id ? { ...q, ...patch } : q)) }));
	const move = (i: number, d: number) =>
		setState(s => {
			const qs = [...s.questions];
			const [q] = qs.splice(i, 1);
			qs.splice(Math.max(0, Math.min(qs.length, i + d)), 0, q);
			return { ...s, questions: qs };
		});
	const issues = questions.flatMap(problems);
	const total = questions.reduce((n, q) => n + (Number(q.points) || 0), 0);

	function download() {
		const xml = toMoodleXml(questions, category);
		saveBlob(new Blob([xml], { type: "application/xml" }), `${course?.raw.shortname ?? courseId}-${category.trim() || t("defaultFileName")}.xml`);
	}

	return (
		<div className="mx-auto max-w-6xl">
			<button onClick={() => router.history.back()} className="btn btn-ghost btn-sm mb-4 -ml-2">
				<ArrowLeftIcon size={16} />
				{t("back")}
			</button>
			<header className="mb-6">
				{course && <CourseTag course={course} link />}
				<h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{t("quizBuilder")}</h1>
				<p className="mt-1 max-w-2xl text-sm text-base-content/65">{t("quizIntro")}</p>
			</header>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
				<div className="min-w-0 space-y-4">
					<AnimatePresence initial={false}>
						{questions.map((q, i) => (
							<motion.div key={q.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}>
								<QuestionCard
									q={q}
									index={i}
									count={questions.length}
									onChange={p => update(q.id, p)}
									onMove={d => move(i, d)}
									onRemove={() => {
										setState(s => ({ ...s, questions: s.questions.filter(x => x.id !== q.id) }));
										setAnnouncement(t("removedQuestion", i + 1));
									}}
								/>
							</motion.div>
						))}
					</AnimatePresence>
					<div className="flex flex-wrap gap-2">
						<button className="btn" onClick={() => setState(s => ({ ...s, questions: [...s.questions, newQuestion(s.questions.at(-1)?.type ?? "single")] }))}>
							<PlusIcon size={16} />
							{t("addQuestion")}
						</button>
						<button className="btn btn-ghost" onClick={() => setPasting(true)}>
							<ClipboardTextIcon size={16} />
							{t("pasteFromSheet")}
						</button>
					</div>
					<p className="sr-only" role="status">
						{announcement}
					</p>
				</div>

				<aside className="card-quiet space-y-4 self-start p-4 lg:sticky lg:top-6">
					<label className="block">
						<span className="mb-1 block text-xs font-semibold text-base-content/65">{t("category")}</span>
						<input className="input input-sm w-full" placeholder={t("categoryPlaceholder")} value={category} onChange={e => setState(s => ({ ...s, category: e.target.value }))} />
					</label>
					<p className="text-sm">{t("quizSummary", questions.length, total)}</p>
					<p className="sr-only" role="status">
						{issues.length ? t("issueCount", issues.length) : t("readyToDownload")}
					</p>
					{issues.length > 0 && (
						<ul id="quiz-issues" aria-label={t("issuesLabel")} className="space-y-1 rounded-lg bg-warning/10 p-3 text-xs">
							{issues.map(m => (
								<li key={m} className="flex gap-1">
									<WarningIcon size={13} className="mt-0.5 shrink-0 text-warning" />
									{m}
								</li>
							))}
						</ul>
					)}
					<button className="btn btn-primary w-full" disabled={issues.length > 0} aria-describedby={issues.length ? "quiz-issues" : undefined} onClick={download}>
						<DownloadSimpleIcon size={16} />
						{t("downloadXml")}
					</button>
					<ol className="list-decimal space-y-1.5 pl-5 text-xs text-base-content/65">
						<li>{t("step1")}</li>
						<li>
							{t(
								"step2",
								<a className="link mx-1" href={e3Link(`/question/bank/importquestions/import.php?courseid=${courseId}`)} target="_blank" rel="noreferrer">
									{t("importLink")}
									<span className="sr-only">{tc("openInNewTab")}</span>
								</a>
							)}
						</li>
						<li>
							{t(
								"step3",
								<a className="link ml-1" href={e3Link(`/course/modedit.php?add=quiz&course=${courseId}&section=0&return=0`)} target="_blank" rel="noreferrer">
									{t("newQuiz")}
									<span className="sr-only">{tc("openInNewTab")}</span>
								</a>
							)}
						</li>
					</ol>
					<button className="btn btn-ghost btn-xs text-error" onClick={() => confirm(t("clearConfirm")) && setState({ category: "", questions: [newQuestion()] })}>
						{t("clearDraft")}
					</button>
				</aside>
			</div>

			<PasteDialog
				open={pasting}
				onClose={() => setPasting(false)}
				onAdd={qs => {
					setState(s => ({ ...s, questions: [...s.questions.filter(q => q.text.trim()), ...qs] }));
					setAnnouncement(t("addedQuestions", qs.length));
				}}
			/>
		</div>
	);
}

function QuestionCard({
	q,
	index,
	count,
	onChange,
	onMove,
	onRemove
}: {
	q: Question;
	index: number;
	count: number;
	onChange: (p: Partial<Question>) => void;
	onMove: (d: number) => void;
	onRemove: () => void;
}) {
	const [preview, setPreview] = useState(false);
	const uid = useId();
	const n = index + 1;
	const qIssues = problems(q, index);
	const letter = (i: number) => String.fromCharCode(65 + i);
	const setType = (type: QType) => {
		const fresh = newQuestion(type);
		onChange({
			type,
			choices: q.choices.length && (type === "single" || type === "multi") ? q.choices : fresh.choices,
			answers: fresh.answers.length ? (q.answers.length ? q.answers : fresh.answers) : []
		});
	};
	return (
		<fieldset className="card-quiet min-w-0 p-4" aria-describedby={qIssues.length ? `${uid}-issues` : undefined}>
			<legend className="sr-only">{t("questionN", n)}</legend>
			<p id={`${uid}-issues`} hidden>
				{qIssues.join(" ")}
			</p>
			<div className="mb-3 flex flex-wrap items-center gap-2">
				<span aria-hidden className="grid size-7 place-items-center rounded-full bg-base-200 text-sm font-semibold tabular-nums">
					{n}
				</span>
				<select className="select select-sm w-auto" value={q.type} onChange={e => setType(e.target.value as QType)} aria-label={t("questionType")}>
					{QTYPES.map(type => (
						<option key={type} value={type}>
							{qtypeLabel(type)}
						</option>
					))}
				</select>
				<label className="input input-sm w-24">
					<input type="number" min={0} step={0.5} value={q.points} onChange={e => onChange({ points: Number(e.target.value) })} aria-label={t("points")} />
					<span className="text-xs opacity-75">{t("pointsUnit")}</span>
				</label>
				<input className="input input-sm min-w-0 grow" placeholder={t("questionName")} aria-label={t("questionName")} value={q.name} onChange={e => onChange({ name: e.target.value })} />
				<div className="ml-auto flex">
					<button className="btn btn-ghost btn-xs btn-square" disabled={index === 0} onClick={() => onMove(-1)} aria-label={t("moveUp", n)}>
						<ArrowUpIcon size={14} />
					</button>
					<button className="btn btn-ghost btn-xs btn-square" disabled={index === count - 1} onClick={() => onMove(1)} aria-label={t("moveDown", n)}>
						<ArrowDownIcon size={14} />
					</button>
					<button className="btn btn-ghost btn-xs btn-square" onClick={onRemove} aria-label={t("removeQuestion", n)}>
						<TrashIcon size={14} />
					</button>
				</div>
			</div>
			<div className="mb-1 flex justify-end">
				<button className="btn btn-ghost btn-xs" onClick={() => setPreview(p => !p)}>
					{preview ? t("edit") : t("preview")}
				</button>
			</div>
			{preview ? (
				<div className="prose-e3 min-h-20 rounded-lg bg-base-200 p-3" dangerouslySetInnerHTML={{ __html: cleanHtml(markdownToHtml(q.text || t("empty"))) }} />
			) : (
				<textarea
					className="textarea min-h-20 w-full font-mono text-sm"
					placeholder={t("questionPlaceholder")}
					aria-label={t("questionText")}
					value={q.text}
					onChange={e => onChange({ text: e.target.value })}
				/>
			)}

			{(q.type === "single" || q.type === "multi") && (
				<fieldset className="mt-3 min-w-0">
					<legend className="sr-only">{t("choicesLegend")}</legend>
					<ul className="space-y-2">
						{q.choices.map((c, i) => (
							<li key={i} className="flex items-center gap-2">
								<input
									type={q.type === "single" ? "radio" : "checkbox"}
									name={`correct-${q.id}`}
									className={q.type === "single" ? "radio radio-sm radio-success" : "checkbox checkbox-sm checkbox-success"}
									checked={c.correct}
									onChange={e => onChange({ choices: q.choices.map((x, j) => ({ ...x, correct: q.type === "single" ? j === i : j === i ? e.target.checked : x.correct })) })}
									aria-label={t("optionCorrect", letter(i))}
								/>
								<span aria-hidden className="w-4 text-sm text-base-content/65">
									{letter(i)}
								</span>
								<input
									className="input input-sm min-w-0 grow"
									value={c.text}
									placeholder={t("optionPlaceholder")}
									aria-label={t("optionN", letter(i))}
									onChange={e => onChange({ choices: q.choices.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
								/>
								<button className="btn btn-ghost btn-xs btn-square" onClick={() => onChange({ choices: q.choices.filter((_, j) => j !== i) })} aria-label={t("removeOption", letter(i))}>
									<TrashIcon size={13} />
								</button>
							</li>
						))}
						<li>
							<button className="btn btn-ghost btn-xs" onClick={() => onChange({ choices: [...q.choices, { text: "", correct: false }] })}>
								<PlusIcon size={13} />
								{t("addOption")}
							</button>
						</li>
					</ul>
				</fieldset>
			)}
			{q.type === "truefalse" && (
				<fieldset className="mt-3">
					<legend className="sr-only">{t("correctAnswer")}</legend>
					<div className="join">
						<button className={`btn join-item btn-sm ${q.truth ? "btn-success" : ""}`} aria-pressed={!!q.truth} onClick={() => onChange({ truth: true })}>
							{t("answerTrue")}
						</button>
						<button className={`btn join-item btn-sm ${!q.truth ? "btn-success" : ""}`} aria-pressed={!q.truth} onClick={() => onChange({ truth: false })}>
							{t("answerFalse")}
						</button>
					</div>
				</fieldset>
			)}
			{(q.type === "short" || q.type === "numerical") && (
				<fieldset className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
					<legend className="sr-only">{t("answersLegend")}</legend>
					{q.answers.map((a, i) => (
						<input
							key={i}
							className="input input-sm w-40"
							placeholder={q.type === "numerical" ? t("correctValue") : t("acceptedAnswer")}
							aria-label={q.type === "numerical" ? t("correctValue") : t("acceptedAnswerN", i + 1)}
							aria-invalid={q.type === "numerical" && !!a.trim() && Number.isNaN(Number(a)) ? true : undefined}
							aria-describedby={q.type === "numerical" && !!a.trim() && Number.isNaN(Number(a)) ? `${uid}-issues` : undefined}
							value={a}
							inputMode={q.type === "numerical" ? "decimal" : undefined}
							onChange={e => onChange({ answers: q.answers.map((x, j) => (j === i ? e.target.value : x)) })}
						/>
					))}
					{q.type === "short" && (
						<button className="btn btn-ghost btn-xs" onClick={() => onChange({ answers: [...q.answers, ""] })}>
							<PlusIcon size={13} />
							{t("anotherAnswer")}
						</button>
					)}
					{q.type === "numerical" && (
						<label className="input input-sm w-40">
							<span className="text-xs opacity-75">{t("tolerance")}</span>
							<input type="number" min={0} step="any" value={q.tolerance ?? 0} onChange={e => onChange({ tolerance: Number(e.target.value) })} />
						</label>
					)}
				</fieldset>
			)}
			{q.type === "essay" && <p className="mt-3 text-xs text-base-content/65">{t("essayHint")}</p>}
		</fieldset>
	);
}

function PasteDialog({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (qs: Question[]) => void }) {
	const ref = useRef<HTMLDialogElement>(null);
	const [text, setText] = useState("");
	useEffect(() => {
		const d = ref.current;
		if (open && d && !d.open) d.showModal();
		if (!open && d?.open) d.close();
	}, [open]);
	const parsed = fromSpreadsheet(text);
	return (
		<dialog ref={ref} className="modal modal-bottom sm:modal-middle" onClose={onClose} aria-labelledby="paste-title">
			<div className="modal-box max-w-2xl">
				<h2 id="paste-title" className="text-lg font-semibold">
					{t("pasteFromSheet")}
				</h2>
				<p id="paste-help" className="mt-1 text-sm text-base-content/65">
					{t("pasteHelp")}
				</p>
				<textarea
					className="textarea mt-3 h-48 w-full font-mono text-xs"
					value={text}
					onChange={e => setText(e.target.value)}
					aria-label={t("pasteLabel")}
					aria-describedby="paste-help"
					placeholder={t("pastePlaceholder")}
				/>
				<p className="mt-2 text-sm" role="status">
					{parsed.length
						? t(
								"pasteRead",
								parsed.length,
								parsed.map(q => qtypeLabel(q.type))
							)
						: t("pasteEmpty")}
				</p>
				<div className="modal-action">
					<button className="btn btn-ghost" onClick={onClose}>
						{tc("cancel")}
					</button>
					<button
						className="btn btn-primary"
						disabled={!parsed.length}
						onClick={() => {
							onAdd(parsed);
							setText("");
							onClose();
						}}
					>
						{t("pasteAdd", parsed.length)}
					</button>
				</div>
			</div>
			<form method="dialog" className="modal-backdrop">
				<button>{tc("close")}</button>
			</form>
		</dialog>
	);
}
