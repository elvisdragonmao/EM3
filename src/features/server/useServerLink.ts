import { useSession } from "@/features/auth/session";
import { getLocale } from "@/i18n";
import { useEffect } from "react";
import { ensureLinked, useServer } from "./store";
import { usePrefsSync } from "./sync";

/** Keeps the server session in step with the Moodle session; mounted once in the app shell. */
export function useServerLink() {
	const token = useSession(s => s.token);
	const mode = useServer(s => s.mode);
	// The app remounts on a language change, so this also tells the server the new notification language.
	const locale = getLocale();
	useEffect(() => {
		if (mode === "server" && token) void ensureLinked();
	}, [mode, token, locale]);
	usePrefsSync();
}
