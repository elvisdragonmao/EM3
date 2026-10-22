import { usePrefs } from "@/features/preferences/store";
import { useEffect, useRef } from "react";

// One tiny hotkey layer for the whole app. Specs look like "mod+k", "mod+/",
// "?", "[", "j", "arrowleft", "shift+enter"; "mod" is ⌘ on Apple and Ctrl elsewhere.

export const isApple = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
export const MOD_LABEL = isApple ? "⌘" : "Ctrl";

export interface Binding {
	keys: string | string[];
	run: (e: KeyboardEvent) => void;
	/** Fire even while the user is typing in a field. */
	inInput?: boolean;
	/** Fire even while a modal dialog or overlay is open. */
	inModal?: boolean;
}

export function isTyping(target: EventTarget | null) {
	return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

export const overlayOpen = () => !!document.querySelector("dialog[open], [data-overlay]");

function matches(spec: string, e: KeyboardEvent) {
	const parts = spec.toLowerCase().split("+");
	const key = parts.pop()!;
	const wantMod = parts.includes("mod");
	const wantShift = parts.includes("shift");
	const wantAlt = parts.includes("alt");
	const mod = isApple ? e.metaKey : e.ctrlKey;
	if (wantMod !== mod || wantAlt !== e.altKey) return false;
	if (!wantMod && (e.metaKey || e.ctrlKey)) return false;
	// Letters and named keys care about Shift; symbols like "?" already encode it.
	if ((key.length > 1 || /[a-z0-9]/.test(key)) && wantShift !== e.shiftKey) return false;
	// ⌘/ can report a different e.key on some layouts; fall back to the physical key there only.
	return e.key.toLowerCase() === key || (key === "/" && wantMod && e.code === "Slash");
}

export function useHotkeys(bindings: Binding[], enabled = true) {
	const ref = useRef(bindings);
	ref.current = bindings;
	useEffect(() => {
		if (!enabled) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.defaultPrevented || e.isComposing) return;
			for (const b of ref.current) {
				const specs = Array.isArray(b.keys) ? b.keys : [b.keys];
				if (!specs.some(s => matches(s, e))) continue;
				// WCAG 2.1.4: single-character shortcuts can be turned off in Settings.
				if (!usePrefs.getState().singleKeyShortcuts && specs.every(isSingleKey)) continue;
				if (!b.inInput && isTyping(e.target)) continue;
				if (!b.inModal && overlayOpen()) continue;
				e.preventDefault();
				b.run(e);
				return;
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [enabled]);
}

/** A shortcut with no modifier that a stray keystroke or speech input could trigger. */
const isSingleKey = (spec: string) => spec.length === 1 || /^shift\+.$/.test(spec);

const visible = (el: HTMLElement) => el.offsetParent !== null || el.getClientRects().length > 0;

/** Moves focus to the next/previous `[data-nav]` item inside <main> (j / k). */
export function moveListFocus(dir: 1 | -1) {
	const items = [...document.querySelectorAll<HTMLElement>("#main [data-nav]")].filter(visible);
	if (!items.length) return;
	const current = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>("[data-nav]");
	const i = current ? items.indexOf(current) : -1;
	const next = i < 0 ? items[dir > 0 ? 0 : items.length - 1] : items[Math.min(items.length - 1, Math.max(0, i + dir))];
	next.focus({ preventScroll: true });
	next.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

/** Focuses the page's search field (f). */
export function focusSearch() {
	const el = document.querySelector<HTMLInputElement>("#main [data-search]");
	el?.focus();
	el?.select();
}

/**
 * Arrow-key movement inside a grid of buttons marked `data-cell="row:col"`.
 * Returns true when it handled the key.
 */
export function gridArrow(e: React.KeyboardEvent, container: HTMLElement | null) {
	const delta = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
	const from = (e.target as HTMLElement).closest<HTMLElement>("[data-cell]");
	if (!delta || !from || !container) return false;
	const [r, c] = from.dataset.cell!.split(":").map(Number);
	const target = container.querySelector<HTMLElement>(`[data-cell="${r + delta[0]}:${c + delta[1]}"]`);
	e.preventDefault();
	e.stopPropagation();
	target?.focus();
	return true;
}
