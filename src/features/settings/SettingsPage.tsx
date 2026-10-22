import { idbPersister, queryClient } from "@/app/queryClient";
import { useSession } from "@/features/auth/session";
import { useSiteInfo } from "@/features/courses/api";
import { type CalendarSpan, exportPrefs, importPrefs, usePrefs } from "@/features/preferences/store";
import { isIos, isStandalone, useInstallPrompt } from "@/shared/pwa/install";
import { Avatar } from "@/shared/ui/Avatar";
import { PageTitle } from "@/shared/ui/States";
import { ArrowsClockwiseIcon, CheckIcon, DesktopIcon, DeviceMobileIcon, DownloadSimpleIcon, ExportIcon, SignOutIcon, TrashIcon, UploadSimpleIcon } from "@phosphor-icons/react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { type ReactNode, useRef, useState } from "react";
import { LanguageRadios } from "@/shared/ui/LanguagePicker";
import { t } from "./messages";
import { ALL_THEMES, type ThemeInfo } from "./themes";

function Section({ id, title, desc, children }: { id: string; title: string; desc?: string; children: ReactNode }) {
	return (
		<section aria-labelledby={id} className="grid grid-cols-1 gap-4 border-t hairline py-8 first:border-t-0 first:pt-0 md:grid-cols-[14rem_1fr]">
			<div>
				<h2 id={id} className="font-semibold">
					{title}
				</h2>
				{desc && <p className="mt-1 text-sm text-base-content/65">{desc}</p>}
			</div>
			<div className="min-w-0">{children}</div>
		</section>
	);
}

