import { usePrefs } from "@/features/preferences/store";
import { getLocale, resolveLocale, setLocale } from "@/i18n";
import { IconContext } from "@phosphor-icons/react";
import { Fragment, type ReactNode, useEffect, useState } from "react";

// Icons are decorative by default; anything that needs a name gets it from
// its button or link's text or aria-label.
const ICONS = { "aria-hidden": true, focusable: false } as const;

/**
 * Applies the language preference and remounts the app when it changes, so
 * every `t()` call (in components, hooks and helpers alike) re-runs in the new
 * language. Query data stays cached outside this boundary.
 */
export function I18nRoot({ children }: { children: ReactNode }) {
	const pref = usePrefs(s => s.language);
	// Re-resolve "system" when the browser's language list changes.
	const [, bump] = useState(0);
	useEffect(() => {
		const onChange = () => bump(n => n + 1);
		window.addEventListener("languagechange", onChange);
		return () => window.removeEventListener("languagechange", onChange);
	}, []);
	const locale = resolveLocale(pref);
	if (locale !== getLocale()) setLocale(locale);
	return (
		<IconContext.Provider value={ICONS}>
			<Fragment key={locale}>{children}</Fragment>
		</IconContext.Provider>
	);
}
