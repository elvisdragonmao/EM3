import { usePrefs } from "@/features/preferences/store";
import { ALL_THEMES } from "@/features/settings/themes";
import { useMedia } from "@/shared/hooks/useMedia";
import { useEffect } from "react";

/**
 * Mirrors the theme preference onto <html data-theme>. "system" defers to CSS.
 * Also sets data-scheme="light|dark" so assets (e.g. screenshots) can follow the theme,
 * and points <meta name="theme-color"> at the page background.
 */
export function ThemeSync() {
	const theme = usePrefs(s => s.theme);
	const motion = usePrefs(s => s.motion);
	const prefersDark = useMedia("(prefers-color-scheme: dark)");
	useEffect(() => {
		const root = document.documentElement;
		if (theme === "system") root.removeAttribute("data-theme");
		else root.setAttribute("data-theme", theme);
		const dark = theme === "system" ? prefersDark : (ALL_THEMES.find(t => t.name === theme)?.dark ?? false);
		root.dataset.scheme = dark ? "dark" : "light";
		// The installed app's title/status bar follows the page background.
		const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
		if (meta) meta.content = toRgb(getComputedStyle(document.body).backgroundColor) ?? meta.content;
	}, [theme, prefersDark]);
	useEffect(() => {
		document.documentElement.dataset.motion = motion;
	}, [motion]);
	return null;
}

/** Theme colours are oklch; some browsers only take sRGB for theme-color. */
function toRgb(color: string): string | null {
	const ctx = document.createElement("canvas").getContext("2d");
	if (!ctx) return null;
	ctx.fillStyle = color;
	ctx.fillRect(0, 0, 1, 1);
	const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
	return `rgb(${r}, ${g}, ${b})`;
}
