import { assignRules, useAssignments } from "@/features/assignments/api";
import { t as ta } from "@/features/assignments/messages";
import { usePrefs } from "@/features/preferences/store";
import type { ParsedCourse } from "@/features/courses/parse";
import { ServerOnly } from "@/features/server/ServerOnly";
import { tc } from "@/i18n/common";
import { callMany } from "@/lib/moodle/client";
import { e3Link } from "@/lib/moodle/files";
import type { Assignment } from "@/lib/moodle/types";
import { Due } from "@/shared/ui/Time";
import { Empty, Lines } from "@/shared/ui/States";
import {
	ArrowSquareOutIcon,
	CaretRightIcon,
	ChalkboardTeacherIcon,
	ExamIcon,
	FilePlusIcon,
	ListChecksIcon,
	MegaphoneIcon,
	NotePencilIcon,
	TableIcon,
	UsersThreeIcon,
	WarningIcon
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AllocationSection } from "./AllocationDialog";
import type { Participant } from "./api";
import { t as tk } from "./collab-messages";
import { t } from "./messages";

export interface Progress {
	assignment: Assignment;
	total: number;
	submitted: number;
	needsGrading: number;
}

interface SubsResponse {
	assignments: { assignmentid: number; submissions: { userid: number; status: string; timemodified: number }[] }[];
}
interface GradesResponse {
	assignments: { assignmentid: number; grades: { userid: number; grade: string; timemodified: number }[] }[];
}

/**
 * Submission / grading counts for many assignments in one round trip. Counts
 * come from the submissions table, not E3's grading table, which can miss
 * students whose enrolment changed.
 */
export function useGradingProgress(assignments: Assignment[]) {
	const ids = assignments.map(a => a.id);
	return useQuery({
		queryKey: ["teach", "progress", ids],
		enabled: ids.length > 0,
		staleTime: 2 * 60_000,
		queryFn: async () => {
			const [subs, grades, ...lists] = await callMany<unknown>([
				{ fn: "mod_assign_get_submissions", args: { assignmentids: ids } },
				{ fn: "mod_assign_get_grades", args: { assignmentids: ids } },
				...assignments.map(a => ({ fn: "mod_assign_list_participants", args: { assignid: a.id, groupid: 0, filter: "" } }))
			]);
			return assignments.map((a, i): Progress => {
				const submitted = ((subs as SubsResponse | null)?.assignments.find(x => x.assignmentid === a.id)?.submissions ?? []).filter(s => s.status === "submitted");
				const g = new Map(((grades as GradesResponse | null)?.assignments.find(x => x.assignmentid === a.id)?.grades ?? []).map(x => [x.userid, x]));
				const needsGrading = submitted.filter(s => {
					const grade = g.get(s.userid);
					return !grade || Number(grade.grade) < 0 || grade.timemodified < s.timemodified;
				}).length;
				const roster = ((lists[i] as Participant[] | null) ?? []).filter(p => !p.suspended).length;
				return { assignment: a, total: Math.max(roster, submitted.length), submitted: submitted.length, needsGrading };
			});
		}
	});
}

export function setupWarnings(a: Assignment): string[] {
	const out: string[] = [];
	const rules = assignRules(a);
	if (!a.nosubmissions && !rules.fileEnabled && !rules.textEnabled) out.push(t("warnNoSubmission"));
	if (a.duedate) {
		const d = new Date(a.duedate * 1000);
		if (d.getHours() === 0 && d.getMinutes() === 0) out.push(t("warnMidnight"));
	} else if (!a.nosubmissions) out.push(t("warnNoDue"));
	if (a.cutoffdate && a.duedate && a.cutoffdate < a.duedate) out.push(t("warnCutoff"));
	return out;
}

