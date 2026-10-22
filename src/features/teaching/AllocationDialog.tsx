import { tc } from "@/i18n/common";
import { Lines } from "@/shared/ui/States";
import { CheckCircleIcon, UsersThreeIcon } from "@phosphor-icons/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { type AllocStudent, byStudentNumber, type SidRange, splitByRanges, splitEvenly, summarize } from "./allocation";
import { displayName, useGradableUsers } from "./api";
import { type Grader, useAllocations, useGraders, useSaveAllocations } from "./collab-api";
import { t } from "./collab-messages";

type Method = "even" | "ranges" | "manual";

const span = (first?: string, last?: string) => (first ? (first === last ? first : `${first}–${last}`) : "");

/** The course's students with 學號, as the allocation works on them. */
function useAllocStudents(courseId: number) {
	const gradable = useGradableUsers(courseId);
	const students = useMemo<AllocStudent[]>(
		() => (gradable.data ?? []).map(u => ({ id: u.id, sid: u.username || u.idnumber || "", name: displayName(u.fullname) })).sort(byStudentNumber),
		[gradable.data]
	);
	return { students, isPending: gradable.isPending, error: gradable.error };
}

/** TeachTab section: the current split and the button that edits it. */
export function AllocationSection({ courseId }: { courseId: number }) {
	const alloc = useAllocations(courseId);
	const { students } = useAllocStudents(courseId);
	const [open, setOpen] = useState(false);
	const map = alloc.data?.allocations ?? {};
	const graders = alloc.data?.graders ?? [];
	const { shares } = summarize(
		map,
		students,
		graders.map(g => g.id)
	);
	return (
		<div className="card-quiet p-4">
			<p className="mb-3 text-sm text-base-content/70">{t("allocIntro")}</p>
			{alloc.isPending ? (
				<Lines n={2} />
			) : alloc.error ? (
				<p className="text-sm text-error">{t("loadFailed", alloc.error.message)}</p>
			) : graders.length ? (
				<>
					<ul className="mb-1 space-y-0.5 text-sm">
						{graders.map(g => {
							const s = shares.find(x => x.grader === g.id);
							return <li key={g.id}>{t("allocLine", displayName(g.name), s?.count ?? 0, span(s?.first, s?.last))}</li>;
						})}
					</ul>
					{alloc.data?.updatedByName && <p className="text-xs text-base-content/65">{t("allocUpdated", displayName(alloc.data.updatedByName))}</p>}
				</>
			) : (
				<p className="text-sm text-base-content/65">{t("allocNone")}</p>
			)}
			<button type="button" className="btn btn-sm mt-3" onClick={() => setOpen(true)}>
				<UsersThreeIcon size={16} />
				{t("editAlloc")}
			</button>
			<AllocationDialog courseId={courseId} open={open} onClose={() => setOpen(false)} />
		</div>
	);
}

export function AllocationDialog({ courseId, open, onClose }: { courseId: number; open: boolean; onClose: () => void }) {
	const ref = useRef<HTMLDialogElement>(null);
	const titleId = useId();
	useEffect(() => {
		const d = ref.current;
		if (open && d && !d.open) d.showModal();
		if (!open && d?.open) d.close();
	}, [open]);
	return (
		<dialog ref={ref} className="modal modal-bottom sm:modal-middle" onClose={onClose} aria-labelledby={titleId}>
			<div className="modal-box max-w-3xl">
				<h2 id={titleId} className="mb-4 text-lg font-semibold">
					{t("allocHeading")}
				</h2>
				{open && <Editor courseId={courseId} onClose={onClose} />}
			</div>
			<form method="dialog" className="modal-backdrop">
				<button>{tc("close")}</button>
			</form>
		</dialog>
	);
}

