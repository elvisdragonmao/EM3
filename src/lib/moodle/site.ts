import { getLanguage } from "../../i18n";
import { t } from "./messages";

export { DEFAULT_MOODLE_URL, MOODLE_SITES, type MoodleSite } from "./sites";
import type { MoodleSite } from "./sites";

/** The school's name for the current UI: Chinese in the Chinese UI, otherwise its English name when it has one. */
export function siteName(site: MoodleSite): { name: string; lang: "zh-Hant-TW" | "en" } {
	return getLanguage() !== "zh-TW" && site.nameEn ? { name: site.nameEn, lang: "en" } : { name: site.name, lang: "zh-Hant-TW" };
}

/** Thrown when a Moodle URL typed by the user can't be used. */
export class MoodleUrlError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MoodleUrlError";
	}
}

/** Normalise a Moodle root URL before storing or using it for API requests. */
export function normalizeMoodleUrl(input: string): string {
	const value = input.trim();
	if (!value) throw new MoodleUrlError(t("urlRequired"));

	let url: URL;
	try {
		url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`);
	} catch {
		throw new MoodleUrlError(t("urlInvalid"));
	}

	if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new MoodleUrlError(t("urlInvalid"));
	const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
	if (url.protocol !== "https:" && !localHttp) throw new MoodleUrlError(t("urlHttps"));
	url.search = "";
	url.hash = "";
	url.pathname = url.pathname.replace(/\/(?:login\/(?:index|token)\.php|my(?:\/index\.php)?|index\.php)\/?$/i, "").replace(/\/+$/, "");
	return url.toString().replace(/\/$/, "");
}

/** Resolve a path inside a Moodle installation, including subdirectory installs. */
export function moodleUrl(baseUrl: string, path: string): string {
	return `${normalizeMoodleUrl(baseUrl)}/${path.replace(/^\/+/, "")}`;
}
