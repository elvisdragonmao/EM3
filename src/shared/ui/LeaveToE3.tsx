import { tc } from "@/i18n/common";
import { ArrowSquareOutIcon } from "@phosphor-icons/react";
import { type MouseEvent, type ReactNode, useEffect, useId, useRef } from "react";
import { create } from "zustand";
import { t } from "./messages";

// Some things only work on the official E3 site (quizzes, for one). Rows for
// them look like every other row, so instead of silently opening a new tab EM3
// says where the link goes and why first.

export interface LeaveNotice {
	url: string;
	title: string;
	reason: string;
	notes?: string[];
}

const useLeave = create<{ notice: LeaveNotice | null; show: (n: LeaveNotice) => void; close: () => void }>(set => ({
	notice: null,
	show: notice => set({ notice }),
	close: () => set({ notice: null })
}));

/** A link to E3 that explains itself before leaving. Modifier clicks still open straight away. */
export function E3Away({ notice, className, children }: { notice: LeaveNotice; className?: string; children: ReactNode }) {
	const onClick = (e: MouseEvent) => {
		if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
		e.preventDefault();
		useLeave.getState().show(notice);
	};
	return (
		<a href={notice.url} target="_blank" rel="noreferrer" className={className} onClick={onClick} data-nav>
			{children}
			<span className="sr-only">{tc("openInNewTab")}</span>
		</a>
	);
}

export function LeaveToE3Host() {
	const { notice, close } = useLeave();
	const ref = useRef<HTMLDialogElement>(null);
	const opener = useRef<HTMLElement | null>(null);
	const id = useId();
	useEffect(() => {
		const d = ref.current;
		if (notice && d && !d.open) {
			opener.current = document.activeElement as HTMLElement | null;
			d.showModal();
		}
		if (!notice && d?.open) d.close();
	}, [notice]);

	// Return focus to the link that opened the notice (WCAG 2.4.3).
	const onClose = () => {
		close();
		opener.current?.focus?.();
		opener.current = null;
	};

	return (
		<dialog ref={ref} className="modal modal-bottom sm:modal-middle" onClose={onClose} aria-labelledby={`${id}-title`} aria-describedby={`${id}-desc`}>
			<div className="modal-box max-w-md">
				{notice && (
					<>
						<p className="flex items-center gap-1.5 text-xs font-medium text-base-content/65">
							<ArrowSquareOutIcon size={14} />
							{t("leaveKicker")}
						</p>
						<h2 id={`${id}-title`} className="mt-1 text-lg font-semibold">
							{notice.title}
						</h2>
						<p id={`${id}-desc`} className="mt-3 text-sm text-base-content/75">
							{notice.reason}
						</p>
						{!!notice.notes?.length && (
							<ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-base-content/65">
								{notice.notes.map(n => (
									<li key={n}>{n}</li>
								))}
							</ul>
						)}
						<div className="modal-action">
							<button type="button" className="btn btn-ghost" onClick={() => ref.current?.close()}>
								{tc("cancel")}
							</button>
							<a className="btn btn-primary" href={notice.url} target="_blank" rel="noreferrer" onClick={() => ref.current?.close()} autoFocus>
								{t("leaveGo")}
								<ArrowSquareOutIcon size={16} />
								<span className="sr-only">{tc("openInNewTab")}</span>
							</a>
						</div>
					</>
				)}
			</div>
			<form method="dialog" className="modal-backdrop">
				<button>{tc("close")}</button>
			</form>
		</dialog>
	);
}
