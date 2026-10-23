import { FileIcon } from "@/features/course/FileIcon";
import { openFile } from "@/features/course/FilePreview";
import { useCourseIndex } from "@/features/courses/api";
import { cleanHtml, e3Link, fileExt, humanSize } from "@/lib/moodle/files";
import type { InlineFile } from "@/lib/moodle/types";
import { countdown, deadlinePhrase, fullDateTime } from "@/lib/time/relative";
import { tc } from "@/i18n/common";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { CourseTag } from "@/shared/ui/CourseTag";
import { ErrorNote, Lines } from "@/shared/ui/States";
import { Ago } from "@/shared/ui/Time";
import { ArrowLeftIcon, ArrowSquareOutIcon, ChatTextIcon, ClockIcon, HourglassIcon, LockIcon, PaperclipIcon } from "@phosphor-icons/react";
import { useParams, useRouter } from "@tanstack/react-router";
import { useMemo } from "react";
import { assignRules, submissionFiles, TASK_STATE_LABEL, taskState, useAssignments, useSubmissionStatus, withSkip } from "./api";
import { t } from "./messages";
import { SkipToggle, useSkipped } from "./SkipToggle";
import { SubmitPanel } from "./SubmitPanel";

export const toMaterialFile = (f: InlineFile) => ({ key: f.fileurl, name: f.filename, url: f.fileurl, size: f.filesize, mime: f.mimetype, ext: fileExt(f.filename), time: f.timemodified, path: "/" });

