import { useSession } from "@/features/auth/session";
import { usePrefs } from "@/features/preferences/store";
import { ALL_THEMES } from "@/features/settings/themes";
import { getLanguage, getLocale } from "@/i18n";
import { tc } from "@/i18n/common";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { MOD_LABEL } from "@/shared/keyboard/hotkeys";
import { LanguageSelect } from "@/shared/ui/LanguagePicker";
import { Logo } from "@/shared/ui/Logo";
import { ArrowRightIcon, GithubLogoIcon, StarIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { motion, MotionConfig, useReducedMotion, useScroll, useTransform } from "motion/react";
import { Fragment, type ReactNode, useRef } from "react";
import { t } from "./messages";

export const REPO = "https://github.com/elvisdragonmao/EM3";

function useStars() {
	return useQuery({
		queryKey: ["github-stars"],
		staleTime: 60 * 60_000,
		queryFn: async () => {
			const res = await fetch("https://api.github.com/repos/elvisdragonmao/EM3");
			if (!res.ok) throw new Error(String(res.status));
			return ((await res.json()) as { stargazers_count: number }).stargazers_count;
		}
	});
}

/** A product screenshot in both schemes; CSS shows the one matching the theme. */
function Shot({ name, alt, eager = false, className = "" }: { name: string; alt: string; eager?: boolean; className?: string }) {
	return (
		<div className={`overflow-hidden rounded-xl border border-base-content/10 bg-base-200 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.35)] ${className}`}>
			{(["light", "dark"] as const).map(s => (
				<img key={s} src={`./screens/${name}-${s}.webp`} alt={alt} width={3840} height={2160} loading={eager ? "eager" : "lazy"} decoding="async" className={`block h-auto w-full shot-${s}`} />
			))}
		</div>
	);
}

/** The phone shots already have the iPhone 17 Pro frame baked in (see scripts/screens-to-webp.py). */
function Phone({ name, alt }: { name: string; alt: string }) {
	return (
		<div className="drop-shadow-[0_30px_40px_rgba(0,0,0,0.25)]">
			{(["light", "dark"] as const).map(s => (
				<img key={s} src={`./screens/${name}-${s}.webp`} alt={alt} width={900} height={1840} loading="lazy" decoding="async" className={`block h-auto w-full shot-${s}`} />
			))}
		</div>
	);
}

/** Renders a multi-line heading from its list of lines. */
function Lines({ lines, brClassName }: { lines: readonly string[]; brClassName?: string }) {
	return lines.map((line, i) => (
		<Fragment key={i}>
			{i > 0 && <br className={brClassName} />}
			{line}
		</Fragment>
	));
}

const reveal = {
	initial: { opacity: 0, y: 28 },
	whileInView: { opacity: 1, y: 0 },
	viewport: { once: true, margin: "-80px" },
	transition: { type: "spring", stiffness: 120, damping: 22 }
} as const;

function Feature({ title, children, shot, flip = false }: { title: ReactNode; children: ReactNode; shot: ReactNode; flip?: boolean }) {
	return (
		<section className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-14">
			<motion.div {...reveal} className={`lg:col-span-4 ${flip ? "lg:order-2" : ""}`}>
				<h2 className="text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">{title}</h2>
				<div className="mt-5 space-y-4 text-[1.05rem] leading-relaxed text-base-content/70">{children}</div>
			</motion.div>
			{/* Screenshots bleed past the column toward the window edge on large screens. */}
			<motion.div {...reveal} className={`lg:col-span-8 ${flip ? "lg:order-1 lg:-ml-28 xl:-ml-40" : "lg:-mr-28 xl:-mr-40"}`}>
				{shot}
			</motion.div>
		</section>
	);
}

function StarButton({ big = false }: { big?: boolean }) {
	const { data: stars } = useStars();
	return (
		<a href={REPO} target="_blank" rel="noreferrer" className={`btn ${big ? "btn-lg" : ""} gap-2 border-base-content/15 bg-base-100`}>
			<GithubLogoIcon size={big ? 20 : 18} weight="fill" />
			{t("starOnGitHub")}
			{typeof stars === "number" && (
				<>
					<span aria-hidden className="flex items-center gap-1 border-l border-base-content/15 pl-2 tabular-nums text-base-content/70">
						<StarIcon size={14} weight="fill" className="text-warning" />
						{stars}
					</span>
					<span className="sr-only">{t("starCount", stars)}</span>
				</>
			)}
			<span className="sr-only">{tc("openInNewTab")}</span>
		</a>
	);
}

/** Shortcut keys, paired in order with the `keyLabels` messages. */
const KEYS = [`${MOD_LABEL} K`, "1 – 8", "J  K", "[  ]", "U", `${MOD_LABEL} /`];

export function LandingPage() {
	const signedIn = useSession(s => !!s.token);
	const theme = usePrefs(s => s.theme);
	const setPref = usePrefs(s => s.set);
	const motionPref = usePrefs(s => s.motion);
	const reduceMotion = useReducedMotion() || motionPref === "reduced";
	const hero = useRef<HTMLDivElement>(null);
	const { scrollYProgress } = useScroll({ target: hero, offset: ["start end", "end start"] });
	const tilt = useTransform(scrollYProgress, [0, 0.45], [14, 0]);
	const scale = useTransform(scrollYProgress, [0, 0.45], [0.92, 1]);
	useDocumentTitle(t("docTitle"));
	// E3 has no Japanese UI, so the Japanese page quotes E3's English strings.
	const e3Lang = getLocale() === "ja" ? "en" : undefined;
	const timeBefore = t("timeBefore");
	const timeAfter = t("timeAfter");
	const keyLabels = t("keyLabels");
	const repoLink = (
		<a href={REPO} target="_blank" rel="noreferrer" className="link">
			github.com/elvisdragonmao/EM3
			<span className="sr-only">{tc("openInNewTab")}</span>
		</a>
	);

	const cta = signedIn ? (
		<Link to="/" className="btn btn-neutral btn-lg gap-2">
			{t("openEm3")}
			<ArrowRightIcon size={18} weight="bold" />
		</Link>
	) : (
		<Link to="/login" className="btn btn-neutral btn-lg gap-2">
			{t("signInSchool")}
			<ArrowRightIcon size={18} weight="bold" />
		</Link>
	);

	return (
		<MotionConfig reducedMotion={motionPref === "reduced" ? "always" : "user"}>
			<div className="min-h-dvh overflow-x-clip bg-base-100 text-base-content">
				<header className="surface sticky top-0 z-40 border-x-0 border-t-0">
					<div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
						{/* The logo names the link; the wordmark is hidden on the narrowest phones to make room. */}
						<Link to="/welcome" className="flex shrink-0 items-center gap-2.5">
							<Logo size={32} />
							<span aria-hidden className="hidden text-lg font-semibold tracking-tight min-[24rem]:inline">
								EM3
							</span>
						</Link>
						<nav className="ml-auto flex min-w-0 items-center gap-1 text-sm">
							<LanguageSelect className="min-w-0" />
							<a href={REPO} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm gap-1.5">
								<GithubLogoIcon size={17} weight="fill" />
								<span className="sr-only sm:not-sr-only">GitHub</span>
								<span className="sr-only">{tc("openInNewTab")}</span>
							</a>
							<Link to={signedIn ? "/" : "/login"} className="btn btn-neutral btn-sm">
								{signedIn ? t("openEm3") : t("signIn")}
							</Link>
						</nav>
					</div>
				</header>

				<main className="mx-auto max-w-6xl px-4 sm:px-6">
					<section className="pt-16 pb-10 sm:pt-24 lg:pt-32">
						<motion.h1
							initial={{ opacity: 0, y: 24 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ type: "spring", stiffness: 120, damping: 20 }}
							className="text-[3.2rem] leading-[1.02] font-black tracking-tight sm:text-7xl lg:text-[6.5rem]"
						>
							<Lines lines={t("heroTitle")} />
						</motion.h1>
						<motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.08 }}>
							<p className="mt-8 max-w-2xl text-lg leading-relaxed text-base-content/70 sm:text-xl">{t("heroBody")}</p>
							<div className="mt-10 flex flex-wrap gap-3">
								{cta}
								<StarButton big />
							</div>
						</motion.div>
					</section>

					<div ref={hero} className="pb-24 [perspective:1600px] sm:pb-32">
						<motion.div style={reduceMotion ? undefined : { rotateX: tilt, scale, transformOrigin: "50% 0%" }}>
							<Shot name="dashboard" alt={t("dashboardAlt")} eager />
						</motion.div>
					</div>

					<div className="space-y-28 pb-28 sm:space-y-40 sm:pb-40">
						<section className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-16">
							<motion.h2 {...reveal} className="text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl lg:col-span-5">
								<Lines lines={t("focusTitle")} />
							</motion.h2>
							<motion.div {...reveal} className="space-y-4 text-[1.05rem] leading-relaxed text-base-content/70 lg:col-span-7">
								{t("focusBody").map(p => (
									<p key={p}>{p}</p>
								))}
							</motion.div>
						</section>

						<section>
							<motion.h2 {...reveal} className="max-w-3xl text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">
								<Lines lines={t("timeTitle")} brClassName="sm:hidden" />
							</motion.h2>
							<motion.p {...reveal} className="mt-5 max-w-2xl text-[1.05rem] leading-relaxed text-base-content/70">
								{t("timeBody")}
							</motion.p>
							<motion.dl {...reveal} className="mt-12 divide-y divide-base-content/10 border-y border-base-content/10">
								{timeBefore.map((before, i) => (
									<div key={before} className="grid grid-cols-1 gap-1 py-5 sm:grid-cols-2 sm:gap-8">
										<dt className="font-mono text-sm text-base-content/65 sm:text-base">
											<span className="sr-only">{t("timeBeforeLabel")}</span>
											<span lang={e3Lang}>{before}</span>
										</dt>
										<dd className="text-xl font-semibold tracking-tight sm:text-2xl">
											<span className="sr-only">{t("timeAfterLabel")}</span>
											{timeAfter[i]}
										</dd>
									</div>
								))}
							</motion.dl>
						</section>

						<Feature title={<Lines lines={t("filesTitle")} />} shot={<Shot name="materials" alt={t("materialsAlt")} />}>
							{t("filesBody").map(p => (
								<p key={p}>{p}</p>
							))}
						</Feature>

						<Feature flip title={<Lines lines={t("submitTitle")} />} shot={<Shot name="submit" alt={t("submitAlt")} />}>
							{t("submitBody").map(p => (
								<p key={p}>{p}</p>
							))}
						</Feature>

						<Feature title={<Lines lines={t("coursesTitle")} />} shot={<Shot name="courses" alt={t("coursesAlt")} />}>
							{t("coursesBody").map(p => (
								<p key={p}>{p}</p>
							))}
						</Feature>

						<Feature flip title={<Lines lines={t("timetableTitle")} />} shot={<Shot name="timetable" alt={t("timetableAlt")} />}>
							<p>{t("timetableBody")}</p>
						</Feature>

						<section className="grid grid-cols-1 gap-8 border-t border-base-content/10 pt-20 lg:grid-cols-12 lg:gap-16">
							<motion.h2 {...reveal} className="text-3xl leading-tight font-bold tracking-tight text-balance sm:text-5xl lg:col-span-6">
								<Lines lines={t("teacherTitle")} />
							</motion.h2>
							<motion.div {...reveal} className="space-y-4 text-[1.05rem] leading-relaxed text-base-content/70 lg:col-span-6">
								<p>{t("teacherBody")}</p>
							</motion.div>
						</section>

						<Feature title={<Lines lines={t("gradingTitle")} />} shot={<Shot name="grading" alt={t("gradingAlt")} />}>
							{t("gradingBody").map(p => (
								<p key={p}>{p}</p>
							))}
						</Feature>

						<section className="space-y-10">
							<motion.div {...reveal} className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-16">
								<h2 className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl lg:col-span-5">
									<Lines lines={t("quizTitle")} />
								</h2>
								<div className="space-y-4 text-[1.05rem] leading-relaxed text-base-content/70 lg:col-span-7">
									{t("quizBody").map(p => (
										<p key={p}>{p}</p>
									))}
								</div>
							</motion.div>
							<motion.div {...reveal} className="grid grid-cols-1 gap-6 md:grid-cols-2">
								<Shot name="quiz" alt={t("quizAlt")} />
								<Shot name="announce" alt={t("announceAlt")} />
							</motion.div>
						</section>

						<section className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-16">
							<motion.div {...reveal} className="lg:col-span-5">
								<h2 className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl">{t("keyboardTitle")}</h2>
								<p className="mt-5 text-[1.05rem] leading-relaxed text-base-content/70">{t("keyboardBody", MOD_LABEL)}</p>
								<dl className="mt-8 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
									{KEYS.map((k, i) => (
										<div key={k} className="flex items-center gap-3">
											<dt className="flex gap-1">
												{k.split(/\s+/).map(part => (
													<kbd key={part} className="kbd kbd-sm">
														{part}
													</kbd>
												))}
											</dt>
											<dd className="text-sm text-base-content/70">{keyLabels[i]}</dd>
										</div>
									))}
								</dl>
							</motion.div>
							<motion.div {...reveal} className="lg:col-span-7 lg:-mr-28 xl:-mr-40">
								<Shot name="shortcuts" alt={t("shortcutsAlt")} />
							</motion.div>
						</section>

						<section className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
							<motion.div {...reveal} className="lg:col-span-5">
								<h2 className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl">{t("mobileTitle")}</h2>
								<p className="mt-5 text-[1.05rem] leading-relaxed text-base-content/70">{t("mobileBody")}</p>
							</motion.div>
							<motion.div {...reveal} className="mx-auto grid w-full max-w-lg grid-cols-2 gap-5 sm:gap-8 lg:col-span-7">
								<Phone name="mobile-dashboard" alt={t("mobileDashboardAlt")} />
								<div className="pt-16">
									<Phone name="mobile-course" alt={t("mobileCourseAlt")} />
								</div>
							</motion.div>
						</section>

						<section>
							<motion.h2 {...reveal} className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
								{t("themesTitle", ALL_THEMES.length)}
							</motion.h2>
							<motion.p {...reveal} className="mt-5 max-w-2xl text-[1.05rem] leading-relaxed text-base-content/70">
								{t("themesBody")}
							</motion.p>
							<motion.div {...reveal} role="group" aria-label={t("themesGroup")} className="mt-10 flex flex-wrap gap-2">
								<button
									type="button"
									onClick={() => setPref("theme", "system")}
									className={`btn btn-sm rounded-full ${theme === "system" ? "btn-neutral" : "border-base-content/15"}`}
									aria-pressed={theme === "system"}
								>
									{t("followSystem")}
								</button>
								{ALL_THEMES.map(th => (
									<button
										type="button"
										key={th.name}
										onClick={() => setPref("theme", th.name)}
										aria-pressed={theme === th.name}
										className={`flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition motion-safe:hover:-translate-y-0.5 ${theme === th.name ? "border-base-content" : "border-base-content/15"}`}
										style={{ backgroundColor: th.swatch[0], color: th.swatch[4] }}
									>
										<span aria-hidden className="flex -space-x-1">
											{th.swatch.slice(1, 4).map((c, i) => (
												<span key={i} className="size-4 rounded-full border border-black/10" style={{ backgroundColor: c }} />
											))}
										</span>
										<span lang="en">{th.name}</span>
									</button>
								))}
							</motion.div>
						</section>

						<section className="grid grid-cols-1 gap-10 border-t border-base-content/10 pt-16 lg:grid-cols-12">
							<motion.h2 {...reveal} className="text-3xl leading-tight font-bold tracking-tight lg:col-span-4 sm:text-4xl">
								<Lines lines={t("privacyTitle")} />
							</motion.h2>
							<motion.ul {...reveal} className="space-y-6 text-[1.05rem] leading-relaxed text-base-content/70 lg:col-span-8">
								{(["dataChoice", "noPassword", "noAutoRead"] as const).map(key => {
									const [lead, body] = t(key);
									return (
										<li key={key}>
											<strong className="text-base-content">{lead}</strong>
											{body}
										</li>
									);
								})}
								<li>
									<strong className="text-base-content">{t("openSource")}</strong>
									{t("openSourceBody", repoLink)}
								</li>
							</motion.ul>
						</section>

						<section className="text-center">
							<motion.div {...reveal} className="flex flex-col items-center">
								<span aria-hidden>
									<Logo size={96} decorative />
								</span>
								<h2 className="mt-8 text-4xl leading-tight font-black tracking-tight sm:text-6xl">{t("outroTitle")}</h2>
								<p className="mt-5 max-w-xl text-lg text-base-content/70">{t("outroBody")}</p>
								<div className="mt-10 flex flex-wrap justify-center gap-3">
									{cta}
									<StarButton big />
								</div>
							</motion.div>
						</section>
					</div>
				</main>

				<footer className="border-t border-base-content/10">
					<div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-base-content/65 sm:flex-row sm:items-center sm:px-6">
						<p className="flex items-center gap-2">
							<span aria-hidden className="shrink-0">
								<Logo size={20} decorative />
							</span>
							<span>
								{t(
									"footer",
									<a href="https://elvismao.com/" className="link" lang={getLanguage() === "zh-TW" ? undefined : "zh-Hant-TW"}>
										毛哥EM
									</a>
								)}
							</span>
						</p>
						<span className="sm:ml-auto">
							<a href={REPO} target="_blank" rel="noreferrer" className="link link-hover">
								GitHub
								<span className="sr-only">{tc("openInNewTab")}</span>
							</a>
							<span className="mx-2">·</span>
							Apache-2.0
						</span>
					</div>
				</footer>
			</div>
		</MotionConfig>
	);
}
