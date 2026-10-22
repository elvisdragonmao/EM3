import { useCourseIndex } from "@/features/courses/api";
import { tc } from "@/i18n/common";
import { saveBlob } from "@/lib/download";
import { call } from "@/lib/moodle/client";
import type { Assignment, SubmissionStatus } from "@/lib/moodle/types";
import { deadlinePhrase } from "@/lib/time/relative";
import { CheckCircleIcon, CloudArrowUpIcon, CopyIcon, WarningIcon } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { displayName, feedbackComment, feedbackFiles, fetchAllStatuses, isAuditor, type Participant, submittedFiles, useGrantExtension, useSaveGrade, useStudentIds } from "./api";
import { invalidateCollab, saveDrafts } from "./collab-api";
import { t as tk } from "./collab-messages";
import { buildSubmissionZip, type CsvGrade, gradesCsv, gradesFromCsv, matchFeedbackFiles, readCsv, sheetText } from "./bundle";
import { t } from "./grading-messages";

export type BulkKind = "download" | "csv" | "files" | "extend";

interface Props {
	kind: BulkKind | null;
	onClose: () => void;
	assignment: Assignment;
	participants: Participant[];
	grades: Record<number, { grade: string }>;
	/** Server version: a release is scheduled, so imported grades are held on the EM3 server. */
	holding?: boolean;
}

