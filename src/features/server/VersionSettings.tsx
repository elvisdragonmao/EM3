import { CloudIcon, DeviceMobileIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { t } from "./messages";
import { type DataMode, ensureLinked, leaveServer, linkServer, useServer } from "./store";
import { SyncLine } from "./SyncLine";

/** Settings: which version this device uses, and the server connection's state. */
export function VersionSettings() {
	const { mode, status, account, error, setMode } = useServer();
	const [confirming, setConfirming] = useState(false);
	const [leaveError, setLeaveError] = useState<string | null>(null);
	const dialog = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const d = dialog.current;
		if (confirming && d && !d.open) d.showModal();
		if (!confirming && d?.open) d.close();
	}, [confirming]);

	function pick(m: DataMode) {
		if (m === mode) return;
		if (m === "local" && mode === "server") return setConfirming(true);
		setMode(m);
		if (m === "server") void linkServer();
	}

	async function leave() {
		setLeaveError(null);
		try {
			await leaveServer();
			setConfirming(false);
		} catch (err) {
			setLeaveError(t("leaveFailed", err instanceof Error ? err.message : String(err)));
		}
	}

	const options: [DataMode, string, string, React.ReactNode][] = [
		["server", t("serverName"), t("serverSummary"), <CloudIcon key="s" size={20} weight="duotone" />],
		["local", t("localName"), t("localSummary"), <DeviceMobileIcon key="l" size={20} weight="duotone" />]
	];

	return (
		<div className="space-y-3">
			<fieldset className="fieldset p-0">
				<legend className="sr-only">{t("section")}</legend>
				<div className="grid gap-2 sm:grid-cols-2">
					{options.map(([m, label, summary, icon]) => {
						const on = mode === m;
						return (
							<label
								key={m}
								className={`flex cursor-pointer items-start gap-3 rounded-box border p-3 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary ${on ? "border-primary bg-primary/[0.06]" : "hairline bg-base-100 hover:bg-base-content/[0.03]"}`}
							>
								<input type="radio" name="data-mode" className="radio radio-primary radio-sm mt-0.5" value={m} checked={on} onChange={() => pick(m)} />
								<span className="min-w-0 grow">
									<span className="flex flex-wrap items-center gap-1.5 font-medium">
										<span className={on ? "text-primary" : "text-base-content/65"}>{icon}</span>
										{label}
										{m === "server" && <span className="badge badge-xs badge-primary badge-soft">{t("recommended")}</span>}
										{on && <span className="badge badge-xs badge-primary">{t("current")}</span>}
									</span>
									<span className="mt-1 block text-xs text-base-content/65">{summary}</span>
								</span>
							</label>
						);
					})}
				</div>
			</fieldset>
			<div role="status" className="text-sm text-base-content/70">
				{mode === "server" && status === "linking" && t("statusLinking")}
				{mode === "server" && status === "linked" && (account?.tokenOk === false ? t("tokenExpired") : t("statusLinked"))}
				{mode === "server" && status === "error" && (
					<span className="flex flex-wrap items-center gap-2 text-error">
						{t("statusError", error ?? "")}
						<button type="button" className="btn btn-xs" onClick={() => void ensureLinked()}>
							{t("retry")}
						</button>
					</span>
				)}
			</div>
			{mode === "server" && status === "linked" && <SyncLine />}
			<p className="text-xs leading-relaxed text-base-content/65">{mode === "server" ? t("serverPrivacy") : t("localMissing")}</p>

			<dialog ref={dialog} className="modal" aria-labelledby="leave-title" aria-describedby="leave-body" onClose={() => setConfirming(false)}>
				<div className="modal-box">
					<h3 id="leave-title" className="text-lg font-semibold">
						{t("leaveTitle")}
					</h3>
					<p id="leave-body" className="mt-2 text-sm">
						{t("leaveBody")}
					</p>
					<p role="alert" className="mt-2 text-sm text-error">
						{leaveError}
					</p>
					<div className="modal-action">
						<button type="button" className="btn" onClick={() => setConfirming(false)}>
							{t("cancel")}
						</button>
						<button type="button" className="btn btn-error" onClick={() => void leave()}>
							{t("leaveConfirm")}
						</button>
					</div>
				</div>
			</dialog>
		</div>
	);
}
