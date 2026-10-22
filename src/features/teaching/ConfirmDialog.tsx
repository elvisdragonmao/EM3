import { tc } from "@/i18n/common";
import { WarningIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

export type ConfirmResult = "ok" | "alt" | "cancel";

interface Ask {
	title: string;
	body: string;
	confirm: string;
	/** A third choice, e.g. "load the latest". */
	alt?: string;
	danger?: boolean;
}

/** `ask()` opens a modal and resolves with the choice; render `dialog` once. Esc and the backdrop cancel. */
export function useConfirm() {
	const [state, setState] = useState<(Ask & { resolve: (r: ConfirmResult) => void }) | null>(null);
	const ask = useCallback((opts: Ask) => new Promise<ConfirmResult>(resolve => setState({ ...opts, resolve })), []);
	const done = (r: ConfirmResult) => {
		state?.resolve(r);
		setState(null);
	};
	return [ask, <ConfirmDialog key="confirm" state={state} onDone={done} />] as const;
}

function ConfirmDialog({ state, onDone }: { state: Ask | null; onDone: (r: ConfirmResult) => void }) {
	const ref = useRef<HTMLDialogElement>(null);
	const id = useId();
	useEffect(() => {
		const d = ref.current;
		if (state && d && !d.open) d.showModal();
		if (!state && d?.open) d.close();
	}, [state]);
	return (
		<dialog ref={ref} className="modal modal-bottom sm:modal-middle" aria-labelledby={`${id}-title`} aria-describedby={`${id}-body`} onClose={() => state && onDone("cancel")}>
			<div className="modal-box max-w-md">
				<h2 id={`${id}-title`} className="mb-2 flex items-center gap-2 text-lg font-semibold">
					<WarningIcon size={20} weight="duotone" className="text-warning" />
					{state?.title}
				</h2>
				<p id={`${id}-body`} className="text-sm text-base-content/80">
					{state?.body}
				</p>
				<div className="modal-action flex-wrap">
					<button type="button" className="btn btn-ghost" autoFocus onClick={() => onDone("cancel")}>
						{tc("cancel")}
					</button>
					{state?.alt && (
						<button type="button" className="btn" onClick={() => onDone("alt")}>
							{state.alt}
						</button>
					)}
					<button type="button" className={`btn ${state?.danger ? "btn-error" : "btn-primary"}`} onClick={() => onDone("ok")}>
						{state?.confirm}
					</button>
				</div>
			</div>
			<form method="dialog" className="modal-backdrop">
				<button>{tc("close")}</button>
			</form>
		</dialog>
	);
}
