import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Taiwan's accessibility checker (CS2140401C) rejects px font sizes. Milkdown's
// and KaTeX's CSS use them, so rewrite those declarations to the equivalent rem.
const remFontSizes = {
	postcssPlugin: "em3-rem-font-sizes",
	Declaration: {
		"font-size": (decl: { value: string; source?: { input: { file?: string } } }) => {
			if (!/[\\/](@milkdown|katex)[\\/]/.test(decl.source?.input.file ?? "")) return;
			decl.value = decl.value.replace(/(-?\d*\.?\d+)px/g, (_, n: string) => `${+(Number(n) / 16).toFixed(4)}rem`);
		}
	}
};

// Relative base keeps the build portable: it works at a domain root, a GitHub
// Pages project path, or opened from any static host. Routing uses hash history.
export default defineConfig({
	base: "./",
	plugins: [react(), tailwindcss()],
	css: { postcss: { plugins: [remFontSizes] } },
	resolve: {
		alias: { "@": new URL("./src", import.meta.url).pathname }
	},
	build: {
		target: "es2022",
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (/node_modules\/(\.pnpm\/)?(react|react-dom|scheduler)[@/]/.test(id)) return "react";
					if (/node_modules\/.*(motion|framer-motion|motion-dom|motion-utils)[@/]/.test(id)) return "motion";
					if (id.includes("@tanstack")) return "tanstack";
				}
			}
		}
	}
});
