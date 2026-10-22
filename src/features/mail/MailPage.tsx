import { cleanAuthor } from "@/features/announcements/api";
import { FileIcon } from "@/features/course/FileIcon";
import { openFile } from "@/features/course/FilePreview";
import { useCourseIndex } from "@/features/courses/api";
import { CourseGlyph, resolveLook } from "@/features/courses/look";
import { usePrefs } from "@/features/preferences/store";
import { cleanHtml, fileExt, humanSize } from "@/lib/moodle/files";
import { fullDateTime } from "@/lib/time/relative";
import { useHotkeys } from "@/shared/keyboard/hotkeys";
import { Empty, ErrorNote, Lines } from "@/shared/ui/States";
import { Ago } from "@/shared/ui/Time";
import {
	ArrowBendUpLeftIcon,
	ArrowLeftIcon,
	CaretLeftIcon,
	CaretRightIcon,
	EnvelopeOpenIcon,
	EnvelopeSimpleIcon,
	FileTextIcon,
	MagnifyingGlassIcon,
	PaperclipIcon,
	PaperPlaneTiltIcon,
	PencilSimpleLineIcon,
	StarIcon,
	TrashIcon,
	TrayIcon
} from "@phosphor-icons/react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { type MailFolder, type MailSearch, type MailSummary, mailE3Url, mailSupported, PAGE_SIZE, useMailIndex, useMailMenu, useMailMessage, useSetUnread } from "./api";

const FOLDERS: { key: Exclude<MailFolder, "course">; label: string; icon: typeof TrayIcon }[] = [
	{ key: "inbox", label: "收件匣", icon: TrayIcon },
	{ key: "starred", label: "星號", icon: StarIcon },
	{ key: "sent", label: "寄件備份", icon: PaperPlaneTiltIcon },
	{ key: "drafts", label: "草稿", icon: FileTextIcon },
	{ key: "trash", label: "垃圾桶", icon: TrashIcon }
];

export function MailPage() {
	if (!mailSupported()) return <Empty icon={<EnvelopeSimpleIcon size={40} weight="duotone" />} title="這所學校沒有站內信" />;
	return <MailInbox />;
}

