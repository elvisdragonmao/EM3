import { tc } from "@/i18n/common";
import { fileUrl, humanSize } from "@/lib/moodle/files";
import { ArrowSquareOutIcon, DownloadSimpleIcon, XIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { create } from "zustand";
import { FileIcon } from "./FileIcon";
import type { MaterialFile } from "./materials";
import { t as tr } from "./messages";

interface PreviewState {
	file: MaterialFile | null;
	open: (f: MaterialFile) => void;
	close: () => void;
}

export const usePreview = create<PreviewState>(set => ({
	file: null,
	open: file => set({ file }),
	close: () => set({ file: null })
}));

const isTouch = () => window.matchMedia("(pointer: coarse)").matches;

/**
 * Opens a file the fastest sensible way: inline preview for PDFs, images and
 * media on desktop; the native viewer in a new tab on phones; download otherwise.
 */
export function openFile(f: MaterialFile) {
	const inline = ["pdf", "png", "jpg", "jpeg", "gif", "webp", "mp4", "webm", "mov", "m4v", "mp3", "m4a", "wav"].includes(f.ext);
	if (!inline) {
		window.location.href = fileUrl(f.url, { download: true });
		return;
	}
	if (isTouch()) {
		window.open(fileUrl(f.url), "_blank", "noopener");
		return;
	}
	usePreview.getState().open(f);
}

export function FilePreviewHost() {
	const { file, close } = usePreview();
	const closeBtn = useRef<HTMLButtonElement>(null);
	const panel = useRef<HTMLElement>(null);
	const id = useId();
	const open = !!file;
	useEffect(() => {
		if (!open) return;
		// Behave like a modal: the page behind becomes inert, focus moves in and returns on close.
		const previous = document.activeElement as HTMLElement | null;
		const app = document.getElementById("app");
		app?.setAttribute("inert", "");
		requestAnimationFrame(() => closeBtn.current?.focus());
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") close();
			// Keep Tab inside the panel instead of escaping to the browser chrome.
			if (e.key !== "Tab" || !panel.current) return;
			const items = [...panel.current.querySelectorAll<HTMLElement>("a[href], button, iframe, video, audio, [tabindex]:not([tabindex='-1'])")];
			if (!items.length) return;
			const first = items[0];
			const last = items[items.length - 1];
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => {
			window.removeEventListener("keydown", onKey);
			app?.removeAttribute("inert");
			previous?.focus({ preventScroll: true });
		};
	}, [open, close]);

	return (
		<AnimatePresence>
			{file && (
				<motion.div data-overlay className="fixed inset-0 z-50 flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
					<div aria-hidden className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />
					<motion.aside
						ref={panel}
						role="dialog"
						aria-modal="true"
						aria-labelledby={`${id}-name`}
						aria-describedby={`${id}-size`}
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={{ type: "spring", stiffness: 320, damping: 36 }}
						className="relative flex h-full w-full max-w-5xl flex-col bg-base-100 shadow-2xl"
					>
						<header className="flex items-center gap-3 border-b hairline px-4 py-3">
							<FileIcon ext={file.ext} />
							<div className="min-w-0 grow">
								<h2 id={`${id}-name`} className="truncate text-sm font-medium" title={file.name}>
									{file.name}
								</h2>
								<p id={`${id}-size`} className="text-xs text-base-content/65">
									{humanSize(file.size)}
								</p>
							</div>
							<a className="btn btn-ghost btn-sm" href={fileUrl(file.url)} target="_blank" rel="noreferrer">
								<ArrowSquareOutIcon size={16} />
								<span className="sr-only sm:not-sr-only">{tr("newTab")}</span>
								<span className="sr-only">{tc("openInNewTab")}</span>
							</a>
							<a className="btn btn-ghost btn-sm" href={fileUrl(file.url, { download: true })}>
								<DownloadSimpleIcon size={16} />
								<span className="sr-only sm:not-sr-only">{tc("download")}</span>
							</a>
							<button type="button" ref={closeBtn} className="btn btn-ghost btn-sm btn-square" onClick={close} aria-label={tr("closePreview")} title={tr("closePreview")}>
								<XIcon size={18} />
							</button>
						</header>
						<div className="min-h-0 grow bg-base-200">
							<PreviewBody file={file} />
						</div>
					</motion.aside>
				</motion.div>
			)}
		</AnimatePresence>
	);
}

function PreviewBody({ file }: { file: MaterialFile }) {
	const src = fileUrl(file.url);
	// No autoplay: media starts only when the user presses play (WCAG 1.4.2).
	if (["mp4", "webm", "mov", "m4v"].includes(file.ext)) return <video src={src} controls aria-label={file.name} className="size-full bg-black object-contain" />;
	if (["mp3", "m4a", "wav"].includes(file.ext))
		return (
			<div className="grid size-full place-items-center">
				<audio src={src} controls aria-label={file.name} />
			</div>
		);
	if (file.ext === "pdf") return <PdfFrame src={src} name={file.name} />;
	return (
		<div className="grid size-full place-items-center overflow-auto p-4">
			<img src={src} alt={file.name} className="max-h-full max-w-full rounded-lg object-contain" />
		</div>
	);
}

/**
 * E3 serves files with `Content-Security-Policy: default-src 'none'`, which some
 * browsers apply to their PDF viewer inside frames. Loading the bytes into a
 * blob URL sidesteps that and keeps the browser's own viewer.
 */
function PdfFrame({ src, name }: { src: string; name: string }) {
	const [blobUrl, setBlobUrl] = useState<string | null>(null);
	const [progress, setProgress] = useState(0);
	const [error, setError] = useState(false);

	useEffect(() => {
		let url: string | null = null;
		const ctrl = new AbortController();
		(async () => {
			const res = await fetch(src, { signal: ctrl.signal });
			const total = Number(res.headers.get("content-length")) || 0;
			const reader = res.body!.getReader();
			const chunks: BlobPart[] = [];
			let got = 0;
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				chunks.push(value);
				got += value.length;
				if (total) setProgress(got / total);
			}
			url = URL.createObjectURL(new Blob(chunks, { type: "application/pdf" }));
			setBlobUrl(url);
		})().catch(e => !ctrl.signal.aborted && (console.error(e), setError(true)));
		return () => {
			ctrl.abort();
			if (url) URL.revokeObjectURL(url);
		};
	}, [src]);

	if (error)
		return (
			<div className="grid size-full place-items-center p-6 text-center text-sm text-base-content/65">
				<p role="alert">
					{tr(
						"previewFailed",
						<a className="link" href={src} target="_blank" rel="noreferrer">
							{tr("openInNewTab")}
							<span className="sr-only">{tc("openInNewTab")}</span>
						</a>
					)}
				</p>
			</div>
		);
	if (!blobUrl)
		return (
			<div className="grid size-full place-items-center">
				<div className="w-56 text-center">
					<progress className="progress w-full" value={progress * 100 || undefined} max={100} aria-label={tr("loadingFile")} />
					<p className="mt-2 text-xs text-base-content/65">{tr("loadingPct", progress ? `${Math.round(progress * 100)}%` : "")}</p>
				</div>
			</div>
		);
	return <iframe title={tr("previewOf", name)} src={blobUrl} className="size-full" />;
}
