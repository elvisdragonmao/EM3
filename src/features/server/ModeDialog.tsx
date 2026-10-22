import { useSession } from "@/features/auth/session";
import { CheckIcon, CloudIcon, DeviceMobileIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { t } from "./messages";
import { type DataMode, linkServer, useServer } from "./store";

/** Asks once, after the first sign-in on this device, which version to use. */
export function ModeDialog() {
	const token = useSession(s => s.token);
	const mode = useServer(s => s.mode);
	const setMode = useServer(s => s.setMode);
	// "Decide later" hides it until the next visit.
	const [later, setLater] = useState(false);
	const open = !!token && mode === null && !later;
	const ref = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const d = ref.current;
		if (open && d && !d.open) d.showModal();
		if (!open && d?.open) d.close();
	}, [open]);

	function choose(m: DataMode) {
		setMode(m);
		if (m === "server") void linkServer();
	}

	return (
		<dialog ref={ref} className="modal modal-bottom sm:modal-middle" aria-labelledby="mode-title" aria-describedby="mode-intro" onClose={() => setLater(true)}>
			<div className="modal-box max-w-3xl">
				<h2 id="mode-title" className="text-xl font-semibold tracking-tight">
					{t("dialogTitle")}
				</h2>
				<p id="mode-intro" className="mt-1 text-sm text-base-content/65">
					{t("dialogIntro")}
				</p>
				<div className="mt-5 grid gap-3 sm:grid-cols-2">
					<Option
						icon={<CloudIcon size={22} weight="duotone" />}
						name={t("serverName")}
						badge={t("recommended")}
						points={t("serverPoints")}
						note={t("serverPrivacy")}
						action={t("useServer")}
						primary
						onChoose={() => choose("server")}
					/>
					<Option
						icon={<DeviceMobileIcon size={22} weight="duotone" />}
						name={t("localName")}
						points={t("localPoints")}
						note={t("localMissing")}
						action={t("useLocal")}
						onChoose={() => choose("local")}
					/>
				</div>
				<div className="modal-action mt-4">
					<button type="button" className="btn btn-ghost btn-sm" onClick={() => setLater(true)}>
						{t("later")}
					</button>
				</div>
			</div>
		</dialog>
	);
}

function Option({
	icon,
	name,
	badge,
	points,
	note,
	action,
	primary = false,
	onChoose
}: {
	icon: React.ReactNode;
	name: string;
	badge?: string;
	points: readonly string[];
	note?: string;
	action: string;
	primary?: boolean;
	onChoose: () => void;
}) {
	const id = `mode-${primary ? "server" : "local"}`;
	return (
		<section aria-labelledby={id} className={`flex flex-col rounded-box border p-4 ${primary ? "border-primary bg-primary/[0.04]" : "hairline"}`}>
			<h3 id={id} className="flex items-center gap-2 font-semibold">
				<span className={primary ? "text-primary" : "text-base-content/65"}>{icon}</span>
				{name}
				{badge && <span className="badge badge-sm badge-primary">{badge}</span>}
			</h3>
			<ul className="mt-3 grow space-y-1.5 text-sm">
				{points.map(p => (
					<li key={p} className="flex gap-2">
						<CheckIcon size={16} weight="bold" className={`mt-0.5 shrink-0 ${primary ? "text-primary" : "text-base-content/65"}`} />
						{p}
					</li>
				))}
			</ul>
			{note && <p className="mt-3 text-xs leading-relaxed text-base-content/65">{note}</p>}
			<button type="button" className={`btn mt-4 w-full ${primary ? "btn-primary" : ""}`} onClick={onChoose}>
				{action}
			</button>
		</section>
	);
}
