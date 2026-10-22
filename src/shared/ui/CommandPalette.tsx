import { visibleNav } from "@/app/nav";
import { useCourseIndex } from "@/features/courses/api";
import { CourseGlyph, resolveLook } from "@/features/courses/look";
import { usePrefs } from "@/features/preferences/store";
import { useNavigate } from "@tanstack/react-router";
import { KeyReturnIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function useCommandPalette() {
	const [isOpen, setOpen] = useState(false);
	const open = useCallback(() => setOpen(true), []);
	const close = useCallback(() => setOpen(false), []);
	const toggle = useCallback(() => setOpen(o => !o), []);
	return { isOpen, open, close, toggle };
}

interface Item {
	key: string;
	label: string;
	hint?: string;
	icon: React.ReactNode;
	go: () => void;
	hay: string;
}

export function CommandPalette({ isOpen, close }: { isOpen: boolean; close: () => void }) {
	const ref = useRef<HTMLDialogElement>(null);
	const input = useRef<HTMLInputElement>(null);
	const [q, setQ] = useState("");
	const [sel, setSel] = useState(0);
	const navigate = useNavigate();
	const { list, current } = useCourseIndex();
	const prefs = usePrefs(s => s.courses);

	useEffect(() => {
		const d = ref.current;
		if (!d) return;
		if (isOpen && !d.open) {
			d.showModal();
			setQ("");
			setSel(0);
			requestAnimationFrame(() => input.current?.focus());
		} else if (!isOpen && d.open) d.close();
	}, [isOpen]);

	const items = useMemo<Item[]>(() => {
		const courses = [...list]
			.sort((a, b) => Number(b.semester?.code === current?.code) - Number(a.semester?.code === current?.code))
			.map(c => {
				const look = resolveLook(c, prefs[c.id]);
				return {
					key: `c${c.id}`,
					label: look.title,
					hint: c.semester?.shortLabel ?? "",
					icon: <CourseGlyph look={look} size="sm" />,
					go: () => navigate({ to: "/courses/$courseId", params: { courseId: String(c.id) } }),
					hay: `${look.title} ${c.name} ${c.nameEn ?? ""} ${c.code ?? ""} ${c.raw.shortname}`.toLowerCase()
				};
			});
		const pages = visibleNav().map(n => ({ key: n.to, label: n.label, hint: "頁面", icon: <n.icon size={16} className="mx-1" />, go: () => navigate({ to: n.to }), hay: n.label }));
		return [...pages, ...courses];
	}, [list, current, prefs, navigate]);

	const filtered = useMemo(() => {
		const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
		const hits = terms.length ? items.filter(i => terms.every(t => i.hay.includes(t))) : items.filter(i => !i.key.startsWith("c") || i.hint === current?.shortLabel);
		return hits.slice(0, 12);
	}, [items, q, current]);

	function run(i: Item | undefined) {
		if (!i) return;
		close();
		i.go();
	}

	return (
		<dialog ref={ref} className="modal modal-top sm:modal-middle" onClose={close}>
			<div className="modal-box mx-auto mt-4 max-w-lg p-0 sm:mt-0">
				<label className="flex items-center gap-3 border-b hairline px-4 py-3.5">
					<MagnifyingGlassIcon size={18} className="opacity-50" />
					<input
						ref={input}
						className="grow bg-transparent text-base outline-none"
						placeholder="搜尋課程、頁面…（中文、英文、課號都可以）"
						value={q}
						onChange={e => {
							setQ(e.target.value);
							setSel(0);
						}}
						onKeyDown={e => {
							if (e.key === "ArrowDown") (e.preventDefault(), setSel(s => Math.min(s + 1, filtered.length - 1)));
							if (e.key === "ArrowUp") (e.preventDefault(), setSel(s => Math.max(s - 1, 0)));
							if (e.key === "Enter") run(filtered[sel]);
						}}
					/>
					<kbd className="kbd kbd-xs">esc</kbd>
				</label>
				<ul className="max-h-[60vh] overflow-y-auto p-2">
					{filtered.map((i, idx) => (
						<li key={i.key}>
							<button
								onMouseMove={() => setSel(idx)}
								onClick={() => run(i)}
								className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${idx === sel ? "bg-base-content/[0.07]" : ""}`}
							>
								{i.icon}
								<span className="grow truncate">{i.label}</span>
								<span className="text-xs text-base-content/45">{i.hint}</span>
								{idx === sel && <KeyReturnIcon size={16} className="opacity-40" />}
							</button>
						</li>
					))}
					{!filtered.length && <li className="px-3 py-6 text-center text-sm text-base-content/50">找不到「{q}」</li>}
				</ul>
			</div>
			<form method="dialog" className="modal-backdrop">
				<button>close</button>
			</form>
		</dialog>
	);
}
