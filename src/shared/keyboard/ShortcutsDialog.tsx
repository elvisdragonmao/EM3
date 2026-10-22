import { tc } from "@/i18n/common";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { shortcutGroups } from "./catalog";
import { MOD_LABEL } from "./hotkeys";
import { t } from "./messages";

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
				<header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b hairline px-6 py-4">
					<h2 id="shortcuts-title" className="text-lg font-semibold">
						{t("title")}
					</h2>
					<p className="text-sm text-base-content/65">
						{t(
							"openAnytime",
							<kbd>
								<kbd className="kbd kbd-sm">{MOD_LABEL}</kbd> <kbd className="kbd kbd-sm">/</kbd>
							</kbd>
						)}
					</p>
				</header>
				<div className="grid max-h-[70vh] grid-cols-1 gap-x-10 gap-y-6 overflow-y-auto px-6 py-5 sm:grid-cols-2">
					{shortcutGroups().map((g, gi) => (
						<section key={g.title} aria-labelledby={`shortcuts-group-${gi}`}>
							<h3 id={`shortcuts-group-${gi}`} className="mb-2 text-xs font-semibold tracking-wide text-base-content/65">
								{g.title}
							</h3>
							<ul className="space-y-1.5">
								{g.items.map(item => (
									<li key={item.label} className="flex items-center justify-between gap-4 text-sm">
										<span className="text-base-content/80">{item.label}</span>
										<span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
											{item.keys.map((combo, i) => (
												<span key={i} className="flex items-center gap-0.5">
													{i > 0 && (
														<span className="mx-0.5 text-xs text-base-content/65">
															<span aria-hidden>/</span>
															<span className="sr-only">{t("or")}</span>
														</span>
													)}
													<kbd className="flex items-center gap-0.5">
														{combo.map(k => (
															<kbd key={k} className="kbd kbd-sm min-w-6">
																{k === "mod" ? MOD_LABEL : k}
															</kbd>
														))}
													</kbd>
												</span>
											))}
										</span>
									</li>
								))}
							</ul>
						</section>
					))}
				</div>
				<footer className="space-y-1 border-t hairline px-6 py-3 text-xs text-base-content/65">
					<p>{t("footer")}</p>
					<p>
						{t(
							"singleKeyOff",
							<Link to="/settings" hash="settings-personal" className="link" onClick={onClose}>
								{t("settings")}
							</Link>
						)}
					</p>
				</footer>
			</div>
			<form method="dialog" className="modal-backdrop">
				<button>{tc("close")}</button>
			</form>
		</dialog>
	);
}
