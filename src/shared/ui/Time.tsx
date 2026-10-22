import { t } from "@/lib/time/messages";
import { deadlinePhrase, fullDateTime, pastPhrase } from "@/lib/time/relative";

/** 「昨天 星期三」 with the exact timestamp on hover. */
export function Ago({ ts, className }: { ts: number; className?: string }) {
	return (
		<time dateTime={new Date(ts * 1000).toISOString()} title={fullDateTime(ts)} className={className}>
			{pastPhrase(ts)}
		</time>
	);
}

export function Due({ ts, className }: { ts: number; className?: string }) {
	return (
		<time dateTime={new Date(ts * 1000).toISOString()} title={fullDateTime(ts) + t("taipeiTime")} className={className}>
			{deadlinePhrase(ts)}
		</time>
	);
}