export function TeachTab({ course }: { course: ParsedCourse }) {
	const ids = useMemo(() => [course.id], [course.id]);
	const assignments = useAssignments(ids);
	const progress = useGradingProgress(assignments.data ?? []);
	const skip = usePrefs(s => s.skipGrading);
	const id = String(course.id);

	const inEm3 = [
		{ to: "/courses/$courseId/announce", label: t("announce"), desc: t("announceDesc"), icon: MegaphoneIcon },
		{ to: "/courses/$courseId/write", label: t("write"), desc: t("writeDesc"), icon: NotePencilIcon },
		{ to: "/courses/$courseId/quiz-builder", label: t("quizBuilder"), desc: t("quizBuilderDesc"), icon: ExamIcon }
	] as const;
	const inE3 = [
		{ href: `/course/modedit.php?add=resource&course=${id}&section=0&return=0`, label: t("uploadFile"), icon: FilePlusIcon },
		{ href: `/course/modedit.php?add=assign&course=${id}&section=0&return=0`, label: t("newAssignment"), icon: ListChecksIcon },
		{ href: `/course/modedit.php?add=quiz&course=${id}&section=0&return=0`, label: t("newQuiz"), icon: ExamIcon },
		{ href: `/grade/report/grader/index.php?id=${id}`, label: t("gradebook"), icon: TableIcon },
		{ href: `/user/index.php?id=${id}`, label: t("participants"), icon: UsersThreeIcon },
		{ href: `/course/view.php?id=${id}`, label: t("editCoursePage"), icon: ChalkboardTeacherIcon }
	];

	return (
		<div className="space-y-8">
			<section>
				<h2 className="mb-3 text-sm font-semibold text-base-content/70">{t("gradingHeading")}</h2>
				{assignments.isPending ? (
					<Lines n={3} />
				) : !assignments.data?.length ? (
					<Empty title={t("noAssignments")} />
				) : (
					<ul className="card-quiet divide-y divide-base-content/[0.06] overflow-hidden">
						{(assignments.data ?? []).map(a => {
							const p = progress.data?.find(x => x.assignment.id === a.id);
							const warnings = setupWarnings(a);
							const skipped = !!skip[a.cmid];
							return (
								<li key={a.id}>
									<Link
										data-nav
										to="/courses/$courseId/assign/$cmid/grade"
										params={{ courseId: id, cmid: String(a.cmid) }}
										className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-base-content/[0.03]"
									>
										<span className="min-w-0 grow">
											<span className="flex items-center gap-2">
												<span className="truncate font-medium">{a.name}</span>
												{skipped && <span className="badge shrink-0 badge-xs badge-soft badge-neutral">{ta("skippedGradingBadge")}</span>}
											</span>
											<span className="mt-0.5 block text-xs text-base-content/65">{a.duedate ? <Due ts={a.duedate} /> : t("noDueDate")}</span>
											{warnings.map(w => (
												<span key={w} className="mt-1 flex items-center gap-1 text-xs text-warning">
													<WarningIcon size={12} />
													{w}
												</span>
											))}
										</span>
										{p ? (
											<span className="flex shrink-0 items-center gap-4 text-right text-xs tabular-nums">
												<span>
													<span aria-hidden>
														<span className="block text-base font-semibold">
															{p.submitted}
															<span className="text-xs font-normal text-base-content/65">/{p.total}</span>
														</span>
														{t("submittedShort")}
													</span>
													<span className="sr-only">{t("submittedOf", p.submitted, p.total)}</span>
												</span>
												<span className={p.needsGrading && !skipped ? "text-warning" : "text-base-content/65"}>
													<span aria-hidden>
														<span className="block text-base font-semibold">{p.needsGrading}</span>
														{t("toGradeShort")}
													</span>
													<span className="sr-only">{t("toGrade", p.needsGrading)}</span>
												</span>
											</span>
										) : (
											<span className="skeleton h-8 w-20">
												<span className="sr-only">{t("loadingProgress")}</span>
											</span>
										)}
										<CaretRightIcon size={16} className="shrink-0 text-base-content/65" />
									</Link>
								</li>
							);
						})}
					</ul>
				)}
			</section>

			<section>
				<h2 className="mb-3 text-sm font-semibold text-base-content/70">{tk("allocHeading")}</h2>
				<ServerOnly compact>
					<AllocationSection courseId={course.id} />
				</ServerOnly>
			</section>

			<section>
				<h2 className="mb-3 text-sm font-semibold text-base-content/70">{t("inEm3Heading")}</h2>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
					{inEm3.map(x => (
						<Link key={x.to} to={x.to} params={{ courseId: id }} className="card-quiet flex items-start gap-3 p-4 transition hover:-translate-y-0.5">
							<x.icon size={24} weight="duotone" className="shrink-0 text-primary" />
							<span>
								<span className="block font-medium">{x.label}</span>
								<span className="text-xs text-base-content/65">{x.desc}</span>
							</span>
						</Link>
					))}
				</div>
			</section>

			<section>
				<h2 className="mb-1 text-sm font-semibold text-base-content/70">{t("inE3Heading")}</h2>
				<p className="mb-3 text-xs text-base-content/65">{t("inE3Desc")}</p>
				<ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
					{inE3.map(x => (
						<li key={x.href}>
							<a href={e3Link(x.href)} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-base-content/[0.04]">
								<x.icon size={18} className="shrink-0 text-base-content/65" />
								<span className="grow">
									{x.label}
									<span className="sr-only">{tc("openInNewTab")}</span>
								</span>
								<ArrowSquareOutIcon size={14} className="text-base-content/65" />
							</a>
						</li>
					))}
				</ul>
			</section>
		</div>
	);
}
