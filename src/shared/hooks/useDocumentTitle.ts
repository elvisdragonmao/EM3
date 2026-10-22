import { useEffect } from "react";

/** WCAG 2.4.2: every page names itself in <title>, e.g. 「待辦 · EM3」. */
export function useDocumentTitle(title: string | undefined | null) {
	useEffect(() => {
		if (!title) return;
		document.title = `${title} · EM3`;
		return () => {
			document.title = "EM3";
		};
	}, [title]);
}