function MailInbox() {
	const search = useSearch({ from: "/app/mail" });
	const folder: MailFolder = search.course ? "course" : (search.folder ?? "inbox");
	const itemid = search.course ?? 0;
	const page = search.page ?? 0;
	const navigate = useNavigate();
	const set = (patch: Partial<MailSearch>, replace = false) => navigate({ to: "/mail", search: prev => ({ ...prev, ...patch }), replace });
	const [draft, setDraft] = useState(search.q ?? "");
	useEffect(() => setDraft(search.q ?? ""), [search.q]);

	const menu = useMailMenu();
	const index = useMailIndex(folder, itemid, search.q ?? "", page);
	const messages = index.data?.messages ?? [];
	const total = index.data?.totalcount ?? messages.length;
	const openId = search.m;

	const move = (dir: 1 | -1) => {
		const i = messages.findIndex(m => m.id === openId);
		const next = messages[i < 0 ? 0 : Math.min(messages.length - 1, Math.max(0, i + dir))];
		if (next) set({ m: next.id }, true);
	};
	useHotkeys([
		{ keys: "j", run: () => move(1) },
		{ keys: "k", run: () => move(-1) },
		{ keys: "escape", run: () => set({ m: undefined }) }
	]);

	const courseTitle = search.course ? menu.data?.courses.find(c => c.id === search.course)?.fullname : undefined;

	return (
		<div>
			<header className="mb-6 flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">信件</h1>
					<p className="mt-1 text-sm text-base-content/55">站內信。打開信會在學校網站上標為已讀；要寫信或回覆時會開學校網站。</p>
				</div>
				<a href={mailE3Url()} target="_blank" rel="noreferrer" className="btn btn-sm">
					<PencilSimpleLineIcon size={16} />
					在網站寫信
				</a>
			</header>

			<div className="grid grid-cols-1 gap-6 lg:h-[calc(100dvh-11.5rem)] lg:min-h-[28rem] lg:grid-cols-[11rem_17rem_minmax(0,1fr)] lg:gap-4 xl:grid-cols-[13rem_24rem_minmax(0,1fr)] 2xl:grid-cols-[14rem_28rem_minmax(0,1fr)] 2xl:gap-6">
				<nav aria-label="信件資料夾" className={`space-y-4 lg:-mx-1 lg:overflow-y-auto lg:px-1 ${openId ? "hidden lg:block" : ""}`}>
					<ul className="flex gap-1 overflow-x-auto scrollbar-none lg:flex-col">
						{FOLDERS.map(f => {
							const active = folder === f.key;
							const count = f.key === "inbox" ? menu.data?.unread : f.key === "drafts" ? menu.data?.drafts : 0;
							return (
								<li key={f.key} className="shrink-0">
									<button
										onClick={() => navigate({ to: "/mail", search: { folder: f.key } })}
										className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm ${active ? "bg-base-content/[0.07] font-medium" : "text-base-content/65 hover:text-base-content"}`}
									>
										<f.icon size={17} weight={active ? "fill" : "regular"} />
										{f.label}
										{!!count && <span className={`ml-auto text-xs ${f.key === "inbox" ? "badge badge-sm badge-primary" : "text-base-content/40"}`}>{count}</span>}
									</button>
								</li>
							);
						})}
					</ul>
					<CourseFolders menu={menu.data?.courses ?? []} current={search.course} onPick={id => navigate({ to: "/mail", search: { course: id } })} />
				</nav>

				<section className={`min-w-0 lg:flex lg:min-h-0 lg:flex-col ${openId ? "hidden lg:flex" : ""}`}>
					<form
						className="shrink-0"
						onSubmit={e => {
							e.preventDefault();
							set({ q: draft.trim() || undefined, page: undefined, m: undefined });
						}}
					>
						<label className="input input-sm mb-3 w-full">
							<MagnifyingGlassIcon size={15} className="opacity-50" />
							<input data-search type="search" placeholder={`搜尋${courseTitle ? `「${courseTitle}」的` : ""}信件內容`} value={draft} onChange={e => setDraft(e.target.value)} />
						</label>
					</form>
					{index.error ? (
						<ErrorNote error={index.error} retry={index.refetch} />
					) : index.isPending ? (
						<Lines n={6} />
					) : !messages.length ? (
						<Empty icon={<EnvelopeSimpleIcon size={40} weight="duotone" />} title={search.q ? `找不到「${search.q}」` : "這裡沒有信"} />
					) : (
						<div className="card-quiet flex min-h-0 flex-col overflow-hidden">
							<ul className="divide-y divide-base-content/[0.06] overflow-y-auto overscroll-contain">
								{messages.map(m => (
									<li key={m.id}>
										<MailRow m={m} active={m.id === openId} folder={folder} onOpen={() => set({ m: m.id })} />
									</li>
								))}
							</ul>
							{!search.q && total > PAGE_SIZE && (
								<div className="flex shrink-0 items-center justify-between border-t hairline px-4 py-1.5 text-sm text-base-content/55">
									<span>
										{page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} / {total}
									</span>
									<div className="join">
										<button className="btn join-item btn-ghost btn-sm btn-square" disabled={page === 0} onClick={() => set({ page: page - 1 || undefined })} aria-label="上一頁">
											<CaretLeftIcon size={15} />
										</button>
										<button className="btn join-item btn-ghost btn-sm btn-square" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => set({ page: page + 1 })} aria-label="下一頁">
											<CaretRightIcon size={15} />
										</button>
									</div>
								</div>
							)}
						</div>
					)}
				</section>

				<section className={`min-w-0 lg:min-h-0 ${openId ? "" : "hidden lg:block"}`}>
					<AnimatePresence mode="wait">
						{openId ? (
							<motion.div key={openId} className="lg:h-full" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
								<Reader id={openId} onBack={() => set({ m: undefined })} />
							</motion.div>
						) : (
							<div className="card-quiet hidden h-full place-items-center text-sm text-base-content/40 lg:grid">選一封信來看（J / K 上下切換）</div>
						)}
					</AnimatePresence>
				</section>
			</div>
		</div>
	);
}

function CourseFolders({ menu, current, onPick }: { menu: { id: number; fullname: string; unread: number }[]; current?: number; onPick: (id: number) => void }) {
	const { byId, current: semester } = useCourseIndex();
	const looks = usePrefs(s => s.courses);
	// Only courses from this semester, plus any course that has unread mail.
	const shown = menu.filter(c => byId.get(c.id)?.semester?.code === semester?.code || c.unread > 0 || c.id === current);
	if (!shown.length) return null;
	return (
		<div className="hidden lg:block">
			<p className="mb-1 px-3 text-xs font-medium text-base-content/45">依課程</p>
			<ul className="space-y-0.5">
				{shown.map(c => {
					const course = byId.get(c.id);
					const look = course ? resolveLook(course, looks[c.id]) : undefined;
					return (
						<li key={c.id}>
							<button
								onClick={() => onPick(c.id)}
								className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm ${current === c.id ? "bg-base-content/[0.07]" : "text-base-content/70 hover:bg-base-content/[0.04]"}`}
							>
								{look ? <CourseGlyph look={look} size="sm" /> : <span className="size-6" />}
								<span className="min-w-0 grow truncate">{look?.title ?? c.fullname}</span>
								{c.unread > 0 && <span className="text-xs text-primary">{c.unread}</span>}
							</button>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

function MailRow({ m, active, folder, onOpen }: { m: MailSummary; active: boolean; folder: MailFolder; onOpen: () => void }) {
	const { byId } = useCourseIndex();
	const course = byId.get(m.course.id);
	const looks = usePrefs(s => s.courses);
	const look = course ? resolveLook(course, looks[course.id]) : undefined;
	const who = folder === "sent" || folder === "drafts" ? m.recipients.map(r => cleanAuthor(r.fullname)).join("、") || "（沒有收件人）" : cleanAuthor(m.sender.fullname);
	const ref = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		if (active) ref.current?.scrollIntoView({ block: "nearest" });
	}, [active]);
	return (
		<button ref={ref} data-nav onClick={onOpen} className={`flex w-full gap-3 px-4 py-3 text-left transition-colors ${active ? "bg-primary/[0.06]" : "hover:bg-base-content/[0.03]"}`}>
			<span className={`mt-2 size-2 shrink-0 rounded-full ${m.unread ? "bg-primary" : ""}`} aria-label={m.unread ? "未讀" : undefined} />
			<span className="min-w-0 grow">
				<span className="flex items-center gap-2">
					<span className={`truncate text-sm ${m.unread ? "font-semibold" : "text-base-content/80"}`}>{who}</span>
					<Ago ts={m.time} className="ml-auto shrink-0 text-xs text-base-content/45" />
				</span>
				<span className={`mt-0.5 block truncate text-sm ${m.unread ? "font-medium" : "text-base-content/70"}`}>{m.subject || "（沒有主旨）"}</span>
				<span className="mt-1 flex items-center gap-2 text-xs text-base-content/50">
					{look && (
						<span className="flex min-w-0 items-center gap-1">
							<span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: look.color }} />
							<span className="truncate">{look.title}</span>
						</span>
					)}
					{m.attachments > 0 && (
						<span className="flex shrink-0 items-center gap-0.5">
							<PaperclipIcon size={12} />
							{m.attachments}
						</span>
					)}
					{m.starred && <StarIcon size={12} weight="fill" className="shrink-0 text-warning" />}
				</span>
			</span>
		</button>
	);
}

function Reader({ id, onBack }: { id: number; onBack: () => void }) {
	const { data: m, isPending, error, refetch } = useMailMessage(id);
	const setUnread = useSetUnread();
	const { byId } = useCourseIndex();
	const html = useMemo(() => (m ? cleanHtml(m.format === 1 ? m.content : m.content.replace(/\n/g, "<br>")) : ""), [m]);
	const [showThread, setShowThread] = useState(false);

	if (error) return <ErrorNote error={error} retry={refetch} />;
	if (isPending || !m) return <Lines n={5} />;
	const course = byId.get(m.course.id);
	const to = m.recipients.filter(r => r.type !== "cc" && r.type !== "bcc");
	const cc = m.recipients.filter(r => r.type === "cc");

	return (
		<article className="card-quiet p-5 sm:p-6 lg:max-h-full lg:overflow-y-auto lg:overscroll-contain">
			<div className="mb-4 flex flex-wrap items-center gap-2">
				<button onClick={onBack} className="btn btn-ghost btn-sm -ml-2 lg:hidden">
					<ArrowLeftIcon size={16} />
					返回
				</button>
				<div className="ml-auto flex gap-1">
					<button
						className="btn btn-ghost btn-sm"
						onClick={() => {
							setUnread.mutate({ id, unread: true });
							onBack();
						}}
						disabled={setUnread.isPending}
					>
						<EnvelopeOpenIcon size={16} />
						標為未讀
					</button>
					<a className="btn btn-sm" href={mailE3Url(id)} target="_blank" rel="noreferrer">
						<ArrowBendUpLeftIcon size={16} />
						在網站回覆
					</a>
				</div>
			</div>
			<h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{m.subject || "（沒有主旨）"}</h2>
			<dl className="mt-3 space-y-1 text-sm text-base-content/65">
				<div className="flex gap-2">
					<dt className="w-12 shrink-0 text-base-content/45">寄件人</dt>
					<dd className="font-medium text-base-content">{cleanAuthor(m.sender.fullname)}</dd>
				</div>
				{to.length > 0 && (
					<div className="flex gap-2">
						<dt className="w-12 shrink-0 text-base-content/45">收件人</dt>
						<dd>{to.map(r => cleanAuthor(r.fullname)).join("、")}</dd>
					</div>
				)}
				{cc.length > 0 && (
					<div className="flex gap-2">
						<dt className="w-12 shrink-0 text-base-content/45">副本</dt>
						<dd>{cc.map(r => cleanAuthor(r.fullname)).join("、")}</dd>
					</div>
				)}
				<div className="flex gap-2">
					<dt className="w-12 shrink-0 text-base-content/45">時間</dt>
					<dd>
						<Ago ts={m.time} />
						<span className="text-base-content/40">（{fullDateTime(m.time)}）</span>
					</dd>
				</div>
				{course && (
					<div className="flex gap-2">
						<dt className="w-12 shrink-0 text-base-content/45">課程</dt>
						<dd>{resolveLook(course).title}</dd>
					</div>
				)}
			</dl>
			<div className="prose-e3 mt-5 border-t hairline pt-5" dangerouslySetInnerHTML={{ __html: html }} />
			<Attachments files={m.attachments} />

			{m.references.length > 0 && (
				<div className="mt-6 border-t hairline pt-4">
					<button className="text-sm text-base-content/55 hover:text-base-content" onClick={() => setShowThread(v => !v)} aria-expanded={showThread}>
						{showThread ? "收起" : "顯示"}先前的 {m.references.length} 封信
					</button>
					{showThread && (
						<ol className="mt-3 space-y-4">
							{m.references.map(r => (
								<li key={r.id} className="rounded-xl bg-base-200 p-4 text-sm">
									<p className="mb-2 text-xs text-base-content/55">
										<span className="font-medium text-base-content/80">{cleanAuthor(r.sender.fullname)}</span> · <Ago ts={r.time} /> · {r.subject}
									</p>
									<div className="prose-e3" dangerouslySetInnerHTML={{ __html: cleanHtml(r.format === 1 ? r.content : r.content.replace(/\n/g, "<br>")) }} />
									<Attachments files={r.attachments} />
								</li>
							))}
						</ol>
					)}
				</div>
			)}
		</article>
	);
}

function Attachments({ files }: { files: { filename: string; mimetype: string; filesize: number; fileurl: string }[] }) {
	if (!files.length) return null;
	return (
		<ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
			{files.map(f => {
				const mf = { key: f.fileurl, name: f.filename, url: f.fileurl, size: f.filesize, mime: f.mimetype, ext: fileExt(f.filename), time: 0, path: "/" };
				return (
					<li key={f.fileurl}>
						<button onClick={() => openFile(mf)} className="flex w-full items-center gap-3 rounded-xl border hairline bg-base-100 px-3 py-2.5 text-left hover:bg-base-content/[0.03]">
							<FileIcon ext={mf.ext} size={26} />
							<span className="min-w-0">
								<span className="block truncate text-sm font-medium">{f.filename}</span>
								<span className="text-xs text-base-content/50">{humanSize(f.filesize)}</span>
							</span>
						</button>
					</li>
				);
			})}
		</ul>
	);
}
