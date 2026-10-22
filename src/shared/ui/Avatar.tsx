import type { SiteInfo } from "@/lib/moodle/types";
import { useState } from "react";

/**
 * E3 serves Gravatar URLs with `d=mm` (a grey silhouette). Asking for `d=404`
 * instead lets users without a Gravatar fall back to their initials.
 */
function gravatar(url: string, px: number) {
	try {
		const u = new URL(url);
		if (!/gravatar\.com$/.test(u.hostname)) return url;
		u.searchParams.set("d", "404");
		u.searchParams.set("s", String(px * 2));
		return u.toString();
	} catch {
		return url;
	}
}

/**
 * `alt` names the person; leave it out when their name is shown right next to
 * the picture, which then is decorative (WCAG 1.1.1).
 */
export function Avatar({ me, size = 32, alt = "" }: { me: SiteInfo; size?: number; alt?: string }) {
	const [failed, setFailed] = useState(false);
	const src = me.userpictureurl ? gravatar(me.userpictureurl, size) : "";
	return (
		<div className={`avatar ${failed || !src ? "avatar-placeholder" : ""}`}>
			<div className="rounded-full bg-base-300" style={{ width: size, height: size, fontSize: `${(size * 0.36) / 16}rem` }}>
				{failed || !src ? <span {...(alt ? { role: "img", "aria-label": alt } : { "aria-hidden": true })}>{me.firstname.slice(-2)}</span> : <img src={src} alt={alt} onError={() => setFailed(true)} />}
			</div>
		</div>
	);
}
