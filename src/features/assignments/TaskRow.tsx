import { submissionFiles, taskStateLabel } from "@/features/assignments/api";
import { t } from "@/features/assignments/messages";
import type { Task } from "@/features/assignments/tasks";
import { TaskAnchor } from "@/features/calendar/Board";
import { courseInk, useCourseLook } from "@/features/courses/look";
import { countdown } from "@/lib/time/relative";
import { CourseTag } from "@/shared/ui/CourseTag";
import { Due } from "@/shared/ui/Time";
import { CaretRightIcon, CheckCircleIcon, ExamIcon, LightningIcon, PaperclipIcon } from "@phosphor-icons/react";

const STATE_TONE: Record<Task["state"], string> = {
	upcoming: "badge-ghost",
	todo: "badge-info",
	late: "badge-error",
	closed: "badge-ghost",
	submitted: "badge-success",
	graded: "badge-success"
};

export function TaskRow({ t: task, showCourse = true }: { t: Task; showCourse?: boolean }) {
	const look = useCourseLook(task.course)!;
	const open = task.state === "todo" || task.state === "late";
	const cd = task.due ? countdown(task.due) : null;
	const files = submissionFiles(task.status).length;
	const body = (
		<>
			<span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: `color-mix(in oklab, ${look.color} 14%, transparent)`, color: courseInk(look.color) }}>
				{task.state === "submitted" || task.state === "graded" ? (
					<CheckCircleIcon size={22} weight="fill" />
				) : task.kind === "quiz" ? (
					<ExamIcon size={22} weight="duotone" />
				) : (
					<PaperclipIcon size={22} weight="duotone" />
				)}
			</span>
			<span className="min-w-0 grow">
				<span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
					<span className="truncate font-medium">{task.name}</span>
					{task.inClass && open && (
						<span className="badge badge-xs badge-warning badge-soft gap-0.5">
							<LightningIcon size={10} weight="fill" />
							{t("inClass")}
						</span>
					)}
				</span>
				<span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-base-content/65">
					{showCourse && <CourseTag course={task.course} />}
					{task.due ? <Due ts={task.due} /> : <span>{t("noDue")}</span>}
					{files > 0 && <span>{t("filesUploaded", files)}</span>}
					{task.kind === "quiz" && <span>{t("quizOnE3")}</span>}
				</span>
			</span>
			<span className="flex shrink-0 flex-col items-end gap-1">
				<span className={`badge badge-sm badge-soft ${STATE_TONE[task.state]}`}>{taskStateLabel(task.state, task.kind)}</span>
				{open && cd && <span className={`text-xs tabular-nums ${cd.urgency === "critical" || cd.urgency === "overdue" ? "text-error" : "text-base-content/65"}`}>{cd.text}</span>}
			</span>
			<CaretRightIcon size={16} className="shrink-0 text-base-content/65" />
		</>
	);
	return (
		<TaskAnchor t={task} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-base-content/[0.03]">
			{body}
		</TaskAnchor>
	);
}
