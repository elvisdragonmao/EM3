import { getLanguage, type Language } from "@/i18n";
import { tc } from "@/i18n/common";

// Notes are loaded and rendered on demand, so neither they nor marked land in
// the app shell's bundle.

const files = import.meta.glob<string>("./notes/*.md", { query: "?raw", import: "default" });
const cache = new Map<string, Promise<string>>();

const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

async function render(version: string, lang: Language, headingOffset: number): Promise<string> {
	const load = files[`./notes/${version}.${lang}.md`] ?? files[`./notes/${version}.zh-TW.md`];
	if (!load) throw new Error(`No notes for ${version}`);
	const [{ Marked }, markdown] = await Promise.all([import("marked"), load()]);
	const marked = new Marked({
		gfm: true,
		// The notes use ## and ### as on GitHub; shift them under the page's own headings.
		walkTokens: token => {
			if (token.type === "heading") token.depth = Math.min(6, token.depth + headingOffset);
		},
		renderer: {
			link({ href, tokens }) {
				return `<a href="${escapeAttr(href)}" target="_blank" rel="noreferrer">${this.parser.parseInline(tokens)}<span class="sr-only">${tc("openInNewTab")}</span></a>`;
			}
		}
	});
	return marked.parse(markdown, { async: false });
}

/**
 * One release's notes as HTML in the current language. `headingOffset` turns the
 * notes' ## into an h(2 + offset). Emoji mode falls back to the system language.
 */
export function releaseNotesHtml(version: string, headingOffset: number): Promise<string> {
	const lang = getLanguage();
	const key = `${version}:${lang}:${headingOffset}`;
	let p = cache.get(key);
	if (!p) {
		p = render(version, lang, headingOffset);
		p.catch(() => cache.delete(key));
		cache.set(key, p);
	}
	return p;
}
