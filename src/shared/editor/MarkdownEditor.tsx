import { tc } from "@/i18n/common";
import { Crepe } from "@milkdown/crepe";
import { editorViewOptionsCtx } from "@milkdown/kit/core";
import { CodeIcon, TextAaIcon } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState } from "react";
import "./editor.css";
import { t } from "./messages";

// One editor for everyone: Milkdown Crepe with an always-visible button bar
// for people who don't write Markdown, and a raw Markdown tab for those who do.

export { markdownToHtml } from "./markdown";

type Mode = "rich" | "markdown";
const MODE_KEY = "em3:editor-mode";

interface Props {
	value: string;
	onChange: (markdown: string) => void;
	placeholder?: string;
	minHeight?: string;
	/** Autofocus the editor when it mounts. */
	autoFocus?: boolean;
	/** Accessible name of the editable area (and its toolbars). */
	label?: string;
	/** Id of a visible label element; takes precedence over `label` for the editable area. */
	labelledBy?: string;
	/** Bump to push an outside change of `value` into the rich editor (it only reads `value` on mount). */
	version?: number;
}

export function MarkdownEditor({ value, onChange, placeholder = t("placeholder"), minHeight = "10rem", autoFocus = false, label = t("label"), labelledBy, version = 0 }: Props) {
	const hintId = useId();
	const [mode, setMode] = useState<Mode>(() => {
		try {
			return (localStorage.getItem(MODE_KEY) as Mode) || "rich";
		} catch {
			return "rich";
		}
	});
	const switchMode = (m: Mode) => {
		setMode(m);
		try {
			localStorage.setItem(MODE_KEY, m);
		} catch {
			/* ignore */
		}
	};
	const name: Record<string, string> = labelledBy ? { "aria-labelledby": labelledBy } : { "aria-label": label };

	return (
		<div className="em3-editor @container overflow-hidden rounded-box border hairline bg-base-100 transition-[border-color,box-shadow]" style={{ ["--em3-editor-min" as string]: minHeight }}>
			<div className="flex items-center gap-1 border-b hairline px-2 py-1.5" role="group" aria-label={t("modeGroup", label)}>
				<button type="button" aria-pressed={mode === "rich"} onClick={() => switchMode("rich")} className={`btn btn-xs ${mode === "rich" ? "btn-active" : "btn-ghost"}`}>
					<TextAaIcon size={14} />
					{t("rich")}
				</button>
				<button type="button" aria-pressed={mode === "markdown"} onClick={() => switchMode("markdown")} className={`btn btn-xs ${mode === "markdown" ? "btn-active" : "btn-ghost"}`}>
					<CodeIcon size={14} />
					{t("markdown")}
				</button>
				<span id={hintId} className="ml-auto hidden truncate text-xs text-base-content/65 @lg:inline">
					{mode === "rich" ? t("richHint") : t("markdownHint")}
				</span>
			</div>
			{mode === "rich" ? (
				<CrepeView key={version} initial={value} onChange={onChange} placeholder={placeholder} autoFocus={autoFocus} label={label} name={name} describedBy={hintId} />
			) : (
				<textarea
					className="block w-full resize-y bg-transparent px-4 py-3 font-mono text-sm leading-relaxed outline-none"
					style={{ minHeight }}
					value={value}
					placeholder={placeholder}
					autoFocus={autoFocus}
					{...name}
					aria-describedby={hintId}
					onChange={e => onChange(e.target.value)}
				/>
			)}
		</div>
	);
}

/** Crepe's built-in strings are English; these hand it the active language. */
function crepeStrings(placeholder: string) {
	const h = (n: number) => ({ label: t("heading", n) });
	return {
		[Crepe.Feature.Placeholder]: { text: placeholder, mode: "doc" as const },
		[Crepe.Feature.TopBar]: {
			headingOptions: [{ label: t("paragraph"), level: null }, ...[1, 2, 3, 4, 5, 6].map(level => ({ label: t("heading", level), level }))]
		},
		[Crepe.Feature.BlockEdit]: {
			textGroup: { label: t("groupText"), text: { label: t("text") }, h1: h(1), h2: h(2), h3: h(3), h4: h(4), h5: h(5), h6: h(6), quote: { label: t("quote") }, divider: { label: t("divider") } },
			listGroup: { label: t("groupList"), bulletList: { label: t("bulletList") }, orderedList: { label: t("orderedList") }, taskList: { label: t("taskList") } },
			advancedGroup: { label: t("groupAdvanced"), image: { label: t("image") }, codeBlock: { label: t("code") }, table: { label: t("table") }, math: { label: t("math") } }
		},
		[Crepe.Feature.Toolbar]: {
			boldLabel: t("bold"),
			italicLabel: t("italic"),
			strikethroughLabel: t("strikethrough"),
			codeLabel: t("inlineCode"),
			linkLabel: t("link"),
			latexLabel: t("inlineMath")
		},
		[Crepe.Feature.LinkTooltip]: { inputPlaceholder: t("pasteLink") },
		[Crepe.Feature.ImageBlock]: {
			inlineUploadButton: t("upload"),
			inlineUploadPlaceholderText: t("orPasteLink"),
			blockUploadButton: t("uploadFile"),
			blockUploadPlaceholderText: t("orPasteLink"),
			blockConfirmButton: t("confirm"),
			blockCaptionPlaceholderText: t("imageCaption")
		},
		[Crepe.Feature.CodeMirror]: {
			searchPlaceholder: t("searchLanguage"),
			copyText: t("copy"),
			noResultText: t("noResult"),
			previewToggleText: (previewOnly: boolean) => (previewOnly ? t("edit") : t("hide")),
			previewLabel: t("preview"),
			previewLoading: t("loading")
		}
	};
}

