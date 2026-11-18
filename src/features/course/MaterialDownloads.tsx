import { useSession } from "@/features/auth/session";
import { tc } from "@/i18n/common";
import { humanSize } from "@/lib/moodle/files";
import { create } from "zustand";
import type { ZipProgress } from "./materials";
import { t } from "./messages";

type DownloadJob = {
	name: string;
	size: number;
	count: number;
	controller: AbortController;
	progress: ZipProgress;
};

type DownloadResult = { failed: string[]; error?: string };

export const useMaterialDownloads = create<{ job: DownloadJob | null; result: DownloadResult | null }>(() => ({ job: null, result: null }));

useSession.subscribe((current, previous) => {
	if (current.token === previous.token && current.baseUrl === previous.baseUrl) return;
	useMaterialDownloads.getState().job?.controller.abort();
	useMaterialDownloads.setState({ result: null });
});

/** The app shell keeps progress and cancellation available after leaving the course. */
export function MaterialDownloads() {
	const job = useMaterialDownloads(s => s.job);
	const result = useMaterialDownloads(s => s.result);
	const error = result?.error ? t("zipFailed", result.error) : result?.failed.length ? t("someFailed", result.failed) : "";
	return (
		<div className="fixed right-4 bottom-24 left-4 z-30 ml-auto max-w-sm lg:bottom-4 lg:left-auto">
			<div role="status" className="sr-only">
				{job ? t("packing") : ""}
			</div>
			<div role="alert" className="sr-only">
				{error}
			</div>
			{job && (
				<section aria-label={t("bulkDownload")} className="surface rounded-2xl p-3 shadow-lg">
					<p className="truncate text-sm font-medium" title={job.name}>
						{job.name}
					</p>
					<div className="flex items-center justify-between gap-4">
						<div className="min-w-0 grow">
							<p className="text-xs text-base-content/65">
								{t("packing")} · {job.progress.files} / {job.count} · {humanSize(job.progress.bytes)}
							</p>
							<progress className="progress progress-primary w-full" value={job.size ? job.progress.bytes : job.progress.files} max={job.size || job.count} aria-label={t("packingProgress")} />
						</div>
						<button type="button" className="btn btn-ghost btn-sm" onClick={() => job.controller.abort()}>
							{tc("cancel")}
						</button>
					</div>
				</section>
			)}
			{error && (
				<div className="surface flex items-center gap-3 rounded-2xl p-3 shadow-lg">
					<p aria-hidden className="min-w-0 grow text-sm break-words text-error">
						{error}
					</p>
					<button type="button" className="btn btn-ghost btn-sm" onClick={() => useMaterialDownloads.setState({ result: null })}>
						{tc("close")}
					</button>
				</div>
			)}
		</div>
	);
}
