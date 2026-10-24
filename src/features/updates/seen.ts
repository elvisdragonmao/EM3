import { useSession } from "@/features/auth/session";
import { CURRENT_VERSION } from "./releases";

// The last version whose notes this device has seen. It's per device and never
// synced, like the "decide later" on the version picker.

const KEY = "em3:seen-version";

export function seenVersion(): string | null {
	try {
		return localStorage.getItem(KEY);
	} catch {
		return null;
	}
}

export function markSeen() {
	try {
		localStorage.setItem(KEY, CURRENT_VERSION);
	} catch {
		// Storage blocked (private mode): the dialog shows again next visit.
	}
}

// A first sign-in on this device starts at the current version, so only people
// who were already using EM3 get told what changed.
useSession.subscribe((s, prev) => {
	if (!prev.token && s.token && seenVersion() === null) markSeen();
});
