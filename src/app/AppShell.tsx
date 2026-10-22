import { useCourseIndex, useSiteInfo } from "@/features/courses/api";
import { useTimetable } from "@/features/timetable/schedule";
import { CourseGlyph, resolveLook } from "@/features/courses/look";
import { usePrefs } from "@/features/preferences/store";
import { classMoment, useNow } from "@/features/timetable/now";
import { CommandPalette, useCommandPalette } from "@/shared/ui/CommandPalette";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { focusSearch, MOD_LABEL, moveListFocus, useHotkeys } from "@/shared/keyboard/hotkeys";
import { ShortcutsDialog } from "@/shared/keyboard/ShortcutsDialog";
import { CalendarDotsIcon, EnvelopeSimpleIcon, KeyboardIcon, MagnifyingGlassIcon, TableIcon } from "@phosphor-icons/react";
import { useMailUnread } from "@/features/mail/api";
import { motion, MotionConfig } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { NAV } from "./nav";
import { Logo } from "@/shared/ui/Logo";
import { Avatar } from "@/shared/ui/Avatar";
import { FilePreviewHost } from "@/features/course/FilePreview";
import { LeaveToE3Host } from "@/shared/ui/LeaveToE3";

const DOCK = ["/", "/tasks", "/courses", "/announcements", "/settings"] as const;

export function AppShell() {
	const motionPref = usePrefs(s => s.motion);
	const palette = useCommandPalette();
	const [helpOpen, setHelpOpen] = useState(false);
	const location = useLocation();
	const navigate = useNavigate();
	const main = useRef<HTMLElement>(null);
	const firstRender = useRef(true);

	// After every navigation, put keyboard focus at the top of the new page.
	useEffect(() => {
		if (firstRender.current) {
			firstRender.current = false;
			return;
		}
		main.current?.focus({ preventScroll: true });
	}, [location.pathname]);

	useHotkeys([
		{ keys: "mod+k", run: palette.toggle, inInput: true },
		{ keys: "/", run: palette.open },
		{ keys: ["mod+/", "?"], run: () => setHelpOpen(o => !o), inInput: true },
		...NAV.map((n, i) => ({ keys: String(i + 1), run: () => navigate({ to: n.to }) })),
		{ keys: "j", run: () => moveListFocus(1) },
		{ keys: "k", run: () => moveListFocus(-1) },
		{ keys: "f", run: focusSearch },
		{ keys: "escape", run: e => (e.target as HTMLElement).blur(), inInput: true }
	]);

	// Three-pane pages use the full width and scroll each pane on their own.
	const wide = location.pathname.startsWith("/mail");

	return (
		<MotionConfig reducedMotion={motionPref === "reduced" ? "always" : "user"} transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.8 }}>
			<a href="#main" onClick={e => (e.preventDefault(), main.current?.focus())} className="btn btn-sm fixed top-2 left-2 z-[60] -translate-y-20 focus:translate-y-0">
				跳到主要內容
			</a>
			<div id="app" className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
				<Sidebar onSearch={palette.open} onHelp={() => setHelpOpen(true)} />
				<div className="min-w-0">
					<MobileTopBar onSearch={palette.open} />
					<motion.main
						ref={main}
						id="main"
						tabIndex={-1}
						key={location.pathname}
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						className={`mx-auto w-full px-4 pt-4 pb-28 outline-none sm:px-6 lg:pt-10 ${wide ? "max-w-[112rem] lg:px-6 lg:pb-6 2xl:px-10" : "max-w-6xl lg:px-10 lg:pb-16"}`}
					>
						<Outlet />
					</motion.main>
				</div>
				<MobileDock />
			</div>
			<CommandPalette {...palette} />
			<ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
			<FilePreviewHost />
			<LeaveToE3Host />
		</MotionConfig>
	);
}

function NavLink({ to, children, layoutGroup, hint, badge }: { to: string; children: ReactNode; layoutGroup: string; hint?: string; badge?: number }) {
	const { pathname } = useLocation();
	const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
	return (
		<Link
			to={to}
			aria-current={active ? "page" : undefined}
			className={`relative flex items-center gap-3 rounded-xl px-3 py-2 text-[0.94rem] transition-colors ${active ? "font-medium text-base-content" : "text-base-content/65 hover:text-base-content"}`}
		>
			{active && <motion.span layoutId={layoutGroup} className="absolute inset-0 -z-0 rounded-xl bg-base-content/[0.07]" />}
			<span className="relative z-10 flex items-center gap-3">{children}</span>
			{!!badge && <span className="badge badge-sm badge-primary relative z-10 ml-auto">{badge}</span>}
			{hint && <kbd className={`kbd kbd-xs relative z-10 border-0 bg-transparent text-base-content/30 ${badge ? "" : "ml-auto"}`}>{hint}</kbd>}
		</Link>
	);
}

