import { langTag } from "@/i18n";
import { tc } from "@/i18n/common";
import { Ago } from "@/shared/ui/Time";
import { CalendarCheckIcon, CheckCircleIcon, ClockCountdownIcon, TrashIcon, WarningIcon } from "@phosphor-icons/react";
import { useId, useState } from "react";
import { displayName } from "./api";
import { type AssignCollab, isHolding, useCollabActions } from "./collab-api";
import { t } from "./collab-messages";
import { fromTaipei, toTaipei } from "./collab-time";
import { useConfirm } from "./ConfirmDialog";

/** Same as MAX_ATTEMPTS in worker/grading/release.ts. */
const MAX_ATTEMPTS = 3;

/** "10月24日 週五 20:00" in Taipei time, whatever the device's zone. */
export const taipeiTime = (ms: number) =>
	new Intl.DateTimeFormat(langTag(), { timeZone: "Asia/Taipei", month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ms);

/** Tomorrow 20:00 Taipei: when the TAs in the interviews release grades. */
function defaultTime() {
	const { date } = toTaipei(Date.now() + 86400_000);
	return { date, time: "20:00" };
}

interface Props {
	courseId: number;
	assignId: number;
	data: AssignCollab | undefined;
	/** Moodle user id → display name, for the held-grade list. */
	names: Map<number, string>;
}

/** Scheduled release for one assignment (server version only). */
export function ReleasePanel({ courseId, assignId, data, names }: Props) {
	const rel = data?.release ?? null;
	const drafts = data?.drafts ?? [];
	const act = useCollabActions(courseId, assignId);
	const [ask, confirmDialog] = useConfirm();
	const [editing, setEditing] = useState(false);
	const initial = rel && rel.releaseAt > Date.now() ? toTaipei(rel.releaseAt) : defaultTime();
	const [date, setDate] = useState(initial.date);
	const [time, setTime] = useState(initial.time);
	const [note, setNote] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const uid = useId();
	const holding = isHolding(rel);
	const when = fromTaipei(date, time);
	const past = when !== null && when < Date.now();

	/** Runs an action and announces the outcome; `fn` may return a more specific success message. */
	async function run(fn: () => Promise<unknown>, ok: string) {
		setError(null);
		setNote(null);
		try {
			const msg = await fn();
			setNote(typeof msg === "string" ? msg : ok);
		} catch (e) {
			setError(t("actionFailed", e instanceof Error ? e.message : String(e)));
		}
	}

	const schedule = () =>
		when !== null &&
		!past &&
		run(
			async () => {
				await act.schedule.mutateAsync(when);
				setEditing(false);
			},
			t("releaseSet", taipeiTime(when))
		);

	const writeNow = async () => {
		if ((await ask({ title: t("writeNow"), body: t("confirmWriteNow", drafts.length), confirm: t("writeNow") })) !== "ok") return;
		await run(async () => {
			const r = await act.writeNow.mutateAsync();
			return t("writtenN", r.written);
		}, "");
	};

	const discardAll = async () => {
		if ((await ask({ title: t("discardAll"), body: t("confirmDiscardAll", drafts.length), confirm: t("discardAll"), danger: true })) !== "ok") return;
		await run(() => act.discardAll.mutateAsync(), t("discarded"));
	};

	const busy = act.schedule.isPending || act.cancel.isPending || act.writeNow.isPending || act.discardAll.isPending;
	// Off and nothing held: one line, so the student list stays near the top.
	const collapsed = !holding && !drafts.length && !editing;
	const showForm = (!holding || editing) && !collapsed;

	return (
		<section className="card-quiet mb-5 p-4" aria-labelledby={`${uid}-h`}>
			<h2 id={`${uid}-h`} className="flex items-center gap-2 font-semibold">
				<ClockCountdownIcon size={18} weight="duotone" className="text-primary" />
				{t("releaseHeading")}
			</h2>

			{rel?.status === "running" ? (
				<p className="mt-2 flex items-center gap-2 text-sm">
					<span className="loading loading-spinner loading-xs" aria-hidden="true" />
					{t("running")}
				</p>
			) : holding ? (
				<div className="mt-2 space-y-1 text-sm">
					<p className="flex items-center gap-1.5 font-medium">
						<CalendarCheckIcon size={16} className="text-success" />
						{t("scheduledFor", taipeiTime(rel!.releaseAt), drafts.length)}
					</p>
					<p className="text-xs text-base-content/65">{t("writtenBy", displayName(rel!.ownerName))}</p>
					{rel!.status === "failed" && (
						<div role="alert" className="alert alert-soft alert-error mt-2 text-sm">
							<WarningIcon size={18} />
							<span>
								{t("failed", rel!.error ?? "")} {rel!.attempts < MAX_ATTEMPTS ? t("willRetry", MAX_ATTEMPTS - rel!.attempts) : t("noRetry")}
							</span>
						</div>
					)}
				</div>
			) : (
				<div className="mt-2 space-y-2 text-sm">
					{rel?.status === "released" && rel.releasedAt && !drafts.length && (
						<p className="flex items-center gap-1.5 text-success">
							<CheckCircleIcon size={16} weight="fill" />
							{t("released", taipeiTime(rel.releasedAt))}
						</p>
					)}
					{drafts.length > 0 && <p className="font-medium text-warning">{t("cancelled", drafts.length)}</p>}
					{collapsed ? (
						<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
							<p className="text-base-content/70">{t("releaseShort")}</p>
							<button type="button" className="btn btn-sm" aria-expanded="false" onClick={() => setEditing(true)}>
								{t("setUp")}
							</button>
						</div>
					) : (
						<>
							<p className="text-base-content/70">{t("releaseIntro")}</p>
							<ul className="list-disc space-y-0.5 pl-5 text-xs text-base-content/65">
								{t("releaseNotes").map(n => (
									<li key={n}>{n}</li>
								))}
							</ul>
						</>
					)}
				</div>
			)}

			{showForm && rel?.status !== "running" && (
				<div className="mt-3 flex flex-wrap items-end gap-2">
					<label className="flex flex-col gap-1 text-xs text-base-content/65">
						{t("releaseDate")}
						<input type="date" className="input input-sm" value={date} onChange={e => setDate(e.target.value)} aria-invalid={past || undefined} aria-describedby={past ? `${uid}-past` : undefined} />
					</label>
					<label className="flex flex-col gap-1 text-xs text-base-content/65">
						{t("releaseTime")}
						<input
							type="time"
							step={900}
							className="input input-sm"
							value={time}
							onChange={e => setTime(e.target.value)}
							aria-invalid={past || undefined}
							aria-describedby={past ? `${uid}-past` : undefined}
						/>
					</label>
					<button type="button" className="btn btn-sm btn-primary" disabled={busy || when === null || past} onClick={() => void schedule()}>
						{holding ? t("saveTime") : drafts.length ? t("scheduleAgain") : t("turnOn")}
					</button>
					{editing && (
						<button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(false)}>
							{tc("cancel")}
						</button>
					)}
					<p id={`${uid}-past`} className={past ? "w-full text-xs text-error" : "sr-only"}>
						{past ? t("pastTime") : ""}
					</p>
				</div>
			)}

			{rel?.status !== "running" && (holding || drafts.length > 0) && (
				<div className="mt-3 flex flex-wrap gap-2">
					{holding && !editing && (
						<button
							type="button"
							className="btn btn-sm"
							disabled={busy}
							onClick={() => {
								const at = toTaipei(rel!.releaseAt);
								setDate(at.date);
								setTime(at.time);
								setEditing(true);
							}}
						>
							{t("reschedule")}
						</button>
					)}
					{drafts.length > 0 && (
						<button type="button" className="btn btn-sm" disabled={busy} onClick={() => void writeNow()}>
							{act.writeNow.isPending && <span className="loading loading-spinner loading-xs" aria-hidden="true" />}
							{t("writeNow")}
						</button>
					)}
					{holding && (
						<button type="button" className="btn btn-sm btn-ghost" disabled={busy} title={t("cancelHint")} onClick={() => void run(() => act.cancel.mutateAsync(), t("releaseCancelled"))}>
							{t("cancelRelease")}
						</button>
					)}
					{!holding && drafts.length > 0 && (
						<button type="button" className="btn btn-sm btn-ghost text-error" disabled={busy} onClick={() => void discardAll()}>
							{t("discardAll")}
						</button>
					)}
				</div>
			)}
			{holding && <p className="mt-2 text-xs text-base-content/65">{t("cancelHint")}</p>}

			<p role="status" className={note ? "mt-2 flex items-center gap-1 text-xs text-success" : "sr-only"}>
				{note}
			</p>
			<p role="alert" className={error ? "mt-2 text-xs text-error" : "sr-only"}>
				{error}
			</p>

			{drafts.length > 0 && (
				<details className="mt-3">
					<summary className="cursor-pointer text-sm font-medium">{t("heldHeading", drafts.length)}</summary>
					<div className="mt-2 max-h-72 overflow-y-auto">
						<table className="table table-sm">
							<thead>
								<tr>
									<th scope="col">{t("colStudent")}</th>
									<th scope="col" className="text-right">
										{t("colGrade")}
									</th>
									<th scope="col">{t("colBy")}</th>
									<th scope="col">{t("colUpdated")}</th>
									<td />
								</tr>
							</thead>
							<tbody>
								{drafts.map(d => {
									const who = names.get(d.student) ?? String(d.student);
									return (
										<tr key={d.student}>
											<td>{who}</td>
											<td className="text-right tabular-nums">{d.grade ?? "–"}</td>
											<td>{displayName(d.graderName)}</td>
											<td className="text-xs text-base-content/65">
												<Ago ts={Math.floor(d.updatedAt / 1000)} />
											</td>
											<td>
												<button
													type="button"
													className="btn btn-ghost btn-xs btn-square"
													aria-label={t("discardOne", who)}
													disabled={act.discard.isPending}
													onClick={() => act.discard.mutate(d.student)}
												>
													<TrashIcon size={13} />
												</button>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</details>
			)}
			{confirmDialog}
		</section>
	);
}