function Shell({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
	const ref = useRef<HTMLDialogElement>(null);
	const titleId = useId();
	useEffect(() => {
		const d = ref.current;
		if (open && d && !d.open) d.showModal();
		if (!open && d?.open) d.close();
	}, [open]);
	return (
		<dialog ref={ref} className="modal modal-bottom sm:modal-middle" onClose={onClose} aria-labelledby={titleId}>
			<div className={`modal-box ${wide ? "max-w-4xl" : "max-w-lg"}`}>
				<h2 id={titleId} className="mb-4 text-lg font-semibold">
					{title}
				</h2>
				{open && children}
			</div>
			<form method="dialog" className="modal-backdrop">
				<button>{tc("close")}</button>
			</form>
		</dialog>
	);
}

const gradeText = (g?: { grade: string }) => (g && Number(g.grade) >= 0 ? String(Number(g.grade)) : "");

export function BulkDialogs({ kind, onClose, assignment, participants, grades, holding = false }: Props) {
	const sids = useStudentIds(assignment.course).data ?? {};
	return (
		<>
			<Shell open={kind === "download"} onClose={onClose} title={t("dlgDownload")}>
				<DownloadAll assignment={assignment} participants={participants} grades={grades} sids={sids} onClose={onClose} />
			</Shell>
			<Shell open={kind === "csv"} onClose={onClose} title={t("dlgCsv")} wide>
				<CsvImport assignment={assignment} participants={participants} grades={grades} sids={sids} onClose={onClose} holding={holding} />
			</Shell>
			<Shell open={kind === "files"} onClose={onClose} title={t("dlgFiles")} wide>
				<FilesUpload assignment={assignment} participants={participants} grades={grades} sids={sids} onClose={onClose} />
			</Shell>
			<Shell open={kind === "extend"} onClose={onClose} title={t("dlgExtend")}>
				<Extend assignment={assignment} participants={participants} sids={sids} onClose={onClose} />
			</Shell>
		</>
	);
}

type Sub = { assignment: Assignment; participants: Participant[]; grades: Record<number, { grade: string }>; sids: Record<number, string>; onClose: () => void };

function DownloadAll({ assignment, participants, grades, sids, onClose }: Sub) {
	const { byId } = useCourseIndex();
	const [stage, setStage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const submitted = participants.filter(p => p.submitted);
	const fileName = `${byId.get(assignment.course)?.raw.shortname ?? assignment.course}-${assignment.name}`.replace(/[\\/:*?"<>|]+/g, "_");

	async function run(withFiles: boolean) {
		setError(null);
		try {
			setStage(t("readingSubmissions"));
			const statuses = await fetchAllStatuses(
				assignment.id,
				participants.map(p => p.id),
				n => setStage(t("readingProgress", n, participants.length))
			);
			const csv = gradesCsv(participants.map(p => ({ p, sid: sids[p.id], status: statuses[p.id], grade: gradeText(grades[p.id]), comment: "" })));
			if (!withFiles) {
				saveBlob(csv, `${fileName}-${sheetText().gradesFile}.csv`);
			} else {
				const zip = await buildSubmissionZip(submitted, sids, statuses, csv, (d, total) => setStage(t("downloadingFiles", d, total)));
				saveBlob(zip, `${fileName}.zip`);
			}
			onClose();
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setStage(null);
		}
	}

	return (
		<div className="space-y-4 text-sm">
			<p className="text-base-content/70">{t("downloadIntro", submitted.length)}</p>
			<p className="text-base-content/70">{t("downloadIntro2", t("importCsv"), t("uploadFeedback"))}</p>
			<div role="status" className={stage ? "" : "sr-only"}>
				{stage && (
					<>
						<progress className="progress progress-primary w-full" aria-label={stage} />
						<p className="mt-1 text-xs text-base-content/65">{stage}</p>
					</>
				)}
			</div>
			{!stage && (
				<div className="modal-action">
					<button type="button" className="btn btn-ghost" onClick={() => void run(false)}>
						{t("csvOnly")}
					</button>
					<button type="button" className="btn btn-primary" onClick={() => void run(true)} disabled={!submitted.length}>
						{t("downloadZip")}
					</button>
				</div>
			)}
			<p role="alert" className={error ? "text-error" : "sr-only"}>
				{error && t("downloadFailed", error)}
			</p>
		</div>
	);
}

type Outcome = { ok: boolean; text: string } | null;

/** Live regions for the end of a bulk write; they exist from the start so screen readers announce the result. */
function OutcomeNote({ result }: { result: Outcome }) {
	return (
		<>
			<p role="status" className={result?.ok ? "mb-4 flex items-center gap-2" : "sr-only"}>
				{result?.ok && (
					<>
						<CheckCircleIcon size={20} className="text-success" weight="fill" />
						{result.text}
					</>
				)}
			</p>
			<p role="alert" className={result && !result.ok ? "mb-4 flex items-center gap-2 text-error" : "sr-only"}>
				{result && !result.ok && (
					<>
						<WarningIcon size={20} weight="fill" />
						{result.text}
					</>
				)}
			</p>
		</>
	);
}

function DoneButton({ onClose }: { onClose: () => void }) {
	return (
		<div className="modal-action">
			<button type="button" className="btn" onClick={onClose}>
				{t("done")}
			</button>
		</div>
	);
}

interface PlanRow {
	p: Participant;
	current: string;
	next: number | null;
	comment?: string;
	note?: string;
}

function CsvImport({ assignment, participants, grades, sids, onClose, holding }: Sub & { holding: boolean }) {
	const [rows, setRows] = useState<CsvGrade[] | null>(null);
	const [running, setRunning] = useState<{ done: number; total: number } | null>(null);
	const [result, setResult] = useState<Outcome>(null);
	const qc = useQueryClient();
	const max = assignment.grade;

	const plan = useMemo(() => {
		if (!rows) return null;
		const bySid = new Map(Object.entries(sids).map(([id, sid]) => [sid.toLowerCase(), Number(id)]));
		const byEmail = new Map(participants.filter(p => p.email).map(p => [p.email!.toLowerCase(), p.id]));
		const byId = new Map(participants.map(p => [p.id, p]));
		const ok: PlanRow[] = [];
		const problems: string[] = [];
		for (const r of rows) {
			if (r.error) {
				problems.push(t("lineError", r.line, r.error));
				continue;
			}
			const id = (r.sid && bySid.get(r.sid.toLowerCase())) || (r.userid && byId.has(r.userid) ? r.userid : undefined) || (r.email && byEmail.get(r.email));
			const p = id ? byId.get(id) : undefined;
			if (!p) {
				problems.push(t("studentNotFound", r.line, String(r.sid ?? r.email ?? r.userid)));
				continue;
			}
			const current = gradeText(grades[p.id]);
			const changed = (r.grade === null ? "" : String(r.grade)) !== current || !!r.comment?.trim();
			if (changed) ok.push({ p, current, next: r.grade, comment: r.comment?.trim() || undefined });
		}
		return { ok, problems };
	}, [rows, sids, participants, grades]);

	async function apply() {
		if (!plan) return;
		setRunning({ done: 0, total: plan.ok.length });
		try {
			// Existing comments must be sent back unchanged, so fetch them first.
			const statuses = await fetchAllStatuses(
				assignment.id,
				plan.ok.map(r => r.p.id)
			);
			const commentsOn = assignment.configs.some(c => c.subtype === "assignfeedback" && c.plugin === "comments" && c.name === "enabled" && c.value === "1");
			const commentOf = (r: PlanRow) => (r.comment ? `<p>${escapeHtml(r.comment).replace(/\n/g, "<br>")}</p>` : feedbackComment(statuses[r.p.id]));
			if (holding) {
				// Same grades and comments, held on the EM3 server until the scheduled release.
				await saveDrafts(
					assignment.course,
					assignment.id,
					plan.ok.map(r => ({ student: r.p.id, grade: r.next, feedback: commentsOn ? commentOf(r) : null }))
				);
				setResult({ ok: true, text: tk("heldN", plan.ok.length) });
				void invalidateCollab(qc, assignment.id);
				return;
			}
			for (let i = 0; i < plan.ok.length; i += 20) {
				const chunk = plan.ok.slice(i, i + 20);
				await call<null>("mod_assign_save_grades", {
					assignmentid: assignment.id,
					applytoall: true,
					grades: chunk.map(r => ({
						userid: r.p.id,
						grade: r.next ?? -1,
						attemptnumber: -1,
						addattempt: false,
						workflowstate: "",
						plugindata: commentsOn ? { assignfeedbackcomments_editor: { text: commentOf(r), format: 1 } } : {}
					})) as never
				});
				setRunning({ done: Math.min(plan.ok.length, i + chunk.length), total: plan.ok.length });
			}
			setResult({ ok: true, text: t("updated", plan.ok.length) });
			void qc.invalidateQueries({ queryKey: ["teach"] });
		} catch (e) {
			setResult({ ok: false, text: t("importAborted", e instanceof Error ? e.message : String(e)) });
		} finally {
			setRunning(null);
		}
	}

	const cols = sheetText().cols;
	return (
		<>
			<OutcomeNote result={result} />
			<p role="status" className="sr-only">
				{running ? t("writing", running.done, running.total) : ""}
			</p>
			{result ? (
				<DoneButton onClose={onClose} />
			) : (
				<div className="space-y-4 text-sm">
					<p className="text-base-content/70">{t("csvIntro", t("downloadAll"), cols.sid, cols.grade, cols.comment, max)}</p>
					{holding && <p className="rounded-lg bg-info/10 p-3 text-xs">{tk("csvHeld")}</p>}
					<input
						type="file"
						accept=".csv,text/csv"
						className="file-input w-full"
						aria-label={t("csvFile")}
						onChange={async e => e.target.files?.[0] && setRows(gradesFromCsv(await readCsv(e.target.files[0]), max))}
					/>
					{plan && (
						<>
							{plan.problems.length > 0 && (
								<ul className="max-h-28 space-y-1 overflow-y-auto rounded-lg bg-warning/10 p-3 text-xs" aria-label={t("problems")}>
									{plan.problems.map(p => (
										<li key={p} className="flex gap-1">
											<WarningIcon size={13} className="mt-0.5 shrink-0 text-warning" />
											{p}
										</li>
									))}
								</ul>
							)}
							{plan.ok.length ? (
								<div className="max-h-80 overflow-auto rounded-lg border hairline">
									<table className="table table-sm">
										<caption className="sr-only">{t("planCaption")}</caption>
										<thead>
											<tr>
												<th scope="col">{t("colStudent")}</th>
												<th scope="col" className="text-right">
													{t("colCurrent")}
												</th>
												<th scope="col" className="text-right">
													{t("colNext")}
												</th>
												<th scope="col">{t("colComment")}</th>
											</tr>
										</thead>
										<tbody>
											{plan.ok.map(r => (
												<tr key={r.p.id}>
													<th scope="row" className="font-normal">
														{displayName(r.p.fullname)} <span className="text-xs text-base-content/65">{sids[r.p.id]}</span>
													</th>
													<td className="text-right tabular-nums text-base-content/65">{r.current || "—"}</td>
													<td className="text-right font-semibold tabular-nums">{r.next ?? t("clear")}</td>
													<td className="max-w-56 truncate text-xs">{r.comment ?? <span className="text-base-content/65">{t("unchanged")}</span>}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							) : (
								<p className="text-base-content/65">{t("noChanges")}</p>
							)}
							{running ? (
								<progress className="progress progress-primary w-full" value={running.done} max={running.total} aria-label={t("writing", running.done, running.total)} />
							) : (
								<div className="modal-action">
									<button type="button" className="btn btn-ghost" onClick={onClose}>
										{tc("cancel")}
									</button>
									<button type="button" className="btn btn-primary" disabled={!plan.ok.length} onClick={() => void apply()}>
										{holding ? tk("holdN", plan.ok.length) : t("writeN", plan.ok.length)}
									</button>
								</div>
							)}
						</>
					)}
				</div>
			)}
		</>
	);
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function FilesUpload({ assignment, participants, grades, sids, onClose }: Sub) {
	const [plan, setPlan] = useState<{ matched: Map<number, File[]>; unmatched: string[] } | null>(null);
	const [skipped, setSkipped] = useState(0);
	const [running, setRunning] = useState<{ done: number; total: number } | null>(null);
	const [result, setResult] = useState<Outcome>(null);
	const [reading, setReading] = useState(false);
	const [readError, setReadError] = useState<string | null>(null);
	const save = useSaveGrade(assignment);
	const input = useRef<HTMLInputElement>(null);

	async function read(files: File[]) {
		setReadError(null);
		setReading(true);
		try {
			await match(files);
		} catch (e) {
			setReadError(e instanceof Error ? e.message : String(e));
		} finally {
			setReading(false);
		}
	}
	async function match(files: File[]) {
		const statuses = await fetchAllStatuses(
			assignment.id,
			participants.map(p => p.id)
		);
		const res = await matchFeedbackFiles(files, new Set(participants.map(p => p.id)));
		// Students' own files are still in their folders; only upload what is new or changed.
		let dropped = 0;
		for (const [id, list] of res.matched) {
			const original = submittedFiles(statuses[id]);
			const kept = list.filter(f => !original.some(o => o.filename === f.name && o.filesize === f.size));
			dropped += list.length - kept.length;
			if (kept.length) res.matched.set(id, kept);
			else res.matched.delete(id);
		}
		setSkipped(dropped);
		setPlan(res);
		statusCache.current = statuses;
	}
	const statusCache = useRef<Record<number, SubmissionStatus>>({});

	async function apply() {
		if (!plan) return;
		const entries = [...plan.matched];
		setRunning({ done: 0, total: entries.length });
		try {
			for (const [i, [id, files]] of entries.entries()) {
				const st = statusCache.current[id];
				const g = grades[id];
				await save.mutateAsync({
					userid: id,
					grade: g && Number(g.grade) >= 0 ? Number(g.grade) : null,
					commentHtml: feedbackComment(st),
					files,
					keepFiles: feedbackFiles(st)
				});
				setRunning({ done: i + 1, total: entries.length });
			}
			setResult({ ok: true, text: t("returned", entries.length) });
		} catch (e) {
			setResult({ ok: false, text: t("uploadAborted", e instanceof Error ? e.message : String(e)) });
		} finally {
			setRunning(null);
		}
	}

	const byId = new Map(participants.map(p => [p.id, p]));
	const summary = reading ? t("readingFiles") : plan ? t("matchedSummary", plan.matched.size, skipped, plan.unmatched.length) : "";
	return (
		<>
			<OutcomeNote result={result} />
			<p role="status" className="sr-only">
				{running ? t("uploading", running.done, running.total) : ""}
			</p>
			{result ? (
				<DoneButton onClose={onClose} />
			) : (
				<div className="space-y-4 text-sm">
					<p className="text-base-content/70">{t("filesIntro")}</p>
					<button
						type="button"
						className="flex w-full flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-base-content/15 px-4 py-6 hover:border-base-content/30"
						onClick={() => input.current?.click()}
						onDragOver={e => e.preventDefault()}
						onDrop={e => {
							e.preventDefault();
							if (e.dataTransfer.files.length) void read(Array.from(e.dataTransfer.files));
						}}
					>
						<CloudArrowUpIcon size={30} weight="duotone" className="text-base-content/65" />
						{t("chooseFiles")}
					</button>
					<input ref={input} type="file" multiple accept=".zip,*/*" hidden onChange={e => e.target.files && void read(Array.from(e.target.files))} />
					<p role="status" className={summary ? "" : "sr-only"}>
						{summary}
					</p>
					<p role="alert" className={readError ? "text-error" : "sr-only"}>
						{readError && t("readFailed", readError)}
					</p>
					{plan && !reading && (
						<>
							<ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border hairline p-3 text-xs" aria-label={t("matchedFiles")}>
								{[...plan.matched].map(([id, files]) => (
									<li key={id}>
										<span className="font-medium">
											{displayName(byId.get(id)?.fullname ?? String(id))} {sids[id]}
										</span>
										<span className="text-base-content/65"> · {files.map(f => f.name).join(t("listSep"))}</span>
									</li>
								))}
								{plan.unmatched.map(n => (
									<li key={n} className="flex gap-1 text-warning">
										<WarningIcon size={13} className="mt-0.5 shrink-0" />
										{t("unmatchedFile", n)}
									</li>
								))}
							</ul>
							{running ? (
								<progress className="progress progress-primary w-full" value={running.done} max={running.total} aria-label={t("uploading", running.done, running.total)} />
							) : (
								<div className="modal-action">
									<button type="button" className="btn btn-ghost" onClick={onClose}>
										{tc("cancel")}
									</button>
									<button type="button" className="btn btn-primary" disabled={!plan.matched.size} onClick={() => void apply()}>
										{t("uploadToN", plan.matched.size)}
									</button>
								</div>
							)}
						</>
					)}
				</div>
			)}
		</>
	);
}

function Extend({ assignment, participants, sids, onClose }: { assignment: Assignment; participants: Participant[]; sids: Record<number, string>; onClose: () => void }) {
	const base = Math.max(assignment.duedate, Math.floor(Date.now() / 1000));
	const [days, setDays] = useState(1);
	const [picked, setPicked] = useState<Set<number>>(() => new Set(participants.filter(p => !p.submitted && !isAuditor(p)).map(p => p.id)));
	const [copied, setCopied] = useState(false);
	const grant = useGrantExtension(assignment);
	const until = base + days * 86400;
	const missing = participants.filter(p => !p.submitted);

	async function copyMissing() {
		await navigator.clipboard.writeText(missing.map(p => `${sids[p.id] ?? ""} ${displayName(p.fullname)}`.trim()).join("\n"));
		setCopied(true);
	}

	return (
		<div className="space-y-4 text-sm">
			<div className="flex items-center justify-between gap-2 rounded-lg bg-base-200 px-3 py-2">
				<span>{t("missingCount", missing.length)}</span>
				<button type="button" className="btn btn-ghost btn-xs" onClick={() => void copyMissing()}>
					<CopyIcon size={13} />
					{copied ? tc("copied") : t("copyList")}
				</button>
				<span role="status" className="sr-only">
					{copied ? tc("copied") : ""}
				</span>
			</div>
			<fieldset className="flex flex-wrap gap-2">
				<legend className="sr-only">{t("extendBy")}</legend>
				{[1, 3, 7].map(d => (
					<button key={d} type="button" aria-pressed={days === d} className={`btn btn-sm ${days === d ? "btn-neutral" : ""}`} onClick={() => setDays(d)}>
						{t("plusDays", d)}
					</button>
				))}
			</fieldset>
			<p aria-live="polite">{t("newDeadline", deadlinePhrase(until))}</p>
			<fieldset>
				<legend className="sr-only">{t("extendWho")}</legend>
				<ul className="max-h-60 space-y-1 overflow-y-auto rounded-lg border hairline p-2">
					{participants.map(p => (
						<li key={p.id}>
							<label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-base-content/[0.04]">
								<input
									type="checkbox"
									className="checkbox checkbox-xs"
									checked={picked.has(p.id)}
									onChange={e => setPicked(s => (e.target.checked ? new Set(s).add(p.id) : new Set([...s].filter(x => x !== p.id))))}
								/>
								<span className="grow">{displayName(p.fullname)}</span>
								<span className="text-xs text-base-content/65">{p.submitted ? t("handedIn") : t("notHandedIn")}</span>
							</label>
						</li>
					))}
				</ul>
			</fieldset>
			<p role="alert" className={grant.error ? "text-error" : "sr-only"}>
				{grant.error?.message}
			</p>
			<p role="status" className={grant.isSuccess ? "text-success" : "sr-only"}>
				{grant.isSuccess ? t("extendedN", picked.size) : ""}
			</p>
			{!grant.isSuccess && (
				<div className="modal-action">
					<button type="button" className="btn btn-ghost" onClick={onClose}>
						{tc("cancel")}
					</button>
					<button type="button" className="btn btn-primary" disabled={!picked.size || grant.isPending} onClick={() => grant.mutate({ userids: [...picked], until })}>
						{t("extendN", picked.size)}
					</button>
				</div>
			)}
		</div>
	);
}