function Sidebar({ onSearch, onHelp }: { onSearch: () => void; onHelp: () => void }) {
	const { data: mailUnread } = useMailUnread();
	const { currentCourses, current } = useCourseIndex();
	const prefs = usePrefs(s => s.courses);
	const timetable = useTimetable();
	const now = useNow();
	const moment = classMoment(timetable, now);
	const { data: me } = useSiteInfo();
	const { pathname } = useLocation();

	const visible = currentCourses
		.map(c => ({ c, look: resolveLook(c, prefs[c.id]) }))
		.filter(x => !x.look.hidden)
		.sort((a, b) => Number(b.look.pinned) - Number(a.look.pinned));

	return (
		<aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r hairline bg-base-100/60 px-4 py-6 backdrop-blur-xl lg:flex">
			<Link to="/" className="flex items-center gap-2.5 px-2">
				<Logo size={34} />
				<span className="text-lg font-semibold tracking-tight">EM3</span>
			</Link>

			<button onClick={onSearch} className="flex items-center gap-2 rounded-xl border hairline bg-base-100 px-3 py-2 text-sm text-base-content/55 transition hover:text-base-content">
				<MagnifyingGlassIcon size={16} />
				<span className="grow text-left">跳到課程…</span>
				<kbd className="kbd kbd-xs">{MOD_LABEL}K</kbd>
			</button>

			<nav className="flex flex-col gap-0.5" aria-label="主要頁面">
				{NAV.map((n, i) => (
					<NavLink key={n.to} to={n.to} layoutGroup="side-nav" hint={String(i + 1)} badge={n.to === "/mail" ? mailUnread : undefined}>
						<n.icon size={19} weight={pathname === n.to || (n.to !== "/" && pathname.startsWith(n.to)) ? "fill" : "regular"} />
						{n.label}
					</NavLink>
				))}
			</nav>

			<div className="flex min-h-0 flex-1 flex-col">
				<p className="mb-2 px-3 text-xs font-medium tracking-wide text-base-content/45">{current ? `${current.label}` : "本學期"}</p>
				<div className="-mx-1 flex-1 overflow-y-auto px-1 py-0.5 scrollbar-none">
					{visible.map(({ c, look }) => {
						const live = moment.now?.courseId === c.id;
						const active = pathname.startsWith(`/courses/${c.id}`);
						return (
							<Link
								key={c.id}
								to="/courses/$courseId"
								params={{ courseId: String(c.id) }}
								className={`group relative flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm transition-colors ${active ? "bg-base-content/[0.07] text-base-content" : "text-base-content/75 hover:bg-base-content/[0.04]"}`}
							>
								<CourseGlyph look={look} size="sm" />
								<span className="truncate">{look.title}</span>
								{live && (
									<span className="ml-auto flex items-center gap-1 text-[0.7rem] font-medium" style={{ color: look.color }}>
										<span className="status status-sm animate-pulse" style={{ backgroundColor: look.color }} />
										上課中
									</span>
								)}
							</Link>
						);
					})}
				</div>
			</div>

			<button onClick={onHelp} className="-mb-3 flex items-center gap-3 rounded-xl px-3 py-1.5 text-sm text-base-content/50 hover:text-base-content">
				<KeyboardIcon size={18} />
				鍵盤快捷鍵
				<span className="ml-auto flex gap-0.5">
					<kbd className="kbd kbd-xs">{MOD_LABEL}</kbd>
					<kbd className="kbd kbd-xs">/</kbd>
				</span>
			</button>

			{me && (
				<Link to="/settings" className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-base-content/[0.04]">
					<Avatar me={me} size={32} />
					<div className="min-w-0 text-sm leading-tight">
						<p className="truncate font-medium">{me.firstname}</p>
						<p className="truncate text-xs text-base-content/50">{me.lastname}</p>
					</div>
				</Link>
			)}
		</aside>
	);
}

function MobileMailButton() {
	const { data } = useMailUnread();
	return (
		<Link to="/mail" className="btn btn-ghost btn-sm btn-circle indicator" aria-label={data ? `信件，${data} 封未讀` : "信件"}>
			{!!data && <span className="indicator-item badge badge-xs badge-primary">{data}</span>}
			<EnvelopeSimpleIcon size={19} />
		</Link>
	);
}

function MobileTopBar({ onSearch }: { onSearch: () => void }) {
	return (
		<header className="surface sticky top-0 z-30 flex items-center gap-3 border-x-0 border-t-0 px-4 py-2.5 lg:hidden" style={{ paddingTop: "max(0.625rem, env(safe-area-inset-top))" }}>
			<Link to="/" className="flex items-center gap-2">
				<Logo size={28} />
				<span className="font-semibold tracking-tight">EM3</span>
			</Link>
			<div className="grow" />
			<MobileMailButton />
			<Link to="/calendar" className="btn btn-ghost btn-sm btn-circle" aria-label="行事曆">
				<CalendarDotsIcon size={19} />
			</Link>
			<Link to="/timetable" className="btn btn-ghost btn-sm btn-circle" aria-label="課表">
				<TableIcon size={19} />
			</Link>
			<button className="btn btn-ghost btn-sm btn-circle" onClick={onSearch} aria-label="搜尋課程">
				<MagnifyingGlassIcon size={19} />
			</button>
		</header>
	);
}

function MobileDock() {
	const { pathname } = useLocation();
	return (
		<nav className="dock dock-md surface z-40 border-x-0 border-b-0 lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
			{DOCK.map(to => {
				const n = NAV.find(x => x.to === to)!;
				const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
				return (
					<Link key={to} to={to} className={active ? "dock-active text-primary" : "text-base-content/60"}>
						<motion.span whileTap={{ scale: 0.85 }}>
							<n.icon size={23} weight={active ? "fill" : "regular"} />
						</motion.span>
						<span className="dock-label">{n.label}</span>
					</Link>
				);
			})}
		</nav>
	);
}
