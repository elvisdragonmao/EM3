import { getLanguage } from "../../i18n";
import { t } from "./messages";

export const DEFAULT_MOODLE_URL = "https://e3p.nycu.edu.tw";

export interface MoodleSite {
	/** The school's official Chinese name. */
	name: string;
	/** The school's official English name, shown outside the Chinese UI. */
	nameEn?: string;
	baseUrl: string;
	/** Browser SSO through an OAuth2 provider (see sso.ts); the texts tell users where to copy the link from. */
	sso?: {
		provider: number;
		/** What the school calls its Moodle, for "在 ___ 的完成頁面". */
		pageName?: string;
		/** The launch link's text on Moodle's finish page; it comes from the site's language pack. */
		linkText?: string;
	};
	/** Suffix of the site's `local_<suffix>_*` mail web service (a local_mail install); absent when it has none. */
	mailPlugin?: string;
	/** `false` when the school only allows SSO, so the password form is hidden. */
	password?: false;
}

/** Sites whose Moodle mobile endpoints and browser CORS work; the login methods each accepts are per entry. */
export const MOODLE_SITES: readonly MoodleSite[] = [
	{ name: "國立陽明交通大學", nameEn: "National Yang Ming Chiao Tung University", baseUrl: DEFAULT_MOODLE_URL, mailPlugin: "dcpcmail" },
	{ name: "國立中正大學", nameEn: "National Chung Cheng University", baseUrl: "https://ecourse2.ccu.edu.tw", sso: { provider: 1, pageName: "eCourse2" }, password: false, mailPlugin: "mail" },
	{ name: "國立臺灣師範大學", nameEn: "National Taiwan Normal University", baseUrl: "https://moodle3.ntnu.edu.tw" },
	{ name: "國立政治大學", nameEn: "National Chengchi University", baseUrl: "https://moodle45.nccu.edu.tw" },
	{ name: "國立成功大學", nameEn: "National Cheng Kung University", baseUrl: "https://moodle.ncku.edu.tw" },
	{ name: "銘傳大學", nameEn: "Ming Chuan University", baseUrl: "https://moodle.mcu.edu.tw" },
	{ name: "國立暨南國際大學", nameEn: "National Chi Nan University", baseUrl: "https://moodle.ncnu.edu.tw" },
	{ name: "國立高雄大學", nameEn: "National University of Kaohsiung", baseUrl: "https://elearningv4.nuk.edu.tw" },
	{ name: "國立臺南大學", nameEn: "National University of Tainan", baseUrl: "https://moodle.nutn.edu.tw/moodle" }
];

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
