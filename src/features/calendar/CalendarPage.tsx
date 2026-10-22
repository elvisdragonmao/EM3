import { useTasks } from "@/features/assignments/tasks";
import { usePrefs } from "@/features/preferences/store";
import { ErrorNote, PageTitle } from "@/shared/ui/States";
import { CalendarBoard } from "./Board";
import { t } from "./messages";

export function CalendarPage() {
	const { tasks, error, refetch } = useTasks();
	const showWeekend = usePrefs(s => s.showWeekend);
	const set = usePrefs(s => s.set);
	return (
		<div>
			<PageTitle title={t("title")} subtitle={t("subtitle")}>
				<label className="flex cursor-pointer items-center gap-2 text-sm">
					<input type="checkbox" className="toggle toggle-sm" checked={showWeekend} onChange={e => set("showWeekend", e.target.checked)} />
					{t("showWeekend")}
				</label>
			</PageTitle>
			{error ? <ErrorNote error={error} retry={refetch} /> : <CalendarBoard tasks={tasks} compact spanKey="calendarPageSpan" />}
		</div>
	);
}