export function FileChips({ files }: { files: InlineFile[] }) {
	return (
		<ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
			{files.map(f => {
				const mf = toMaterialFile(f);
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

export function AssignmentPage() {
	const { courseId, cmid } = useParams({ from: "/app/courses/$courseId/assign/$cmid" });
	const router = useRouter();
	const { byId } = useCourseIndex();
	const course = byId.get(Number(courseId));
	const ids = useMemo(() => [Number(courseId)], [courseId]);
	const assignments = useAssignments(ids);
	const a = assignments.data?.find(x => x.cmid === Number(cmid));
	const status = useSubmissionStatus(a?.id);
	const skipped = useSkipped("submit", Number(cmid));
	useDocumentTitle(a?.name);

	if (assignments.error) return <ErrorNote error={assignments.error} retry={assignments.refetch} />;
	if (assignments.isPending || (a && status.isPending)) return <Lines n={6} />;
	if (!a) return <p className="py-20 text-center text-base-content/65">{t("notFound")}</p>;

	const rules = assignRules(a);
	const state = taskState(a, status.data);
	const shown = withSkip(state, skipped);
	const st = status.data;
	const files = submissionFiles(st);
	const sub = st?.lastattempt?.submission;
	const introFiles = [...(st?.assignmentdata?.attachments?.intro ?? a.introattachments ?? [])];
	const due = Math.max(a.duedate, st?.lastattempt?.extensionduedate ?? 0);
	const cd = due ? countdown(due) : null;
	const feedbackFiles = st?.feedback?.plugins?.flatMap(p => p.fileareas?.flatMap(f => f.files ?? []) ?? []) ?? [];
	const feedbackText = st?.feedback?.plugins?.flatMap(p => p.editorfields ?? []).filter(e => e.text.trim()) ?? [];

	return (
		<div className="mx-auto max-w-5xl">
			<button type="button" onClick={() => router.history.back()} className="btn btn-ghost btn-sm mb-4 -ml-2">
				<ArrowLeftIcon size={16} />
				{t("back")}
			</button>

			<header className="mb-6">
				{course && <CourseTag course={course} link />}
				<h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{a.name}</h1>
				<div className="mt-3 flex flex-wrap items-center gap-2">
					<span
						className={`badge badge-soft ${shown === "submitted" || shown === "graded" ? "badge-success" : shown === "skipped" ? "badge-neutral" : shown === "late" ? "badge-error" : shown === "todo" ? "badge-info" : "badge-ghost"}`}
					>
						{TASK_STATE_LABEL[shown]}
					</span>
					{cd && (shown === "todo" || shown === "late") && (
						<span className={`text-sm ${cd.urgency === "critical" || cd.urgency === "overdue" ? "text-error" : "text-base-content/65"}`}>{cd.text}</span>
					)}
				</div>
			</header>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
				<div className="min-w-0 space-y-6">
					<dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
						<Fact icon={<ClockIcon size={16} />} label={t("due")} value={due ? deadlinePhrase(due) : t("noDue")} hint={due ? fullDateTime(due) : undefined} />
						<Fact
							icon={<LockIcon size={16} />}
							label={t("cutoff")}
							value={a.cutoffdate ? deadlinePhrase(a.cutoffdate) : due ? t("noLimit") : "—"}
							hint={a.cutoffdate ? fullDateTime(a.cutoffdate) : t("lateAllowed")}
						/>
						{a.allowsubmissionsfromdate > Date.now() / 1000 ? (
							<Fact icon={<HourglassIcon size={16} />} label={t("opens")} value={deadlinePhrase(a.allowsubmissionsfromdate)} hint={fullDateTime(a.allowsubmissionsfromdate)} />
						) : (
							<Fact
								icon={<PaperclipIcon size={16} />}
								label={t("method")}
								value={rules.fileEnabled ? t("methodFiles", rules.maxFiles) : rules.textEnabled ? t("methodText") : t("methodNone")}
								hint={rules.accept.length ? t("onlyTypes", rules.accept.join(" ")) : rules.fileEnabled ? t("anyType") : undefined}
							/>
						)}
					</dl>

					{(a.intro || introFiles.length > 0) && (
						<section className="card-quiet p-5">
							<h2 className="mb-2 text-sm font-semibold text-base-content/65">{t("description")}</h2>
							{a.intro && <div className="prose-e3" dangerouslySetInnerHTML={{ __html: cleanHtml(a.intro) }} />}
							{introFiles.length > 0 && (
								<div className="mt-4">
									<FileChips files={introFiles} />
								</div>
							)}
						</section>
					)}

					{st?.feedback && (
						<section className="card-quiet p-5">
							<h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-base-content/65">
								<ChatTextIcon size={16} />
								{t("feedback")}
							</h2>
							{st.feedback.gradefordisplay && <div className="mb-3 text-3xl font-semibold tabular-nums" dangerouslySetInnerHTML={{ __html: cleanHtml(st.feedback.gradefordisplay) }} />}
							{feedbackText.map(f => (
								<div key={f.name} className="prose-e3 text-sm" dangerouslySetInnerHTML={{ __html: cleanHtml(f.text) }} />
							))}
							{feedbackFiles.length > 0 && (
								<div className="mt-3">
									<FileChips files={feedbackFiles} />
								</div>
							)}
							{st.feedback.gradeddate > 0 && <p className="mt-3 text-xs text-base-content/65">{t("gradedAt", <Ago ts={st.feedback.gradeddate} />)}</p>}
						</section>
					)}
				</div>

				<aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
					<section className="card-quiet p-4">
						<h2 className="mb-3 text-sm font-semibold text-base-content/65">{t("mySubmission")}</h2>
						{files.length ? (
							<>
								<FileChips files={files} />
								{sub && <p className="mt-2 text-xs text-base-content/65">{t("lastUpdated", <Ago ts={sub.timemodified} />, fullDateTime(sub.timemodified))}</p>}
							</>
						) : (
							<p className="text-sm text-base-content/65">{t("noFiles")}</p>
						)}
					</section>
					<SubmitPanel assignment={a} status={st} state={state} rules={rules} existing={files} />
					{/* Once it's handed in or graded the mark changes nothing, so it's only offered for undoing. */}
					{(skipped || (state !== "submitted" && state !== "graded")) && <SkipToggle kind="submit" cmid={a.cmid} />}
					<a className="btn btn-ghost btn-sm w-full" href={e3Link(`/mod/assign/view.php?id=${a.cmid}`)} target="_blank" rel="noreferrer">
						<ArrowSquareOutIcon size={15} />
						{t("openOnE3")}
						<span className="sr-only">{tc("openInNewTab")}</span>
					</a>
				</aside>
			</div>
		</div>
	);
}

export function Fact({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
	return (
		<div className="card-quiet px-4 py-3" title={hint}>
			<dt className="flex items-center gap-1.5 text-xs text-base-content/65">
				{icon}
				{label}
			</dt>
			<dd className="mt-1 font-medium">{value}</dd>
			{hint && <dd className="mt-0.5 text-xs [overflow-wrap:anywhere] text-base-content/65">{hint}</dd>}
		</div>
	);
}