/**
 * Crepe's top bar renders icon-only buttons with no names and acts on
 * pointerdown only. Name them (in the order Crepe builds them) and let
 * Enter/Space, which fire a click without a pointer, run them too.
 */
function topBarNames() {
	return [
		t("bold"),
		t("italic"),
		t("strikethrough"),
		t("inlineCode"),
		t("bulletList"),
		t("orderedList"),
		t("taskList"),
		t("link"),
		t("image"),
		t("table"),
		t("codeBlock"),
		t("math"),
		t("quote"),
		t("divider")
	];
}
const TOP_BAR_TOGGLES = new Set([0, 1, 2, 3, 7]);

function labelTopBar(bar: HTMLElement) {
	const names = topBarNames();
	const items = bar.querySelectorAll<HTMLButtonElement>(".top-bar-item");
	// Only trust the order while Crepe still builds the bar we know.
	if (items.length !== names.length) return;
	items.forEach((b, i) => {
		if (b.getAttribute("aria-label") !== names[i]) {
			b.setAttribute("aria-label", names[i]);
			b.title = names[i];
		}
		if (TOP_BAR_TOGGLES.has(i)) {
			const pressed = String(b.classList.contains("active"));
			if (b.getAttribute("aria-pressed") !== pressed) b.setAttribute("aria-pressed", pressed);
		}
	});
	const heading = bar.querySelector<HTMLButtonElement>(".top-bar-heading-button");
	if (heading) {
		const current = heading.textContent?.trim() ?? "";
		const name = `${t("textStyle")}: ${current}`;
		if (heading.getAttribute("aria-label") !== name) heading.setAttribute("aria-label", name);
		const expanded = String(!!bar.querySelector(".top-bar-heading-dropdown"));
		if (heading.getAttribute("aria-expanded") !== expanded) heading.setAttribute("aria-expanded", expanded);
	}
}

/** Crepe's link tooltip previews the URL in a new-tab link that is empty while hidden. */
function labelLinkPreview(el: HTMLElement) {
	for (const a of el.querySelectorAll<HTMLAnchorElement>("a.link-display")) {
		const text = a.textContent?.trim() ?? "";
		const name = text ? `${text}${tc("openInNewTab")}` : null;
		if (name) {
			if (a.getAttribute("aria-label") !== name) a.setAttribute("aria-label", name);
			if (a.title !== name) a.title = name;
			if (a.hasAttribute("tabindex")) a.removeAttribute("tabindex");
			a.removeAttribute("aria-hidden");
		} else if (a.getAttribute("aria-hidden") !== "true") {
			a.setAttribute("aria-hidden", "true");
			a.tabIndex = -1;
		}
	}
}

/** Crepe owns its DOM; it is created once per mount and fed the latest Markdown on mode switches. */
function CrepeView({
	initial,
	onChange,
	placeholder,
	autoFocus,
	label,
	name,
	describedBy
}: {
	initial: string;
	onChange: (md: string) => void;
	placeholder: string;
	autoFocus: boolean;
	label: string;
	name: Record<string, string>;
	describedBy: string;
}) {
	const root = useRef<HTMLDivElement>(null);
	const latest = useRef(onChange);
	latest.current = onChange;

	useEffect(() => {
		if (!root.current) return;
		const crepe = new Crepe({
			root: root.current,
			defaultValue: initial,
			features: { [Crepe.Feature.TopBar]: true, [Crepe.Feature.AI]: false },
			featureConfigs: crepeStrings(placeholder)
		});
		// Name the editable area (WCAG 4.1.2); ProseMirror applies these to its contenteditable.
		crepe.editor.config(ctx =>
			ctx.update(editorViewOptionsCtx, prev => ({
				...prev,
				attributes: { role: "textbox", "aria-multiline": "true", "aria-describedby": describedBy, ...name }
			}))
		);
		crepe.on(l => l.markdownUpdated((_ctx, md) => latest.current(md)));
		let alive = true;
		let observer: MutationObserver | undefined;
		const onKeyClick = (e: MouseEvent) => {
			// detail 0 = a click from the keyboard, not a pointer.
			const button = (e.target as HTMLElement).closest("button");
			if (e.detail !== 0 || !button) return;
			button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
		};
		void crepe.create().then(() => {
			const el = root.current;
			if (!alive || !el) return;
			// Crepe mounts the top bar and tooltips after create() resolves, so watch the whole editor.
			const patch = () => {
				const bar = el.querySelector<HTMLElement>(".milkdown-top-bar");
				if (bar && !bar.hasAttribute("aria-label")) {
					bar.setAttribute("role", "group");
					bar.setAttribute("aria-label", t("formatting", label));
					bar.addEventListener("click", onKeyClick);
				}
				if (bar) labelTopBar(bar);
				labelLinkPreview(el);
			};
			patch();
			observer = new MutationObserver(patch);
			observer.observe(el, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "href"] });
			if (autoFocus) el.querySelector<HTMLElement>(".ProseMirror")?.focus();
		});
		return () => {
			alive = false;
			observer?.disconnect();
			void crepe.destroy();
		};
		// Recreating on every keystroke would lose the cursor; `initial` is read once per mount.
	}, []);

	return <div ref={root} />;
}
