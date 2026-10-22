import { FileIcon } from "@/features/course/FileIcon";
import { fileExt, humanSize } from "@/lib/moodle/files";
import type { Assignment, InlineFile, SubmissionStatus } from "@/lib/moodle/types";
import { CheckCircleIcon, CloudArrowUpIcon, LockIcon, TrashIcon, WarningIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { type DragEvent, useEffect, useId, useRef, useState } from "react";
import { tc } from "@/i18n/common";
import { MOD_LABEL, useHotkeys } from "@/shared/keyboard/hotkeys";
import { type AssignRules, type TaskState, useSubmitAssignment } from "./api";
import { t } from "./messages";

type Stage = "preparing" | "uploading" | "saving" | "submitting";
const stageLabel = (s: Stage) => t(s === "preparing" ? "stagePreparing" : s === "uploading" ? "stageUploading" : s === "saving" ? "stageSaving" : "stageSubmitting");

/**
 * The whole submission flow in one panel: drop files → review → 繳交.
 * No file picker repositories, no licence fields, no separate edit page.
 */
export function SubmitPanel({ assignment, status, state, rules, existing }: { assignment: Assignment; status?: SubmissionStatus; state: TaskState; rules: AssignRules; existing: InlineFile[] }) {
	const [added, setAdded] = useState<File[]>([]);
	const [keep, setKeep] = useState<Set<string>>(() => new Set(existing.map(f => f.fileurl)));
	const [text, setText] = useState("");
	const [statement, setStatement] = useState(false);
	const [problems, setProblems] = useState<string[]>([]);
	const [dragging, setDragging] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const [stage, setStage] = useState<{ stage: Stage; p?: number } | null>(null);
	const [done, setDone] = useState(false);
	const input = useRef<HTMLInputElement>(null);
	const submit = useSubmitAssignment();
	const rulesId = useId();
	const problemsId = useId();

	useEffect(() => setKeep(new Set(existing.map(f => f.fileurl))), [existing]);
	const readyRef = useRef(false);
	readyRef.current = false;
	useHotkeys([
		{ keys: "u", run: () => input.current?.click() },
		{ keys: "mod+enter", run: () => readyRef.current && setConfirming(true), inInput: true }
	]);

	const canEdit = status?.lastattempt?.canedit ?? true;
	if (!rules.fileEnabled && !rules.textEnabled) return <Notice icon={<CheckCircleIcon size={18} />} text={t("notOnE3")} />;
	if (state === "upcoming") return <Notice icon={<LockIcon size={18} />} text={t("notOpenYet")} />;
	if (state === "closed" || !canEdit) return <Notice icon={<LockIcon size={18} />} text={t("closedNotice")} />;

	const kept = existing.filter(f => keep.has(f.fileurl));
	const total = kept.length + added.length;
	const tooMany = rules.fileEnabled && total > rules.maxFiles;
	const ready = (rules.fileEnabled ? total > 0 : true) && !!(!rules.textEnabled || rules.fileEnabled || text.trim()) && !tooMany && (!assignment.requiresubmissionstatement || statement);
	readyRef.current = ready && !stage;

	function accept(list: FileList | File[]) {
		const errs: string[] = [];
		const ok: File[] = [];
		for (const f of Array.from(list)) {
			const ext = `.${fileExt(f.name)}`;
			if (rules.accept.length && !rules.accept.includes(ext)) errs.push(t("rejectType", f.name, rules.accept.join(" ")));
			else if (rules.maxBytes && f.size > rules.maxBytes) errs.push(t("rejectSize", f.name, humanSize(rules.maxBytes)));
			else ok.push(f);
		}
		setProblems(errs);
		setAdded(prev => [...prev, ...ok.filter(f => !prev.some(p => p.name === f.name && p.size === f.size))]);
		setDone(false);
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		setDragging(false);
		if (e.dataTransfer.files.length) accept(e.dataTransfer.files);
	}

	async function run() {
		setConfirming(false);
		try {
			await submit.mutateAsync({ assignment, keep: kept, add: added, text: rules.textEnabled ? text : undefined, acceptStatement: statement, onProgress: (s, p) => setStage({ stage: s, p }) });
			setAdded([]);
			setDone(true);
		} finally {
			setStage(null);
		}
	}

	return (
		<section className="card-quiet p-4">
			<h2 className="mb-3 text-sm font-semibold text-base-content/65">{existing.length ? t("updateSubmission") : t("submit")}</h2>

			{rules.fileEnabled && (
				<>
					<button
						type="button"
						onClick={() => input.current?.click()}
						onDragOver={e => (e.preventDefault(), setDragging(true))}
						onDragLeave={() => setDragging(false)}
						onDrop={onDrop}
						aria-describedby={problems.length ? `${rulesId} ${problemsId}` : rulesId}
						aria-keyshortcuts="U"
						className={`flex w-full flex-col items-center gap-1 rounded-2xl border-2 border-dashed px-4 py-7 text-center transition ${dragging ? "scale-[1.02] border-primary bg-primary/5" : "border-base-content/15 hover:border-base-content/30"}`}
					>
						<CloudArrowUpIcon size={34} weight="duotone" className={dragging ? "text-primary" : "text-base-content/65"} />
						<span className="font-medium">{t("dropHere")}</span>
						<span className="hidden text-xs text-base-content/65 lg:inline" aria-hidden>
							{t("orPress", <kbd className="kbd kbd-xs">U</kbd>)}
						</span>
						<span id={rulesId} className="text-xs text-base-content/65">
							{t("rules", rules.accept.join(" "), rules.maxFiles, rules.maxBytes ? humanSize(rules.maxBytes) : "")}
						</span>
					</button>
					<input
						ref={input}
						type="file"
						multiple
						hidden
						aria-describedby={rulesId}
						accept={rules.accept.join(",") || undefined}
						onChange={e => e.target.files && (accept(e.target.files), (e.target.value = ""))}
					/>

					<div role="alert" id={problemsId}>
						{problems.length > 0 && (
							<ul className="mt-2 space-y-1 text-xs text-error">
								{problems.map(p => (
									<li key={p} className="flex gap-1">
										<WarningIcon size={14} className="shrink-0" />
										{p}
									</li>
								))}
							</ul>
						)}
					</div>

					{(existing.length > 0 || added.length > 0) && (
						<ul className="mt-3 space-y-1">
							<AnimatePresence initial={false}>
								{existing.map(f => (
									<motion.li key={f.fileurl} layout className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm">
										<input
											type="checkbox"
											className="checkbox checkbox-xs"
											checked={keep.has(f.fileurl)}
											onChange={e => setKeep(s => (e.target.checked ? new Set(s).add(f.fileurl) : new Set([...s].filter(x => x !== f.fileurl))))}
											aria-label={t("keepFile", f.filename)}
										/>
										<FileIcon ext={fileExt(f.filename)} size={18} />
										<span className={`min-w-0 grow truncate ${keep.has(f.fileurl) ? "" : "text-base-content/65 line-through"}`}>{f.filename}</span>
										<span className="text-xs text-base-content/65">{t("existingFile")}</span>
									</motion.li>
								))}
								{added.map(f => (
									<motion.li
										key={f.name + f.size}
										layout
										initial={{ opacity: 0, y: -6 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, x: 20 }}
										className="flex items-center gap-2 rounded-lg bg-primary/5 px-1 py-1 text-sm"
									>
										<FileIcon ext={fileExt(f.name)} size={18} />
										<span className="min-w-0 grow truncate">{f.name}</span>
										<span className="text-xs text-base-content/65">{humanSize(f.size)}</span>
										<button type="button" className="btn btn-ghost btn-xs btn-square" onClick={() => setAdded(a => a.filter(x => x !== f))} aria-label={t("removeFile", f.name)}>
											<TrashIcon size={14} />
										</button>
									</motion.li>
								))}
							</AnimatePresence>
						</ul>
					)}
					<div role="alert">{tooMany && <p className="mt-2 text-xs text-error">{t("tooMany", rules.maxFiles)}</p>}</div>
				</>
			)}

			{rules.textEnabled && <textarea className="textarea mt-3 h-36 w-full" aria-label={t("answer")} placeholder={t("answerPlaceholder")} value={text} onChange={e => setText(e.target.value)} />}

			{assignment.requiresubmissionstatement === 1 && (
				<label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-base-content/70">
					<input type="checkbox" className="checkbox checkbox-xs mt-0.5" checked={statement} onChange={e => setStatement(e.target.checked)} />
					<span>{assignment.submissionstatement ? new DOMParser().parseFromString(assignment.submissionstatement, "text/html").body.textContent : t("ownWork")}</span>
				</label>
			)}

			<AnimatePresence mode="wait">
				{stage ? (
					<motion.div key="progress" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4">
						<progress
							className="progress progress-primary w-full"
							aria-label={stageLabel(stage.stage)}
							value={stage.stage === "uploading" && stage.p !== undefined ? stage.p * 100 : undefined}
							max={100}
						/>
						<p className="mt-1 text-xs text-base-content/65" aria-hidden>
							{stageLabel(stage.stage)}…
						</p>
					</motion.div>
				) : done ? (
					<motion.div
						key="done"
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						className="mt-4 flex items-center gap-2 rounded-xl bg-success/10 px-3 py-3 text-sm text-success"
					>
						<motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 500, damping: 15 }}>
							<CheckCircleIcon size={22} weight="fill" />
						</motion.span>
						{t("submitted")}
					</motion.div>
				) : (
					<motion.button key="submit" type="button" whileTap={{ scale: 0.97 }} className="btn btn-primary mt-4 w-full" disabled={!ready} onClick={() => setConfirming(true)}>
						{existing.length ? t("updateSubmission") : t("submit")}
						{total > 0 && t("submitFiles", total)}
						<kbd className="kbd kbd-xs ml-1 hidden border-primary-content/30 bg-transparent text-primary-content/70 lg:inline-flex">{MOD_LABEL}↵</kbd>
					</motion.button>
				)}
			</AnimatePresence>
			<p className="sr-only" role="status">
				{stage ? stageLabel(stage.stage) : done ? t("submitted") : ""}
			</p>
			<div role="alert">{submit.error && <p className="mt-2 text-xs text-error">{t("submitFailed", submit.error.message)}</p>}</div>

			<ConfirmDialog
				open={confirming}
				onCancel={() => setConfirming(false)}
				onConfirm={run}
				name={assignment.name}
				kept={kept.map(f => f.filename)}
				added={added.map(f => f.name)}
				late={state === "late"}
			/>
		</section>
	);
}

