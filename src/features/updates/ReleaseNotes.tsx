import { langTag } from "@/i18n";
import { Lines } from "@/shared/ui/States";
import { useEffect, useState } from "react";
import { t } from "./messages";
import { releaseNotesHtml } from "./notes";
import type { Release } from "./releases";

/** "2026-10-24" in the reader's language, read as a calendar day rather than UTC midnight. */
export function releaseDate(date: string) {
	const [y, m, d] = date.split("-").map(Number);
	return new Intl.DateTimeFormat(langTag(), { dateStyle: "long" }).format(new Date(y, m - 1, d));
}

/** A release's version, date and notes. `level` is the heading level of the version line. */
export function ReleaseEntry({ release, level, latest = false }: { release: Release; level: 2 | 3; latest?: boolean }) {
	const id = `release-${release.version.replaceAll(".", "-")}`;
	const Heading = `h${level}` as const;
	return (
		<article aria-labelledby={id}>
			<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<Heading id={id} className={`font-bold tracking-tight tabular-nums ${level === 2 ? "text-2xl" : "text-lg"}`}>
					v{release.version}
				</Heading>
				{latest && <span className="badge badge-sm badge-primary">{t("latest")}</span>}
				<time dateTime={release.date} className="text-sm text-base-content/65">
					{t("released", releaseDate(release.date))}
				</time>
			</div>
			{/* The notes' ## sits one level below the version line. */}
			<ReleaseNotes version={release.version} headingOffset={level - 1} />
		</article>
	);
}

function ReleaseNotes({ version, headingOffset }: { version: string; headingOffset: number }) {
	const [state, setState] = useState<{ html?: string; failed?: boolean }>({});

	useEffect(() => {
		let live = true;
		releaseNotesHtml(version, headingOffset).then(
			html => live && setState({ html }),
			() => live && setState({ failed: true })
		);
		return () => {
			live = false;
		};
	}, [version, headingOffset]);

	return (
		<>
			<p role="alert" className="text-sm text-error empty:hidden">
				{state.failed ? t("loadFailed") : ""}
			</p>
			{state.html ? (
				<div
					className="prose-e3 mt-3 [&_h3]:mt-6 [&_h3]:text-lg [&_h4]:mt-4 [&_h4]:text-base-content/80 [&_h5]:mt-4 [&_h5]:text-base-content/80 [&_li]:my-1.5 [&_strong]:font-semibold"
					dangerouslySetInnerHTML={{ __html: state.html }}
				/>
			) : (
				!state.failed && <Lines n={2} className="mt-4" />
			)}
		</>
	);
}
