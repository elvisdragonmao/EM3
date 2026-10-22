import { useAssignments } from "@/features/assignments/api";
import { useCourseIndex } from "@/features/courses/api";
import { CourseTag } from "@/shared/ui/CourseTag";
import { SectionTitle } from "@/shared/ui/States";
import { ChalkboardTeacherIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { usePrefs } from "@/features/preferences/store";
import { useTeaching } from "./api";
import { t } from "./grading-messages";
import { useGradingProgress } from "./TeachTab";

/** Dashboard card for teachers and TAs: assignments with submissions waiting for a grade. */
export function GradingQueue() {
	const { teaching } = useTeaching();
	const { byId } = useCourseIndex();
	const looks = usePrefs(s => s.courses);
	const ids = useMemo(
		() =>
			Object.keys(teaching)
				.map(Number)
				.filter(id => byId.has(id) && !looks[id]?.hidden),
		[teaching, byId, looks]
	);
	const assignments = useAssignments(ids);
	const progress = useGradingProgress(assignments.data ?? []);
	const queue = (progress.data ?? []).filter(p => p.needsGrading > 0).sort((a, b) => b.needsGrading - a.needsGrading);
	if (!ids.length || !queue.length) return null;

	return (
		<section className="card-quiet p-4">
			<SectionTitle>
				<span className="flex items-center gap-2">
					<ChalkboardTeacherIcon size={18} weight="duotone" className="text-primary" />
					{t("queueTitle")}
				</span>
			</SectionTitle>
			<ul className="-mx-1">
				{queue.map(p => {
					const course = byId.get(p.assignment.course);
					return (
						<li key={p.assignment.id}>
							<Link
								data-nav
								to="/courses/$courseId/assign/$cmid/grade"
								params={{ courseId: String(p.assignment.course), cmid: String(p.assignment.cmid) }}
								className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-base-content/[0.04]"
							>
								<span className="min-w-0 grow">
									<span className="block truncate text-sm font-medium">{p.assignment.name}</span>
									{course && <CourseTag course={course} />}
								</span>
								<span className="shrink-0 text-right">
									<span className="block text-lg font-semibold text-warning tabular-nums">{p.needsGrading}</span>
									<span className="text-[0.7rem] text-base-content/65">{t("toGrade")}</span>
								</span>
							</Link>
						</li>
					);
				})}
			</ul>
		</section>
	);
}
