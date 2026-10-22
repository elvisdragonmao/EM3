import { usePrefs } from "@/features/preferences/store";
import { langTag } from "@/i18n";
import { MoodleError } from "@/lib/moodle/client";
import { DEFAULT_MOODLE_URL, MOODLE_SITES, MoodleUrlError, siteName } from "@/lib/moodle/site";
import { finishSso, registerSsoHandler, startSso } from "@/lib/moodle/sso";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { LanguageSelect } from "@/shared/ui/LanguagePicker";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowRightIcon, BellRingingIcon, CaretDownIcon, CheckIcon, CopyIcon, EyeIcon, EyeSlashIcon, LockSimpleIcon, ShieldCheckIcon, UserIcon } from "@phosphor-icons/react";
import { motion, MotionConfig } from "motion/react";
import { type FormEvent, useState } from "react";
import { tc } from "@/i18n/common";
import { t } from "./messages";
import { lastSite, useSession } from "./session";
import { Logo } from "@/shared/ui/Logo";

const REMEMBER_DAYS = 90;
const ERROR_ID = "login-error";

/** Which fields an error is about, so they can be marked invalid and point at the message. */
type ErrorField = "credentials" | "site" | "sso" | null;

const HANDLERS_URL = "chrome://settings/handlers";

export function LoginPage() {
	const signIn = useSession(s => s.signIn);
	const motionPref = usePrefs(s => s.motion);
	const navigate = useNavigate();
	const { next } = useSearch({ from: "/login" });
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [baseUrl, setBaseUrl] = useState(() => lastSite() ?? DEFAULT_MOODLE_URL);
	const [showOtherSchools, setShowOtherSchools] = useState(baseUrl !== DEFAULT_MOODLE_URL);
	const [customSite, setCustomSite] = useState(!MOODLE_SITES.some(site => site.baseUrl === baseUrl));
	const [remember, setRemember] = useState(true);
	const [reveal, setReveal] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<{ message: string; field: ErrorField } | null>(null);
	useDocumentTitle(t("docTitle"));

	const site = MOODLE_SITES.find(site => site.baseUrl === baseUrl);
	const sso = site?.sso;
	const passwordLogin = site?.password !== false;
	const [ssoLink, setSsoLink] = useState("");
	const [copied, setCopied] = useState(false);

	async function submit(e: FormEvent) {
		e.preventDefault();
		setBusy(true);
		setError(null);
		try {
			await signIn(baseUrl, username, password, remember);
			const target = next?.replace(/^#/, "");
			await navigate({ to: target && target !== "/login" ? target : "/" });
		} catch (err) {
			if (err instanceof MoodleError && err.code === "invalidlogin") setError({ message: t("invalidLogin"), field: "credentials" });
			else if (err instanceof MoodleUrlError || (err instanceof MoodleError && ["network", "notmoodle", "http"].includes(err.code))) setError({ message: err.message, field: "site" });
			else setError({ message: err instanceof Error ? err.message : t("signInFailed"), field: null });
		} finally {
			setBusy(false);
		}
	}

	const pasteSsoLink = () => {
		try {
			finishSso(ssoLink); // Check here first, so a wrong paste keeps the school picked.
		} catch (err) {
			return setError({ message: err instanceof Error ? err.message : t("signInFailed"), field: "sso" });
		}
		void navigate({ to: "/sso", search: { u: ssoLink } });
	};

	const credentialsInvalid = error?.field === "credentials";
	const ssoInvalid = error?.field === "sso";
	const siteInvalid = error?.field === "site" && customSite;
	const describedBy = (...ids: (string | false)[]) => ids.filter(Boolean).join(" ") || undefined;

	return (
		<MotionConfig reducedMotion={motionPref === "reduced" ? "always" : "user"}>
			<main className="relative flex min-h-dvh flex-col items-center justify-center overflow-x-hidden bg-base-200 px-4 pt-16 pb-6">
				<Backdrop />
				<div className="absolute top-3 right-3 z-10">
					<LanguageSelect />
				</div>
				<motion.div
					initial={{ opacity: 0, y: 24, scale: 0.98 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					transition={{ type: "spring", stiffness: 260, damping: 28 }}
					className="surface relative w-full max-w-md rounded-[1.75rem] p-7 shadow-2xl sm:p-9"
				>
					<div className="mb-8 flex items-center gap-3">
						<span aria-hidden className="shrink-0">
							<Logo size={52} decorative />
						</span>
						<div>
							<h1 className="text-xl font-semibold tracking-tight">EM3</h1>
							<p className="text-sm text-base-content/65">{t("tagline")}</p>
						</div>
					</div>
					{!showOtherSchools && <p className="mb-5 text-sm font-medium text-base-content/70">{t("signInWithE3")}</p>}

					<form onSubmit={submit} className="space-y-4">
						{showOtherSchools && (
							<div className="fieldset">
								<label htmlFor="moodle-site" className="fieldset-legend">
									{t("school")}
								</label>
								<select
									id="moodle-site"
									className="select select-lg w-full"
									value={customSite ? "custom" : baseUrl}
									onChange={e => {
										const custom = e.target.value === "custom";
										setCustomSite(custom);
										setBaseUrl(custom ? "" : e.target.value);
										if (MOODLE_SITES.find(site => site.baseUrl === e.target.value)?.sso) registerSsoHandler();
									}}
								>
									{MOODLE_SITES.map(site => {
										const { name, lang } = siteName(site);
										return (
											<option key={site.baseUrl} value={site.baseUrl} lang={lang === langTag() ? undefined : lang}>
												{name}
											</option>
										);
									})}
									<option value="custom">{t("otherSchool")}</option>
								</select>
								{customSite && (
									<>
										<label htmlFor="moodle-url" className="sr-only">
											{t("moodleUrl")}
										</label>
										<input
											id="moodle-url"
											type="text"
											inputMode="url"
											className="input input-lg mt-2 w-full"
											autoComplete="url"
											required
											placeholder="https://moodle.example.edu.tw"
											value={baseUrl}
											onChange={e => setBaseUrl(e.target.value)}
											aria-invalid={siteInvalid || undefined}
											aria-describedby={describedBy("moodle-url-hint", siteInvalid && ERROR_ID)}
										/>
										<p id="moodle-url-hint" className="label">
											{t("moodleUrlHint")}
										</p>
									</>
								)}
							</div>
						)}
						{passwordLogin && (
							<>
								<label className="input input-lg w-full">
									<UserIcon size={18} className="opacity-50" />
									<span className="sr-only">{t("username")}</span>
									<input
										className="grow"
										name="username"
										autoComplete="username"
										autoCapitalize="none"
										spellCheck={false}
										inputMode="text"
										required
										placeholder={t("username")}
										value={username}
										onChange={e => setUsername(e.target.value)}
										aria-invalid={credentialsInvalid || undefined}
										aria-describedby={describedBy(credentialsInvalid && ERROR_ID)}
									/>
								</label>
								<label className="input input-lg w-full pr-2">
									<LockSimpleIcon size={18} className="opacity-50" />
									{/* Named by this span alone, so the show-password button inside the label isn't read as part of it. */}
									<span id="login-password-label" className="sr-only">
										{t("password")}
									</span>
									<input
										type={reveal ? "text" : "password"}
										className="grow"
										name="password"
										autoComplete="current-password"
										required
										placeholder={t("password")}
										value={password}
										onChange={e => setPassword(e.target.value)}
										aria-labelledby="login-password-label"
										aria-invalid={credentialsInvalid || undefined}
										aria-describedby={describedBy(credentialsInvalid && ERROR_ID)}
									/>
									<button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={() => setReveal(r => !r)} aria-pressed={reveal} aria-label={t("showPassword")} title={t("showPassword")}>
										{reveal ? <EyeSlashIcon size={16} /> : <EyeIcon size={16} />}
									</button>
								</label>
							</>
						)}

						<label className="flex cursor-pointer items-center gap-2 text-sm">
							<input type="checkbox" className="checkbox checkbox-sm" checked={remember} onChange={e => setRemember(e.target.checked)} />
							{t("remember", REMEMBER_DAYS)}
						</label>

						{/* Always mounted so screen readers announce the message when it appears. */}
						<div id={ERROR_ID} role="alert">
							{error && (
								<motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-error">
									{error.message}
								</motion.p>
							)}
						</div>

						{passwordLogin && (
							<button type="submit" className="btn btn-neutral btn-lg w-full" disabled={busy}>
								{busy ? (
									<>
										<span aria-hidden className="loading loading-spinner loading-sm" />
										<span className="sr-only">{t("signingIn")}</span>
									</>
								) : (
									<>
										{t("signIn")}
										<ArrowRightIcon size={18} weight="bold" />
									</>
								)}
							</button>
						)}
					</form>

					{sso && (
						<div className="mt-4 space-y-3">
							{/* Chrome asks when the school is picked, so this sits above the button it precedes. */}
							{"registerProtocolHandler" in navigator && (
								<div className="flex gap-3 rounded-field border border-base-content/10 bg-base-content/5 p-3.5">
									<BellRingingIcon size={18} weight="duotone" className="mt-0.5 shrink-0 text-primary" />
									<div className="min-w-0 space-y-1.5">
										<p className="text-sm leading-relaxed">{t("ssoAllow")}</p>
										<p className="text-xs leading-relaxed text-base-content/65">
											{t(
												"ssoBlocked",
												<button
													type="button"
													aria-label={t("copyUrl", HANDLERS_URL)}
													className="mx-1 inline-flex items-center gap-1 rounded-field bg-base-content/10 px-1.5 py-0.5 font-mono text-base-content/80 transition-colors hover:bg-base-content/15"
													onClick={() =>
														navigator.clipboard
															.writeText(HANDLERS_URL)
															.then(() => {
																setCopied(true);
																setTimeout(() => setCopied(false), 1500);
															})
															// Clipboard refused: the URL stays on screen to copy by hand.
															.catch(() => {})
													}
												>
													{HANDLERS_URL}
													{copied ? <CheckIcon size={12} className="text-success" /> : <CopyIcon size={12} />}
												</button>,
												// A click, not a reload: the page may reopen on the remembered school without picking it again.
												<button type="button" className="link" onClick={registerSsoHandler}>
													{t("reask")}
												</button>
											)}
										</p>
										<p role="status" className="sr-only">
											{copied ? tc("copied") : ""}
										</p>
									</div>
								</div>
							)}
							<button
								type="button"
								className={`btn w-full ${passwordLogin ? "btn-outline" : "btn-neutral btn-lg"}`}
								disabled={busy}
								onClick={() => {
									try {
										startSso(baseUrl, sso.provider, remember, next);
									} catch {
										setError({ message: t("ssoStartFailed"), field: null });
									}
								}}
							>
								{t("ssoButton")}
							</button>
							{/* Safari cannot register the web+emthree handler, so there the paste box is the main path. */}
							<details open={!("registerProtocolHandler" in navigator)} className="group rounded-field border border-base-content/10">
								<summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-2.5 text-xs text-base-content/70 [&::-webkit-details-marker]:hidden">
									{t("ssoNotBack")}
									<CaretDownIcon size={14} className="shrink-0 transition-transform group-open:rotate-180" />
								</summary>
								<div className="space-y-3 border-t border-base-content/10 px-3.5 pt-3 pb-3.5">
									<ol className="space-y-2 text-xs leading-relaxed text-base-content/70">
										{[
											t(
												"ssoStepCopy",
												sso.pageName ?? "Moodle",
												// The link text comes from the school's Moodle language pack, not from EM3.
												sso.linkText ?? <span lang="zh-Hant-TW">若應用程式沒有自動開啟，請點選這裡</span>
											),
											t("ssoStepPaste")
										].map((step, i) => (
											<li key={i} className="flex gap-2.5">
												<span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full bg-base-content/10 font-semibold tabular-nums">
													{i + 1}
												</span>
												<span>{step}</span>
											</li>
										))}
									</ol>
									<div className="join w-full">
										<input
											className="input input-sm join-item grow"
											placeholder="web+emthree://token=…"
											aria-label={t("ssoLinkLabel")}
											autoComplete="off"
											spellCheck={false}
											value={ssoLink}
											onChange={e => setSsoLink(e.target.value)}
											aria-invalid={ssoInvalid || undefined}
											aria-describedby={describedBy(ssoInvalid && ERROR_ID)}
										/>
										<button type="button" className="btn btn-sm join-item" disabled={!ssoLink.trim()} onClick={pasteSsoLink}>
											{t("finishSignIn")}
										</button>
									</div>
								</div>
							</details>
						</div>
					)}
					<button
						type="button"
						className="btn btn-ghost btn-sm mt-2 w-full font-normal text-base-content/65"
						onClick={() => {
							if (showOtherSchools) {
								setBaseUrl(DEFAULT_MOODLE_URL);
								setCustomSite(false);
							}
							setShowOtherSchools(value => !value);
						}}
					>
						{showOtherSchools ? t("useNycu") : t("chooseOtherSchool")}
					</button>

					<p className="mt-6 flex gap-2 text-xs leading-relaxed text-base-content/65">
						<ShieldCheckIcon size={16} className="mt-0.5 shrink-0" />
						{t("staticSite")}
					</p>
				</motion.div>
				<Link to="/welcome" className="relative mt-6 text-sm text-base-content/65 hover:text-base-content">
					{t("whatIsEm3")}
				</Link>
			</main>
		</MotionConfig>
	);
}

/** The hand-drawn mark, blown up and softly blurred behind the card, breathing very slowly. */
function Backdrop() {
	return (
		<div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden">
			<motion.div
				className="opacity-35 blur-[56px]"
				initial={{ scale: 0.92, rotate: -4 }}
				animate={{ scale: [0.92, 1, 0.92], rotate: [-4, 2, -4] }}
				transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
			>
				<Logo size={1100} decorative className="max-w-[160vw]" />
			</motion.div>
			<div className="absolute inset-0 opacity-[0.07]">
				<Logo size={1100} decorative className="absolute top-1/2 left-1/2 max-w-[160vw] -translate-x-1/2 -translate-y-1/2" />
			</div>
		</div>
	);
}
