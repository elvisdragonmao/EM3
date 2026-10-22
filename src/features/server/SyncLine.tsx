import { hhmm, md, sameDay } from "@/lib/time/relative";
import { t } from "./messages";
import { syncNow, useSyncStatus } from "./sync";

const when = (at: number) => {
	const d = new Date(at);
	return sameDay(d, new Date()) ? hhmm(d) : `${md(d)} ${hhmm(d)}`;
};

/** Settings: when this device's settings last synced. Background syncs aren't announced, so this isn't a live region. */
export function SyncLine() {
	const { state, at } = useSyncStatus();
	if (state === "error")
		return (
			<p className="flex flex-wrap items-center gap-2 text-sm text-error">
				{t("syncFailed")}
				<button type="button" className="btn btn-xs" onClick={() => void syncNow()}>
					{t("retry")}
				</button>
			</p>
		);
	if (at === null && state === "idle") return null;
	return <p className="text-sm text-base-content/70">{at === null ? t("syncing") : t("synced", when(at))}</p>;
}
