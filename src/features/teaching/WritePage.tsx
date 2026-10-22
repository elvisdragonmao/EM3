import { useCourseIndex } from "@/features/courses/api";
import { tc } from "@/i18n/common";
import { cleanHtml, e3Link } from "@/lib/moodle/files";
import { MarkdownEditor, markdownToHtml } from "@/shared/editor/MarkdownEditor";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { CourseTag } from "@/shared/ui/CourseTag";
import { ArrowLeftIcon, ArrowSquareOutIcon, CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useParams, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { t as m } from "./messages";

// E3 has no API to create or edit pages, labels or activity descriptions.
// So EM3 is the writing desk: write in Markdown (or with buttons), copy it as
// rich text, and paste it into the E3 form that opens next to it.

const TARGETS = [
	{ key: "page", label: "targetPage", hint: "targetPageHint", path: (c: string) => `/course/modedit.php?add=page&course=${c}&section=0&return=0` },
	{ key: "label", label: "targetLabel", hint: "targetLabelHint", path: (c: string) => `/course/modedit.php?add=label&course=${c}&section=0&return=0` },
	{ key: "assign", label: "targetAssign", hint: "targetAssignHint", path: (c: string) => `/course/modedit.php?add=assign&course=${c}&section=0&return=0` },
	{ key: "resource", label: "targetResource", hint: "targetResourceHint", path: (c: string) => `/course/modedit.php?add=resource&course=${c}&section=0&return=0` }
] as const;

const KEY = (id: string) => `em3:write-draft:${id}`;

export function WritePage() {
	const { courseId } = useParams({ from: "/app/courses/$courseId/write" });
	const router = useRouter();
	const course = useCourseIndex().byId.get(Number(courseId));
	const [md, setMd] = useState(() => {
		try {
			return localStorage.getItem(KEY(courseId)) ?? "";
		} catch {
			return "";
		}
	});
	const [copied, setCopied] = useState(false);
	const [copyError, setCopyError] = useState<string | null>(null);
	useDocumentTitle(course ? `${m("write")} · ${course.name}` : m("write"));
	useEffect(() => {
		try {
			localStorage.setItem(KEY(courseId), md);
		} catch {
			/* ignore */
		}
		setCopied(false);
		setCopyError(null);
	}, [courseId, md]);

	const html = markdownToHtml(md);

	async function copy() {
		// Rich text for E3's TinyMCE editor, plain HTML as a fallback for its source view.
		try {
			await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([html], { type: "text/plain" }) })]);
			setCopyError(null);
			setCopied(true);
		} catch (e) {
			setCopyError(e instanceof Error ? e.message : String(e));
		}
	}

	return (
		<div className="mx-auto max-w-6xl">
			<button onClick={() => router.history.back()} className="btn btn-ghost btn-sm mb-4 -ml-2">
				<ArrowLeftIcon size={16} />
				{m("back")}
			</button>
			<header className="mb-6">
				{course && <CourseTag course={course} link />}
				<h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{m("write")}</h1>
				<p className="mt-1 max-w-2xl text-sm text-base-content/65">{m("writeIntro")}</p>
			</header>
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
				<MarkdownEditor value={md} onChange={setMd} placeholder={m("writePlaceholder")} minHeight="24rem" label={m("writeLabel")} autoFocus />
				<aside className="card-quiet space-y-4 self-start p-4 lg:sticky lg:top-6">
					<button className="btn btn-primary w-full" disabled={!md.trim()} onClick={() => void copy()}>
						{copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
						{copied ? m("copied") : m("copyForE3")}
					</button>
					<p className="sr-only" role="status">
						{copied ? m("copied") : ""}
					</p>
					<div role="alert">{copyError && <p className="text-sm text-error">{m("copyFailed", copyError)}</p>}</div>
					<div>
						<h2 className="mb-2 text-xs font-semibold text-base-content/65">{m("pasteWhere")}</h2>
						<ul className="space-y-1">
							{TARGETS.map(t => (
								<li key={t.key}>
									<a href={e3Link(t.path(courseId))} target="_blank" rel="noreferrer" className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-base-content/[0.04]">
										<ArrowSquareOutIcon size={15} className="mt-0.5 shrink-0 text-base-content/65" />
										<span>
											{m(t.label)}
											<span className="sr-only">{tc("openInNewTab")}</span>
											<span className="block text-xs text-base-content/65">{m(t.hint)}</span>
										</span>
									</a>
								</li>
							))}
						</ul>
					</div>
					<details className="text-sm">
						<summary className="cursor-pointer text-base-content/65">{m("previewOnE3")}</summary>
						<div className="prose-e3 mt-2 max-h-80 overflow-auto rounded-lg bg-base-200 p-3" dangerouslySetInnerHTML={{ __html: cleanHtml(html) }} />
					</details>
				</aside>
			</div>
		</div>
	);
}
