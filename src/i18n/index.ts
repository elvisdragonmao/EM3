// A small, typed message layer. Each feature keeps its own dictionary next to
// its code (so lazy routes carry only their own strings) and calls the `t`
// returned by `defineMessages`. The active locale lives here as a module
// variable; <I18nRoot> remounts the app when it changes, so plain `t()` calls
// in render, hooks and helpers always see the current language.

export const LOCALES = ["zh-TW", "en", "ja", "emoji"] as const;
export type Locale = (typeof LOCALES)[number];
/** A spoken language, i.e. every locale except the emoji one. */
export type Language = Exclude<Locale, "emoji">;
export type LanguagePref = "system" | Locale;

/** BCP 47 tags for <html lang> and Intl. */
export const LANG_TAG: Record<Language, string> = { "zh-TW": "zh-Hant-TW", en: "en", ja: "ja" };

/** Each language's own name, shown in the language picker. */
export const LOCALE_NAME: Record<Locale, string> = { "zh-TW": "繁體中文", en: "English", ja: "日本語", emoji: "😀 Emoji" };

/** Maps the browser's preferred languages to the closest spoken language EM3 has. */
export function detectLanguage(preferred: readonly string[] = typeof navigator === "undefined" ? [] : navigator.languages?.length ? navigator.languages : [navigator.language]): Language {
	for (const tag of preferred) {
		const l = tag.toLowerCase();
		if (l.startsWith("zh")) return "zh-TW";
		if (l.startsWith("ja")) return "ja";
		if (l.startsWith("en")) return "en";
	}
	return "en";
}

export function resolveLocale(pref: LanguagePref | undefined): Locale {
	return pref && pref !== "system" && (LOCALES as readonly string[]).includes(pref) ? pref : detectLanguage();
}

/** Reads the saved preference straight from storage so the first render is already translated. */
function savedPref(): LanguagePref | undefined {
	try {
		return JSON.parse(localStorage.getItem("em3:prefs") ?? "{}")?.state?.language;
	} catch {
		return undefined;
	}
}

let current: Locale = resolveLocale(savedPref());

export const getLocale = () => current;

/** The spoken language behind the current locale; emoji mode falls back to the system language. */
export const getLanguage = (): Language => (current === "emoji" ? detectLanguage() : current);

/** BCP 47 tag for Intl and lang attributes. */
export const langTag = (locale: Locale = current) => LANG_TAG[locale === "emoji" ? detectLanguage() : locale];

export function setLocale(locale: Locale) {
	current = locale;
	if (typeof document !== "undefined") document.documentElement.lang = langTag(locale);
}

setLocale(current);

type Message = string | readonly string[] | ((...args: never[]) => unknown);
type Dict = Record<string, Message>;
type Args<M> = M extends (...a: infer A) => unknown ? A : [];
type Result<M> = M extends (...a: never[]) => infer R ? R : M;

/**
 * Declares one feature's strings. Traditional Chinese is the source; every
 * other locale must provide the same keys with the same shapes. Values are
 * plain strings, string lists, or functions for anything with parameters,
 * plurals or inline elements.
 */
export function defineMessages<T extends Dict>(dicts: { "zh-TW": T; en: NoInfer<T>; ja: NoInfer<T>; emoji: NoInfer<T> }) {
	return function t<K extends keyof T & string>(key: K, ...args: Args<T[K]>): Result<T[K]> {
		const m = dicts[current][key] ?? dicts["zh-TW"][key];
		return (typeof m === "function" ? (m as (...a: unknown[]) => unknown)(...args) : m) as Result<T[K]>;
	};
}

/** English plural helper: plural(3, "file") → "3 files". */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
