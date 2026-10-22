// Reminder settings for the server version (DESIGN.md, 伺服器版): push, Discord webhook, lead times.

import { BellRingingIcon, BellSlashIcon, DiscordLogoIcon, PaperPlaneTiltIcon } from "@phosphor-icons/react";
import { useEffect, useId, useState } from "react";
import {
	currentSubscription,
	disablePush,
	enablePush,
	isDiscordWebhook,
	type NotifySettings,
	type PushState,
	readPushState,
	sendTest,
	type TestResult,
	useNotifySettings,
	useRefreshNotify,
	useUpdateNotify
} from "./api";
import { t } from "./messages";

const LEADS = [1, 3, 6, 24, 72, 168];
const MAX_LEADS = 4;

const reason = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function NotificationSettings() {
	const { data, error } = useNotifySettings();
	const update = useUpdateNotify();

	if (error) return <p className="text-sm text-error">{t("loadFailed", reason(error))}</p>;
	if (!data) return <span className="loading loading-sm loading-dots" aria-hidden />;

	const save = (patch: Parameters<typeof update.save>[0]) => void update.save(patch).catch(() => {});

	return (
		<div className="space-y-6">
			<div className="max-w-md space-y-4">
				<div>
					<label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium">
						{t("enable")}
						<input type="checkbox" className="toggle toggle-sm" aria-describedby="notify-enable-hint" checked={data.enabled} onChange={e => save({ enabled: e.target.checked })} />
					</label>
					<p id="notify-enable-hint" className="mt-1 text-xs text-base-content/65">
						{t("enableHint")}
					</p>
				</div>
				<LeadChips
					settings={data}
					onToggle={h => {
						const chosen = update.current()?.leadHours ?? data.leadHours;
						const next = chosen.includes(h) ? chosen.filter(x => x !== h) : [...chosen, h];
						if (next.length >= 1 && next.length <= MAX_LEADS) save({ leadHours: next });
					}}
				/>
				<label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
					{t("deadlines")}
					<input type="checkbox" className="toggle toggle-sm" checked={data.deadlines} onChange={e => save({ deadlines: e.target.checked })} />
				</label>
				<div>
					<label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
						{t("grading")}
						<input type="checkbox" className="toggle toggle-sm" aria-describedby="notify-grading-hint" checked={data.grading} onChange={e => save({ grading: e.target.checked })} />
					</label>
					<p id="notify-grading-hint" className="mt-1 text-xs text-base-content/65">
						{t("gradingHint")}
					</p>
				</div>
				<p role="alert" className="text-sm text-error empty:hidden">
					{update.error && t("saveFailed", reason(update.error))}
				</p>
			</div>

			<div className="space-y-5">
				<h3 className="text-sm font-semibold">{t("channels")}</h3>
				<PushDevice devices={data.pushDevices} />
				<DiscordWebhook settings={data} />
				<TestButton />
			</div>
		</div>
	);
}

function LeadChips({ settings, onToggle }: { settings: NotifySettings; onToggle: (hours: number) => void }) {
	const chosen = settings.leadHours;
	// Keep any value saved elsewhere visible even if it isn't one of the presets.
	const options = [...new Set([...LEADS, ...chosen])].sort((a, b) => a - b);
	return (
		<fieldset className="fieldset" aria-describedby="notify-lead-hint">
			<legend className="fieldset-legend">{t("leadLegend")}</legend>
			<div className="flex flex-wrap gap-2">
				{options.map(h => {
					const on = chosen.includes(h);
					const blocked = on ? chosen.length === 1 : chosen.length >= MAX_LEADS;
					return (
						<button
							key={h}
							type="button"
							aria-pressed={on}
							disabled={blocked}
							className={`btn btn-sm rounded-full ${on ? "btn-primary" : "btn-outline border-base-content/20"}`}
							onClick={() => onToggle(h)}
						>
							{t("lead", h)}
						</button>
					);
				})}
			</div>
			<p id="notify-lead-hint" className="label">
				{t("leadHint", MAX_LEADS)}
			</p>
		</fieldset>
	);
}

function PushDevice({ devices }: { devices: number }) {
	const [state, setState] = useState<PushState | null>(null);
	const [busy, setBusy] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);
	const refresh = useRefreshNotify();

	useEffect(() => {
		let live = true;
		void readPushState()
			.then(s => live && setState(s))
			.catch(() => live && setState("off"));
		return () => {
			live = false;
		};
	}, []);

	async function run(fn: () => Promise<PushState>) {
		setBusy(true);
		setFailure(null);
		try {
			setState(await fn());
		} catch (err) {
			setFailure(t("pushFailed", reason(err)));
		} finally {
			setBusy(false);
			void refresh();
		}
	}

	const text = {
		unsupported: t("pushUnsupported"),
		needsInstall: t("pushNeedsInstall"),
		denied: t("pushDenied"),
		on: t("pushOn"),
		off: t("pushOff")
	};

	return (
		<section aria-labelledby="notify-push-title" className="space-y-2">
			<h4 id="notify-push-title" className="flex items-center gap-2 text-sm font-medium">
				<BellRingingIcon size={16} />
				{t("pushTitle")}
			</h4>
			<p role="status" className={`text-sm ${state === "on" ? "text-success" : "text-base-content/70"}`}>
				{state ? text[state] : t("pushChecking")}
			</p>
			{(state === "on" || state === "off") && (
				<button type="button" className={`btn btn-sm ${state === "off" ? "btn-primary" : ""}`} disabled={busy} onClick={() => void run(state === "on" ? disablePush : enablePush)}>
					{busy ? <span className="loading loading-xs loading-spinner" aria-hidden /> : state === "on" ? <BellSlashIcon size={16} /> : <BellRingingIcon size={16} />}
					{state === "on" ? t("pushDisable") : t("pushEnable")}
				</button>
			)}
			<p role="alert" className="text-sm text-error empty:hidden">
				{failure}
			</p>
			{devices > 0 && <p className="text-xs text-base-content/65">{t("pushDevices", devices)}</p>}
		</section>
	);
}

