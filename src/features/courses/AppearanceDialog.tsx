import { usePrefs } from "@/features/preferences/store";
import { ArrowCounterClockwiseIcon, EyeSlashIcon, PushPinIcon } from "@phosphor-icons/react";
import { tc } from "@/i18n/common";
import { useEffect, useId, useRef } from "react";
import { altName, COURSE_COLORS, COURSE_ICONS, CourseGlyph, defaultColor, defaultIcon, defaultTitle, readableOn, useCourseLook } from "./look";
import { t } from "./messages";
import type { ParsedCourse } from "./parse";

/** Per-course colour, icon, nickname, pin and hide — all stored locally. */
export function AppearanceDialog({ course, open, onClose }: { course: ParsedCourse; open: boolean; onClose: () => void }) {
	const ref = useRef<HTMLDialogElement>(null);
	const look = useCourseLook(course)!;
	const setCourse = usePrefs(s => s.setCourse);
	const raw = usePrefs(s => s.courses[course.id]);
	const patch = (p: Parameters<typeof setCourse>[1]) => setCourse(course.id, p);
	const id = useId();
	const alt = altName(course, look);
	const custom = !COURSE_COLORS.includes(look.color);

	useEffect(() => {
		const d = ref.current;
		if (!d) return;
		if (open && !d.open) d.showModal();
		if (!open && d.open) d.close();
	}, [open]);

	return (
		<dialog ref={ref} className="modal modal-bottom sm:modal-middle" onClose={onClose} aria-labelledby={`${id}-kind ${id}-title`}>
			<div className="modal-box max-w-md">
				<div className="mb-5 flex items-center gap-3">
					<CourseGlyph look={look} size="lg" />
					<div className="min-w-0">
						<span id={`${id}-kind`} className="sr-only">
							{t("appearance")}
						</span>
						<h2 id={`${id}-title`} className="truncate text-lg font-semibold" lang={look.titleLang}>
							{look.title}
						</h2>
						<p className="truncate text-sm text-base-content/65" lang={alt ? alt.lang : undefined}>
							{alt?.text ?? course.raw.shortname}
						</p>
					</div>
				</div>

				<fieldset className="fieldset">
					<legend className="fieldset-legend">
						<label htmlFor={`${id}-nick`}>{t("nickname")}</label>
					</legend>
					<input
						id={`${id}-nick`}
						className="input w-full"
						placeholder={defaultTitle(course)}
						value={raw?.nickname ?? ""}
						onChange={e => patch({ nickname: e.target.value })}
						aria-describedby={`${id}-nick-hint`}
						autoComplete="off"
					/>
					<p id={`${id}-nick-hint`} className="label whitespace-normal">
						{t("nicknameHint")}
					</p>
				</fieldset>

				<fieldset className="fieldset mt-2">
					<legend className="fieldset-legend">{t("color")}</legend>
					<div className="flex flex-wrap gap-2">
						{COURSE_COLORS.map((c, i) => (
							<button
								type="button"
								key={c}
								onClick={() => patch({ color: c })}
								className={`size-8 rounded-full transition ${look.color === c ? "scale-110 ring-2 ring-base-content ring-offset-2 ring-offset-base-100" : "hover:scale-110"}`}
								style={{ backgroundColor: c }}
								aria-label={t("colorName", i)}
								title={t("colorName", i)}
								aria-pressed={look.color === c}
							/>
						))}
						<label
							className={`relative size-8 cursor-pointer overflow-hidden rounded-full border hairline has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary ${custom ? "scale-110 ring-2 ring-base-content ring-offset-2 ring-offset-base-100" : ""}`}
							title={t("customColor")}
							style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }}
						>
							<input
								type="color"
								className="absolute inset-0 cursor-pointer opacity-0"
								value={look.color}
								onChange={e => patch({ color: e.target.value })}
								aria-label={custom ? `${t("customColor")} ${look.color}` : t("customColor")}
							/>
						</label>
					</div>
				</fieldset>

				<fieldset className="fieldset mt-2">
					<legend className="fieldset-legend">{t("icon")}</legend>
					<div className="grid grid-cols-8 gap-1.5">
						{Object.entries(COURSE_ICONS).map(([key, Icon]) => (
							<button
								type="button"
								key={key}
								onClick={() => patch({ icon: key })}
								className={`grid aspect-square place-items-center rounded-lg transition ${look.icon === key ? "" : "hover:bg-base-content/[0.06]"}`}
								style={look.icon === key ? { backgroundColor: look.color, color: readableOn(look.color) } : undefined}
								aria-label={t("iconName", key)}
								title={t("iconName", key)}
								aria-pressed={look.icon === key}
							>
								<Icon size={20} weight="duotone" />
							</button>
						))}
					</div>
				</fieldset>

				<div className="mt-4 flex flex-col gap-2">
					<label className="flex cursor-pointer items-center gap-3 text-sm">
						<PushPinIcon size={18} />
						<span className="grow">{t("pinToggle")}</span>
						<input type="checkbox" className="toggle toggle-sm" checked={look.pinned} onChange={e => patch({ pinned: e.target.checked })} />
					</label>
					<label className="flex cursor-pointer items-center gap-3 text-sm">
						<EyeSlashIcon size={18} />
						<span className="grow">{t("hideToggle")}</span>
						<input type="checkbox" className="toggle toggle-sm" checked={look.hidden} onChange={e => patch({ hidden: e.target.checked })} />
					</label>
				</div>

				<div className="modal-action">
					<button
						type="button"
						className="btn btn-ghost"
						onClick={() => patch({ color: undefined, icon: undefined, nickname: undefined })}
						disabled={look.color === defaultColor(course.id) && look.icon === defaultIcon(course) && !raw?.nickname}
					>
						<ArrowCounterClockwiseIcon size={16} />
						{t("reset")}
					</button>
					<button type="button" className="btn btn-neutral" onClick={onClose}>
						{t("done")}
					</button>
				</div>
			</div>
			<form method="dialog" className="modal-backdrop">
				<button tabIndex={-1}>{tc("close")}</button>
			</form>
		</dialog>
	);
}
