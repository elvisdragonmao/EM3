import { useEffect, useRef } from "react";
import { shortcutGroups } from "./catalog";
import { MOD_LABEL } from "./hotkeys";

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
	const ref = useRef<HTMLDialogElement>(null);
	useEffect(() => {
		const d = ref.current;
		if (open && d && !d.open) d.showModal();
		if (!open && d?.open) d.close();
	}, [open]);

	return (
		<dialog ref={ref} className="modal modal-bottom sm:modal-middle" onClose={onClose} aria-labelledby="shortcuts-title">
			<div className="modal-box max-w-3xl p-0">
				<header className="flex items-center justify-between border-b hairline px-6 py-4">
					<h2 id="shortcuts-title" className="text-lg font-semibold">
						鍵盤快捷鍵
					</h2>
					<span className="text-sm text-base-content/50">
						<kbd className="kbd kbd-sm">{MOD_LABEL}</kbd> <kbd className="kbd kbd-sm">/</kbd> 隨時打開
					</span>
				</header>
				<div className="grid max-h-[70vh] grid-cols-1 gap-x-10 gap-y-6 overflow-y-auto px-6 py-5 sm:grid-cols-2">
					{shortcutGroups().map(g => (
						<section key={g.title}>
							<h3 className="mb-2 text-xs font-semibold tracking-wide text-base-content/45">{g.title}</h3>
							<ul className="space-y-1.5">
								{g.items.map(item => (
									<li key={item.label} className="flex items-center justify-between gap-4 text-sm">
										<span className="text-base-content/80">{item.label}</span>
										<span className="flex shrink-0 items-center gap-1">
											{item.keys.map((combo, i) => (
												<span key={i} className="flex items-center gap-0.5">
													{i > 0 && <span className="mx-0.5 text-xs text-base-content/35">/</span>}
													{combo.map(k => (
														<kbd key={k} className="kbd kbd-sm min-w-6">
															{k === "mod" ? MOD_LABEL : k}
														</kbd>
													))}
												</span>
											))}
										</span>
									</li>
								))}
							</ul>
						</section>
					))}
				</div>
				<footer className="border-t hairline px-6 py-3 text-xs text-base-content/50">輸入框裡打字時，單鍵快捷鍵不會觸發；按 Esc 離開輸入框即可使用。</footer>
			</div>
			<form method="dialog" className="modal-backdrop">
				<button>close</button>
			</form>
		</dialog>
	);
}