function DiscordWebhook({ settings }: { settings: NotifySettings }) {
	const update = useUpdateNotify();
	const [editing, setEditing] = useState(!settings.discord.set);
	const [value, setValue] = useState("");
	const [invalid, setInvalid] = useState(false);
	const [done, setDone] = useState<string | null>(null);
	const id = useId();
	const errorId = `${id}-error`;
	const helpId = `${id}-help`;

	async function save(e: React.FormEvent) {
		e.preventDefault();
		setDone(null);
		if (!isDiscordWebhook(value)) return setInvalid(true);
		setInvalid(false);
		try {
			await update.save({ discordWebhook: value.trim() });
			setValue("");
			setEditing(false);
			setDone(t("discordSaved"));
		} catch {
			// Shown below from update.error.
		}
	}

	async function remove() {
		setDone(null);
		try {
			await update.save({ discordWebhook: null });
			setEditing(true);
			setDone(t("discordRemoved"));
		} catch {
			// Shown below from update.error.
		}
	}

	return (
		<section aria-labelledby="notify-discord-title" className="max-w-xl space-y-2">
			<h4 id="notify-discord-title" className="flex items-center gap-2 text-sm font-medium">
				<DiscordLogoIcon size={16} />
				{t("discordTitle")}
			</h4>
			{settings.discord.set && (
				<div className="flex flex-wrap items-center gap-2 text-sm">
					<span className="min-w-0 truncate font-mono text-xs text-base-content/70">{t("discordSet", settings.discord.hint ?? "")}</span>
					{!editing && (
						<button type="button" className="btn btn-xs" onClick={() => setEditing(true)}>
							{t("discordReplace")}
						</button>
					)}
					<button type="button" className="btn btn-xs btn-ghost text-error" disabled={update.isPending} onClick={() => void remove()}>
						{t("discordRemove")}
					</button>
				</div>
			)}
			{editing && (
				<form className="space-y-2" onSubmit={e => void save(e)} noValidate>
					<label htmlFor={`${id}-url`} className="text-sm">
						{t("discordLabel")}
					</label>
					<div className="flex flex-wrap gap-2">
						<input
							id={`${id}-url`}
							type="url"
							inputMode="url"
							autoComplete="off"
							spellCheck={false}
							className={`input input-sm min-w-0 grow font-mono ${invalid ? "input-error" : ""}`}
							placeholder={t("discordPlaceholder")}
							value={value}
							aria-invalid={invalid || undefined}
							aria-describedby={`${invalid ? `${errorId} ` : ""}${helpId}`}
							onChange={e => {
								setValue(e.target.value);
								if (invalid && isDiscordWebhook(e.target.value)) setInvalid(false);
							}}
						/>
						<button type="submit" className="btn btn-sm" disabled={update.isPending || !value.trim()}>
							{t("discordSave")}
						</button>
					</div>
					<p id={errorId} role="alert" className="text-sm text-error empty:hidden">
						{invalid ? t("discordInvalid") : update.error ? t("saveFailed", reason(update.error)) : null}
					</p>
					<p id={helpId} className="text-xs text-base-content/65">
						{t("discordPrivacy")}
					</p>
				</form>
			)}
			<details className="text-sm">
				<summary className="cursor-pointer text-base-content/70">{t("discordHelpSummary")}</summary>
				<ol className="mt-2 list-decimal space-y-1 ps-5 text-base-content/70">
					{t("discordHelp").map(step => (
						<li key={step}>{step}</li>
					))}
				</ol>
			</details>
			<p role="status" className="text-sm text-success empty:hidden">
				{done}
			</p>
		</section>
	);
}

function TestButton() {
	const [busy, setBusy] = useState(false);
	const [lines, setLines] = useState<{ text: string; ok: boolean }[] | null>(null);
	const refresh = useRefreshNotify();

	async function test() {
		setBusy(true);
		setLines(null);
		try {
			const [{ results }, mine] = await Promise.all([sendTest(), currentSubscription().catch(() => null)]);
			setLines(results.length ? results.map(r => describe(r, mine?.endpoint)) : [{ text: t("testNone"), ok: false }]);
		} catch (err) {
			setLines([{ text: t("testFailed", t("test"), reason(err)), ok: false }]);
		} finally {
			setBusy(false);
			// Gone subscriptions and webhooks were removed by the server.
			void refresh();
		}
	}

	return (
		<div className="space-y-2">
			<button type="button" className="btn btn-sm" disabled={busy} onClick={() => void test()}>
				{busy ? <span className="loading loading-xs loading-spinner" aria-hidden /> : <PaperPlaneTiltIcon size={16} />}
				{t("test")}
			</button>
			<div role="status" className="text-sm">
				{busy && <p className="text-base-content/70">{t("testing")}</p>}
				{lines && (
					<ul className="space-y-1">
						{lines.map((l, i) => (
							<li key={i} className={l.ok ? "text-success" : "text-base-content/80"}>
								{l.text}
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}

function describe(r: TestResult, myEndpoint: string | undefined) {
	const channel = r.channel === "discord" ? "Discord" : t("testPush", r.service ?? "other", !!myEndpoint && r.endpoint === myEndpoint);
	if (r.ok) return { text: t("testOk", channel), ok: true };
	if (r.gone) return { text: t("testGone", channel), ok: false };
	return { text: t("testFailed", channel, r.error ?? (r.status ? `HTTP ${r.status}` : "network")), ok: false };
}
