import { useSession } from "@/features/auth/session";
import { useServer } from "@/features/server/store";
import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { t } from "./messages";
import { ReleaseEntry } from "./ReleaseNotes";
import { unseenReleases } from "./releases";
import { markSeen, seenVersion } from "./seen";

/** Shows what changed, once per new version, the first time EM3 opens after an update. */
export function WhatsNewDialog() {
	const token = useSession(s => s.token);
	const mode = useServer(s => s.mode);
	const { pathname } = useLocation();
	const [releases, setReleases] = useState(() => unseenReleases(seenVersion()));
	// Waits until the version picker is answered, and never interrupts a timed quiz attempt.
	const open = !!token && mode !== null && releases.length > 0 && !pathname.endsWith("/attempt");
	const ref = useRef<HTMLDialogElement>(null);
	const gotIt = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		const d = ref.current;
		if (open && d && !d.open) {
			d.showModal();
			// Start on the button rather than the first link inside the notes.
			gotIt.current?.focus({ preventScroll: true });
		}
		if (!open && d?.open) d.close();
	}, [open]);

	function dismiss() {
		markSeen();
		setReleases([]);
	}

	return (
		<dialog ref={ref} className="modal modal-bottom sm:modal-middle" aria-labelledby="whats-new-title" aria-describedby="whats-new-intro" onClose={dismiss}>
			{open && (
				<div className="modal-box max-w-2xl">
					<h2 id="whats-new-title" className="text-xl font-semibold tracking-tight">
						{t("whatsNewTitle")}
					</h2>
					<p id="whats-new-intro" className="mt-1 text-sm text-base-content/65">
						{t("whatsNewIntro", releases.length)}
					</p>
					<div className="mt-5 space-y-8">
						{releases.map((r, i) => (
							<ReleaseEntry key={r.version} release={r} level={3} latest={i === 0} />
						))}
					</div>
					<div className="modal-action mt-6">
						<Link to="/update" className="btn btn-ghost" onClick={dismiss}>
							{t("seeAll")}
						</Link>
						<button type="button" className="btn btn-primary" onClick={dismiss} ref={gotIt}>
							{t("gotIt")}
						</button>
					</div>
				</div>
			)}
		</dialog>
	);
}