function Editor({ courseId, onClose }: { courseId: number; onClose: () => void }) {
	const alloc = useAllocations(courseId);
	const graders = useGraders(courseId, true);
	const { students, isPending, error } = useAllocStudents(courseId);
	const save = useSaveAllocations(courseId);
	const uid = useId();
	const current = alloc.data?.allocations ?? {};
	const [picked, setPicked] = useState<number[] | null>(null);
	const [method, setMethod] = useState<Method>("even");
	const [ranges, setRanges] = useState<Record<number, { from: string; to: string }>>({});
	const [manual, setManual] = useState<Record<number, number | undefined>>({});
	const [done, setDone] = useState<string | null>(null);

	const list: Grader[] = graders.data ?? [];
	// Default: whoever has students now, otherwise everyone.
	const inUse = new Set(Object.values(current));
	const chosen = picked ?? (inUse.size ? list.filter(g => inUse.has(g.id)).map(g => g.id) : list.map(g => g.id));
	const ordered = list.filter(g => chosen.includes(g.id)).map(g => g.id);
	const name = (id: number) => displayName(list.find(g => g.id === id)?.name ?? alloc.data?.graders.find(g => g.id === id)?.name ?? String(id));

	const map = useMemo<Record<number, number>>(() => {
		if (method === "even") return splitEvenly(students, ordered);
		if (method === "ranges")
			return splitByRanges(
				students,
				ordered.map((g): SidRange => ({ grader: g, from: ranges[g]?.from ?? "", to: ranges[g]?.to ?? "" }))
			).map;
		return Object.fromEntries(Object.entries(manual).filter(([, g]) => g !== undefined && ordered.includes(g))) as Record<number, number>;
	}, [method, students, ordered.join(), ranges, manual]); // eslint-disable-line react-hooks/exhaustive-deps
	const { shares, unassigned } = summarize(map, students, ordered);

	// Switching method starts from what the previous one produced, so nothing is typed twice.
	function switchTo(next: Method) {
		if (next === "ranges") setRanges(Object.fromEntries(shares.map(s => [s.grader, { from: s.first ?? "", to: s.last ?? "" }])));
		if (next === "manual") setManual(Object.keys(map).length ? { ...map } : { ...current });
		setMethod(next);
	}

	async function apply(next: Record<number, number>) {
		setDone(null);
		await save.mutateAsync(next);
		setDone(Object.keys(next).length ? t("allocSaved") : t("allocCleared"));
	}

	if (isPending || graders.isPending || alloc.isPending) return <Lines n={5} />;
	const loadError = error ?? graders.error ?? alloc.error;
	if (loadError) return <p className="text-sm text-error">{t("loadFailed", loadError.message)}</p>;

	return (
		<div className="space-y-5 text-sm">
			<p role="status" className={done ? "flex items-center gap-1 text-success" : "sr-only"}>
				{done && (
					<>
						<CheckCircleIcon size={16} weight="fill" />
						{done}
					</>
				)}
			</p>
			<p role="alert" className={save.error ? "text-error" : "sr-only"}>
				{save.error && t("allocFailed", save.error.message)}
			</p>

			<fieldset>
				<legend className="mb-2 font-semibold">{t("pickGraders")}</legend>
				{!list.length && <p className="text-base-content/65">{t("noGraders")}</p>}
				<div className="flex flex-wrap gap-x-4 gap-y-2">
					{list.map(g => (
						<label key={g.id} className="flex items-center gap-2">
							<input
								type="checkbox"
								className="checkbox checkbox-sm"
								checked={chosen.includes(g.id)}
								onChange={e => setPicked(e.target.checked ? [...chosen, g.id] : chosen.filter(x => x !== g.id))}
							/>
							{displayName(g.name)}
						</label>
					))}
				</div>
			</fieldset>

			<fieldset>
				<legend className="mb-2 font-semibold">{t("method")}</legend>
				<div className="flex flex-wrap gap-x-4 gap-y-2">
					{(["even", "ranges", "manual"] as const).map(m => (
						<label key={m} className="flex items-center gap-2">
							<input type="radio" name={`${uid}-method`} className="radio radio-sm" checked={method === m} onChange={() => switchTo(m)} />
							{t(m === "even" ? "methodEven" : m === "ranges" ? "methodRanges" : "methodManual")}
						</label>
					))}
				</div>
				{method === "even" && <p className="mt-2 text-xs text-base-content/65">{t("evenHint")}</p>}
			</fieldset>

			{method === "ranges" && (
				<div className="space-y-2">
					<p className="text-xs text-base-content/65">{t("rangeHint")}</p>
					{ordered.map(g => (
						<fieldset key={g} className="flex flex-wrap items-center gap-2">
							<legend className="sr-only">{t("rangeFor", name(g))}</legend>
							<span className="w-28 truncate" aria-hidden>
								{name(g)}
							</span>
							{(["from", "to"] as const).map(k => (
								<label key={k} className="input input-sm w-44">
									<span className="text-xs text-base-content/65">{t(k === "from" ? "rangeFrom" : "rangeTo")}</span>
									<input
										inputMode="numeric"
										autoComplete="off"
										value={ranges[g]?.[k] ?? ""}
										onChange={e => setRanges(r => ({ ...r, [g]: { from: r[g]?.from ?? "", to: r[g]?.to ?? "", [k]: e.target.value } }))}
									/>
								</label>
							))}
						</fieldset>
					))}
				</div>
			)}

			{method === "manual" ? (
				<div className="max-h-80 overflow-y-auto rounded-box border hairline">
					<table className="table table-sm">
						<thead>
							<tr>
								<th scope="col">{t("colStudent")}</th>
								<th scope="col">{t("colGrader")}</th>
							</tr>
						</thead>
						<tbody>
							{students.map(s => (
								<tr key={s.id}>
									<td>
										<span className="tabular-nums">{s.sid}</span> {s.name}
									</td>
									<td>
										<select
											className="select select-xs w-40"
											aria-label={t("graderFor", s.name)}
											value={manual[s.id] ?? ""}
											onChange={e => setManual(m => ({ ...m, [s.id]: e.target.value ? Number(e.target.value) : undefined }))}
										>
											<option value="">{t("nobody")}</option>
											{ordered.map(g => (
												<option key={g} value={g}>
													{name(g)}
												</option>
											))}
										</select>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : null}

			<section aria-labelledby={`${uid}-preview`}>
				<h3 id={`${uid}-preview`} className="mb-2 font-semibold">
					{t("previewHeading")}
				</h3>
				<table className="table table-sm">
					<thead>
						<tr>
							<th scope="col">{t("colGrader")}</th>
							<th scope="col" className="text-right">
								{t("colCount")}
							</th>
							<th scope="col">{t("colRange")}</th>
						</tr>
					</thead>
					<tbody>
						{shares.map(s => (
							<tr key={s.grader}>
								<td>{name(s.grader)}</td>
								<td className="text-right tabular-nums">{s.count}</td>
								<td className="tabular-nums">{method === "manual" ? "" : span(s.first, s.last)}</td>
							</tr>
						))}
					</tbody>
				</table>
				{unassigned > 0 && <p className="mt-1 text-xs text-warning">{t("unassigned", unassigned)}</p>}
			</section>

			<div className="modal-action flex-wrap">
				{Object.keys(current).length > 0 && (
					<button type="button" className="btn btn-ghost mr-auto" disabled={save.isPending} onClick={() => void apply({}).catch(() => {})}>
						{t("clearAlloc")}
					</button>
				)}
				<button type="button" className="btn btn-ghost" onClick={onClose}>
					{done ? tc("close") : tc("cancel")}
				</button>
				<button type="button" className="btn btn-primary" disabled={save.isPending || !Object.keys(map).length} onClick={() => void apply(map).catch(() => {})}>
					{save.isPending && <span className="loading loading-spinner loading-sm" aria-hidden="true" />}
					{t("saveAlloc")}
				</button>
			</div>
		</div>
	);
}
