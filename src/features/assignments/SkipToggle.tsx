import { type SkipKind, usePrefs } from "@/features/preferences/store";
import { ArrowCounterClockwiseIcon, MinusCircleIcon } from "@phosphor-icons/react";
import { useId } from "react";
import { t } from "./messages";

/** Whether this assignment is marked as not needing a submission ("submit") or grading ("grading"). */
export const useSkipped = (kind: SkipKind, cmid: number) => usePrefs(s => !!(kind === "submit" ? s.skipSubmit : s.skipGrading)[cmid]);

const TEXT = {
	submit: { mark: "skipSubmit", unmark: "unskipSubmit", marked: "skippedSubmit", hint: "skipSubmitHint" },
	grading: { mark: "skipGrading", unmark: "unskipGrading", marked: "skippedGrading", hint: null }
} as const;

/**
 * Marks an assignment as not needing a submission or grading. The mark lives in the
 * synced settings: localStorage on the local version, also the server on the server
 * version, where the reminders skip it.
 */
export function SkipToggle({ kind, cmid, compact = false }: { kind: SkipKind; cmid: number; compact?: boolean }) {
	const on = useSkipped(kind, cmid);
	const setSkip = usePrefs(s => s.setSkip);
	const noteId = useId();
	const text = TEXT[kind];
	const note = on ? t(text.marked) : text.hint && t(text.hint);
	return (
		<div className={compact ? "contents" : "space-y-1.5"}>
			<button
				type="button"
				className={`btn btn-sm ${compact ? "" : "w-full"} ${on ? "btn-soft" : "btn-ghost border-base-content/15"}`}
				aria-describedby={note ? noteId : undefined}
				onClick={() => setSkip(kind, cmid, !on)}
			>
				{on ? <ArrowCounterClockwiseIcon size={15} /> : <MinusCircleIcon size={15} />}
				{on ? t(text.unmark) : t(text.mark)}
			</button>
			{/* Always mounted, so marking and unmarking are announced. */}
			<p id={noteId} role="status" className={compact ? "sr-only" : "text-xs text-base-content/65"}>
				{note}
			</p>
		</div>
	);
}
