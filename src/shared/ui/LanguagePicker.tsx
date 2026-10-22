import { usePrefs } from "@/features/preferences/store";
import { LANG_TAG, type LanguagePref, LOCALE_NAME, LOCALES } from "@/i18n";
import { GlobeIcon } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import { t } from "./messages";

// Switching language remounts the app; remember which picker had focus so it gets it back (WCAG 2.4.3).
let refocus: "select" | "radios" | null = null;

function useRefocus<T extends HTMLElement>(kind: "select" | "radios") {
	const ref = useRef<T>(null);
	useEffect(() => {
		if (refocus !== kind) return;
		refocus = null;
		(ref.current?.querySelector<HTMLElement>("select, input:checked") ?? ref.current)?.focus();
	}, [kind]);
	return ref;
}

const OPTIONS: LanguagePref[] = ["system", ...LOCALES];

/** Each language's name is written in that language and tagged with it (WCAG 3.1.2). */
const optionLang = (l: LanguagePref) => (l === "system" || l === "emoji" ? undefined : LANG_TAG[l]);

/** Compact picker for pages outside the app shell (landing, sign-in). */
export function LanguageSelect({ className = "" }: { className?: string }) {
	const language = usePrefs(s => s.language);
	const set = usePrefs(s => s.set);
	const ref = useRefocus<HTMLLabelElement>("select");
	return (
		<label ref={ref} className={`select select-sm select-ghost w-auto ${className}`}>
			<GlobeIcon size={16} />
			<span className="sr-only">{t("language")}</span>
			<select
				value={language}
				onChange={e => {
					refocus = "select";
					set("language", e.target.value as LanguagePref);
				}}
			>
				{OPTIONS.map(l => (
					<option key={l} value={l} lang={optionLang(l)}>
						{l === "system" ? t("system") : LOCALE_NAME[l]}
					</option>
				))}
			</select>
		</label>
	);
}

/** Radio list for the settings page. */
export function LanguageRadios() {
	const language = usePrefs(s => s.language);
	const set = usePrefs(s => s.set);
	const ref = useRefocus<HTMLFieldSetElement>("radios");
	return (
		<fieldset ref={ref} className="fieldset">
			<legend className="fieldset-legend">
				<GlobeIcon size={16} />
				{t("language")}
			</legend>
			<div className="flex flex-wrap gap-2">
				{OPTIONS.map(l => (
					<label key={l} className={`btn btn-sm has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary ${language === l ? "btn-active" : ""}`}>
						<input
							type="radio"
							name="language"
							className="sr-only"
							value={l}
							checked={language === l}
							onChange={() => {
								refocus = "radios";
								set("language", l);
							}}
						/>
						<span lang={optionLang(l)}>{l === "system" ? t("system") : LOCALE_NAME[l]}</span>
					</label>
				))}
			</div>
		</fieldset>
	);
}
