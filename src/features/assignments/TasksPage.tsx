import { TaskGroups } from "@/features/course/CourseTasks";
import { Empty, ErrorNote, Lines, PageTitle } from "@/shared/ui/States";
import { ConfettiIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { t } from "./messages";
import { isOpenTask, useTasks } from "./tasks";

export function TasksPage() {
	const { tasks, isPending, error, refetch } = useTasks();
	const [showDone, setShowDone] = useState(false);
	const open = tasks.filter(isOpenTask);
	const list = showDone ? tasks : tasks.filter(x => x.state !== "submitted" && x.state !== "graded" && x.state !== "closed");

	return (
		<div>
			<PageTitle title={t("tasksTitle")} subtitle={isPending ? t("tasksSorting") : open.length ? t("tasksLeft", open.length) : t("tasksNone")}>
				<label className="flex cursor-pointer items-center gap-2 text-sm">
					<input type="checkbox" className="toggle toggle-sm" checked={showDone} onChange={e => setShowDone(e.target.checked)} />
					{t("showDone")}
				</label>
			</PageTitle>
			{error ? (
				<ErrorNote error={error} retry={refetch} />
			) : isPending ? (
				<Lines n={6} />
			) : list.length ? (
				<TaskGroups tasks={list} showCourse />
			) : (
				<Empty icon={<ConfettiIcon size={44} weight="duotone" />} title={t("allDone")}>
					{t("allDoneHint")}
				</Empty>
			)}
		</div>
	);
}