export function SettingsPage() {
	const { data: me } = useSiteInfo();
	const prefs = usePrefs();
	const signOut = useSession(s => s.signOut);
	const baseUrl = useSession(s => s.baseUrl);
	const navigate = useNavigate();
	const fileInput = useRef<HTMLInputElement>(null);
	const [msg, setMsg] = useState<string | null>(null);

	function download() {
		const blob = new Blob([exportPrefs()], { type: "application/json" });
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = `em3-settings-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(a.href);
	}

	async function upload(file: File) {
		try {
			importPrefs(await file.text());
			setMsg(t("imported"));
		} catch (e) {
			setMsg(t("importFailed", e instanceof Error ? e.message : undefined));
		}
	}

	async function logout() {
		signOut();
		queryClient.clear();
		await idbPersister.removeClient();
		await navigate({ to: "/login" });
	}

	return (
		<div className="max-w-4xl">
			<PageTitle title={t("title")} subtitle={t("subtitle")} />

			<Section id="settings-account" title={t("account")} desc={t("accountDesc")}>
				<div className="card-quiet flex flex-wrap items-center gap-4 p-4">
					{me && <Avatar me={me} size={48} />}
					<div className="min-w-0 grow">
						<p className="font-semibold">{me?.firstname}</p>
						<p className="text-sm text-base-content/65">
							{me?.lastname} · {me?.username}
						</p>
						<p className="truncate text-xs text-base-content/65">{baseUrl}</p>
					</div>
					<button className="btn btn-sm" onClick={logout}>
						<SignOutIcon size={16} />
						{t("signOut")}
					</button>
				</div>
			</Section>

			<Section id="settings-personal" title={t("personal")} desc={t("personalDesc")}>
				<div className="space-y-4">
					<LanguageRadios />
					<fieldset className="fieldset">
						<legend className="fieldset-legend">
							<label htmlFor="settings-nickname">{t("nickname")}</label>
						</legend>
						<input
							id="settings-nickname"
							className="input w-full max-w-xs"
							autoComplete="nickname"
							aria-describedby="settings-nickname-hint"
							placeholder={me?.firstname ?? ""}
							value={prefs.nickname}
							onChange={e => prefs.set("nickname", e.target.value)}
						/>
						<p id="settings-nickname-hint" className="label">
							{t("nicknameHint")}
						</p>
					</fieldset>
					{(
						[
							["calendarSpan", t("dashboardSpan")],
							["calendarPageSpan", t("calendarSpan")]
						] as const
					).map(([key, legend]) => (
						<fieldset key={key} className="fieldset">
							<legend className="fieldset-legend">{legend}</legend>
							<div className="join">
								{(
									[
										["week", t("week")],
										["twoWeeks", t("twoWeeks")],
										["month", t("month")]
									] as [CalendarSpan, string][]
								).map(([k, label]) => (
									<button key={k} aria-pressed={prefs[key] === k} className={`btn join-item btn-sm ${prefs[key] === k ? "btn-active" : ""}`} onClick={() => prefs.set(key, k)}>
										{label}
									</button>
								))}
							</div>
						</fieldset>
					))}
					<label className="flex max-w-sm cursor-pointer items-center justify-between gap-3 text-sm">
						{t("showWeekend")}
						<input type="checkbox" className="toggle toggle-sm" checked={prefs.showWeekend} onChange={e => prefs.set("showWeekend", e.target.checked)} />
					</label>
					<label className="flex max-w-sm cursor-pointer items-center justify-between gap-3 text-sm">
						{t("reduceMotion")}
						<input type="checkbox" className="toggle toggle-sm" checked={prefs.motion === "reduced"} onChange={e => prefs.set("motion", e.target.checked ? "reduced" : "full")} />
					</label>
					<div className="max-w-sm">
						<label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
							{t("singleKey")}
							<input
								type="checkbox"
								className="toggle toggle-sm"
								aria-describedby="settings-single-key-hint"
								checked={prefs.singleKeyShortcuts}
								onChange={e => prefs.set("singleKeyShortcuts", e.target.checked)}
							/>
						</label>
						<p id="settings-single-key-hint" className="mt-1 text-xs text-base-content/65">
							{t("singleKeyHint")}
						</p>
					</div>
					<p className="text-sm text-base-content/65">
						{t(
							"lookHint",
							<Link to="/courses" className="link">
								{t("courses")}
							</Link>,
							<Link to="/timetable" className="link">
								{t("timetable")}
							</Link>
						)}
					</p>
				</div>
			</Section>

			<Section id="settings-theme" title={t("theme")} desc={t("themeDesc", ALL_THEMES.length - 2)}>
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
					<ThemeCard name="system" label={t("followSystem")} active={prefs.theme === "system"} onPick={() => prefs.set("theme", "system")} />
					{ALL_THEMES.map(t => (
						<ThemeCard key={t.name} name={t.name} info={t} active={prefs.theme === t.name} onPick={() => prefs.set("theme", t.name)} />
					))}
				</div>
			</Section>

			<Section id="settings-app" title={t("app")} desc={t("appDesc")}>
				<InstallApp />
			</Section>

			<Section id="settings-data" title={t("data")} desc={t("dataDesc")}>
				<div className="flex flex-wrap gap-2">
					<button className="btn btn-sm" onClick={download}>
						<DownloadSimpleIcon size={16} />
						{t("exportSettings")}
					</button>
					<button className="btn btn-sm" onClick={() => fileInput.current?.click()}>
						<UploadSimpleIcon size={16} />
						{t("importSettings")}
					</button>
					<input ref={fileInput} type="file" accept="application/json,.json" hidden aria-label={t("importSettings")} onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
					<button
						className="btn btn-sm"
						onClick={async () => {
							queryClient.clear();
							await idbPersister.removeClient();
							await queryClient.refetchQueries();
							setMsg(t("cacheCleared"));
						}}
					>
						<ArrowsClockwiseIcon size={16} />
						{t("clearCache")}
					</button>
					<button
						className="btn btn-sm btn-ghost text-error"
						onClick={() => {
							if (confirm(t("resetConfirm"))) {
								prefs.reset();
								setMsg(t("resetDone"));
							}
						}}
					>
						<TrashIcon size={16} />
						{t("resetAll")}
					</button>
				</div>
				<p role="status" className="mt-3 text-sm text-base-content/70 empty:hidden">
					{msg && (
						<motion.span key={msg} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="inline-block">
							{msg}
						</motion.span>
					)}
				</p>
				<details className="mt-4 text-sm">
					<summary className="cursor-pointer text-base-content/65">{t("stored")}</summary>
					<ul className="mt-2 space-y-1 text-base-content/65">
						<li>{t("storedLooks", Object.keys(prefs.courses).length)}</li>
						<li>{t("storedTimetable", Object.keys(prefs.timetable).length)}</li>
						<li>{t("storedSeen", Object.keys(prefs.seen).length)}</li>
					</ul>
				</details>
			</Section>

			<Section id="settings-about" title={t("about")} desc={t("aboutDesc")}>
				<p className="text-sm leading-relaxed text-base-content/65">
					{t("aboutBody")}
					{me && <span className="mt-2 block text-xs text-base-content/65">Moodle {me.release}</span>}
				</p>
			</Section>
		</div>
	);
}

function ThemeCard({ name, label, info, active, onPick }: { name: string; label?: string; info?: ThemeInfo; active: boolean; onPick: () => void }) {
	return (
		<button
			onClick={onPick}
			data-theme={info ? name : undefined}
			className={`relative overflow-hidden rounded-xl border text-left transition hover:-translate-y-0.5 ${active ? "border-base-content ring-2 ring-base-content/20" : "border-base-content/10"}`}
			style={info ? { backgroundColor: info.swatch[0], color: info.swatch[4] } : undefined}
			aria-pressed={active}
		>
			{info ? (
				<div className="flex gap-1 px-3 pt-3">
					{info.swatch.slice(1, 4).map((c, i) => (
						<span key={i} className="h-5 w-4 rounded-md" style={{ backgroundColor: c }} />
					))}
				</div>
			) : (
				<div className="flex px-3 pt-3">
					<DesktopIcon size={20} />
				</div>
			)}
			<div className="flex items-center justify-between px-3 pt-2 pb-3 text-sm font-medium">
				{label ?? name}
				{active && <CheckIcon size={15} weight="bold" />}
			</div>
		</button>
	);
}

function InstallApp() {
	const install = useInstallPrompt();
	if (isStandalone())
		return (
			<p className="flex items-center gap-2 text-sm text-base-content/70">
				<CheckIcon size={16} className="text-success" />
				{t("installed")}
			</p>
		);
	if (install)
		return (
			<button className="btn btn-sm btn-primary" onClick={install}>
				<DeviceMobileIcon size={16} />
				{t("install")}
			</button>
		);
	if (isIos())
		return (
			<p className="text-sm leading-relaxed text-base-content/70">
				{t("iosInstall", <ExportIcon size={15} className="inline align-[-2px]" aria-hidden={false} aria-label={t("shareButton")} role="img" />)}
			</p>
		);
	return <p className="text-sm leading-relaxed text-base-content/70">{t("browserInstall")}</p>;
}