function ConfirmDialog({
	open,
	onCancel,
	onConfirm,
	name,
	kept,
	added,
	late
}: {
	open: boolean;
	onCancel: () => void;
	onConfirm: () => void;
	name: string;
	kept: string[];
	added: string[];
	late: boolean;
}) {
	const ref = useRef<HTMLDialogElement>(null);
	const titleId = useId();
	useEffect(() => {
		const d = ref.current;
		if (open && d && !d.open) d.showModal();
		if (!open && d?.open) d.close();
	}, [open]);
	return (
		<dialog ref={ref} className="modal modal-bottom sm:modal-middle" onClose={onCancel} aria-labelledby={titleId}>
			<div className="modal-box">
				<h3 id={titleId} className="text-lg font-semibold">
					{t("confirmTitle", name)}
				</h3>
				<p className="mt-1 text-sm text-base-content/65">{t("confirmBody")}</p>
				<ul className="mt-3 space-y-1 text-sm">
					{[...kept.map(n => [n, "keep"] as const), ...added.map(n => [n, "add"] as const)].map(([n, tag]) => (
						<li key={n + tag} className="flex items-center gap-2">
							<FileIcon ext={fileExt(n)} size={18} />
							<span className="min-w-0 grow truncate">{n}</span>
							<span className={`badge badge-xs badge-soft ${tag === "add" ? "badge-primary" : "badge-ghost"}`}>{tag === "add" ? t("tagAdd") : t("tagKeep")}</span>
						</li>
					))}
				</ul>
				{late && <p className="mt-3 rounded-lg bg-warning/15 px-3 py-2 text-sm">{t("lateWarning")}</p>}
				<div className="modal-action">
					<button type="button" className="btn btn-ghost" onClick={onCancel}>
						{t("notYet")}
					</button>
					<button type="button" className="btn btn-primary" onClick={onConfirm}>
						{t("confirmSubmit")}
					</button>
				</div>
			</div>
			<form method="dialog" className="modal-backdrop">
				<button tabIndex={-1}>{tc("close")}</button>
			</form>
		</dialog>
	);
}

function Notice({ icon, text }: { icon: React.ReactNode; text: string }) {
	return (
		<section className="card-quiet flex items-start gap-2 p-4 text-sm text-base-content/65">
			<span className="mt-0.5 shrink-0">{icon}</span>
			{text}
		</section>
	);
}
