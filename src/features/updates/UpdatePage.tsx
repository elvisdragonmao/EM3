import { useSession } from "@/features/auth/session";
import { tc } from "@/i18n/common";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { LanguageSelect } from "@/shared/ui/LanguagePicker";
import { Logo } from "@/shared/ui/Logo";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { t } from "./messages";
import { ReleaseEntry } from "./ReleaseNotes";
import { CURRENT_VERSION, RELEASES } from "./releases";
import { markSeen } from "./seen";

/** /update: every release's notes, public like the introduction page. */
export function UpdatePage() {
	const signedIn = useSession(s => !!s.token);
	useDocumentTitle(t("title"));

	// Reading the changelog counts as seeing what's new.
	useEffect(() => {
		if (signedIn) markSeen();
	}, [signedIn]);

	return (
		<div className="min-h-dvh bg-base-100 text-base-content">
			<header className="surface sticky top-0 z-40 border-x-0 border-t-0">
				<div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
					<Link to={signedIn ? "/" : "/welcome"} className="flex shrink-0 items-center gap-2.5" aria-label={t("home")}>
						<Logo size={32} decorative />
						<span aria-hidden className="hidden text-lg font-semibold tracking-tight min-[24rem]:inline">
							EM3
						</span>
					</Link>
					<nav className="ml-auto flex min-w-0 items-center gap-1 text-sm">
						<LanguageSelect className="min-w-0" />
						<Link to={signedIn ? "/" : "/login"} className="btn btn-neutral btn-sm">
							{signedIn ? t("openEm3") : t("signIn")}
						</Link>
					</nav>
				</div>
			</header>

			<main className="mx-auto max-w-3xl px-4 pt-12 pb-24 sm:px-6 sm:pt-16">
				<h1 className="text-4xl font-black tracking-tight sm:text-5xl">{t("title")}</h1>
				<p className="mt-4 text-lg leading-relaxed text-base-content/70">
					{t("intro")} {t("currentVersion", CURRENT_VERSION)}
				</p>
				<p className="mt-2 text-sm">
					<a href="https://github.com/elvisdragonmao/EM3/releases" target="_blank" rel="noreferrer" className="link">
						{t("githubReleases")}
						<span className="sr-only">{tc("openInNewTab")}</span>
					</a>
				</p>

				<div className="mt-10 divide-y divide-base-content/10 border-t border-base-content/10">
					{RELEASES.map((r, i) => (
						<div key={r.version} className="py-10">
							<ReleaseEntry release={r} level={2} latest={i === 0} />
						</div>
					))}
				</div>
			</main>
		</div>
	);
}
