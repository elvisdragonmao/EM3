import { useSession } from "@/features/auth/session";
import { usePrefs } from "@/features/preferences/store";
import { ALL_THEMES } from "@/features/settings/themes";
import { MOD_LABEL } from "@/shared/keyboard/hotkeys";
import { Logo } from "@/shared/ui/Logo";
import { ArrowRightIcon, GithubLogoIcon, StarIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { motion, useScroll, useTransform } from "motion/react";
import { type ReactNode, useRef } from "react";

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
			<GithubLogoIcon size={big ? 20 : 18} weight="fill" />在 GitHub 上給顆星
			{typeof stars === "number" && (
				<span className="flex items-center gap-1 border-l border-base-content/15 pl-2 tabular-nums text-base-content/70">
					<StarIcon size={14} weight="fill" className="text-warning" />
					{stars}
				</span>
			)}
		</a>
	);
}

/** Left: strings copied from the official E3 pages. Right: what EM3 shows (as seen on Thursday 10/15). */
const TIME_EXAMPLES = [
	["10月 22日 星期四, AM 12:00", "下星期三 10/21 24:00"],
	["10月 21日 星期三, PM 11:59", "下星期三 10/21 23:59"],
	["今天, PM 12:00", "今天 12:00"],
	["10月 14日", "昨天 星期三"],
	["10 10月 2026", "10/10 上星期六"]
];

const KEYS = [
	[`${MOD_LABEL} K`, "跳到任何一門課"],
	["1 – 8", "切換頁面"],
	["J  K", "上下移動"],
	["[  ]", "切換課程分頁"],
	["U", "選檔案上傳"],
	[`${MOD_LABEL} /`, "看全部快捷鍵"]
];

export function LandingPage() {
	const signedIn = useSession(s => !!s.token);
	const theme = usePrefs(s => s.theme);
	const setPref = usePrefs(s => s.set);
	const hero = useRef<HTMLDivElement>(null);
	const { scrollYProgress } = useScroll({ target: hero, offset: ["start end", "end start"] });
	const tilt = useTransform(scrollYProgress, [0, 0.45], [14, 0]);
	const scale = useTransform(scrollYProgress, [0, 0.45], [0.92, 1]);

	const cta = signedIn ? (
		<Link to="/" className="btn btn-neutral btn-lg gap-2">
			打開 EM3
			<ArrowRightIcon size={18} weight="bold" />
		</Link>
	) : (
		<Link to="/login" className="btn btn-neutral btn-lg gap-2">
			用學校帳號登入
			<ArrowRightIcon size={18} weight="bold" />
		</Link>
	);

	return (
		<div className="min-h-dvh overflow-x-clip bg-base-100 text-base-content">
			<header className="surface sticky top-0 z-40 border-x-0 border-t-0">
				<div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
					<Link to="/welcome" className="flex items-center gap-2.5">
						<Logo size={32} />
						<span className="text-lg font-semibold tracking-tight">EM3</span>
					</Link>
					<nav className="ml-auto flex items-center gap-1 text-sm">
						<a href={REPO} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm gap-1.5">
							<GithubLogoIcon size={17} weight="fill" />
							<span className="hidden sm:inline">GitHub</span>
						</a>
						<Link to={signedIn ? "/" : "/login"} className="btn btn-neutral btn-sm">
							{signedIn ? "打開 EM3" : "登入"}
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
						E3 拉完了，
						<br />
						寫個給人用的吧。
					</motion.h1>
					<motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.08 }}>
						<p className="mt-8 max-w-2xl text-lg leading-relaxed text-base-content/70 sm:text-xl">
							EM3 是陽明交大課務系統 E3 的客戶端，設計給無論是老師還是學生。打開就知道這週要交什麼、現在這堂課的投影片在哪，作業拖進來就交。不用安裝，用原本的 E3 帳號登入。
						</p>
						<div className="mt-10 flex flex-wrap gap-3">
							{cta}
							<StarButton big />
						</div>
					</motion.div>
				</section>

				<div ref={hero} className="pb-24 [perspective:1600px] sm:pb-32">
					<motion.div style={{ rotateX: tilt, scale, transformOrigin: "50% 0%" }}>
						<Shot name="dashboard" alt="EM3 首頁：上課中的課程、這週行事曆與即將截止的作業" eager />
					</motion.div>
				</div>

				<div className="space-y-28 pb-28 sm:space-y-40 sm:pb-40">
					<section className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-16">
						<motion.h2 {...reveal} className="text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl lg:col-span-5">
							打開毫無重點，
							<br />
							什麼都找不到。
						</motion.h2>
						<motion.div {...reveal} className="space-y-4 text-[1.05rem] leading-relaxed text-base-content/70 lg:col-span-7">
							<p>原本的 E3 首頁要往下捲整個畫面，才看得到沒有課名的「未來事件」。EM3 的第一個畫面就是這週：哪門課、交了沒、還剩多久。</p>
							<p>設定好課表之後，正在上的那堂課會放在最上面，還有幾分鐘下課、教材、作業、公告，一目瞭然。</p>
						</motion.div>
					</section>

					<section>
						<motion.h2 {...reveal} className="max-w-3xl text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">
							時間用講的，
							<br className="sm:hidden" />
							不用心算。
						</motion.h2>
						<motion.p {...reveal} className="mt-5 max-w-2xl text-[1.05rem] leading-relaxed text-base-content/70">
							左邊是 E3 上實際看到的寫法。午夜截止的作業會顯示成隔天的「AM 12:00」，很容易以為還有一天。EM3 一律寫成前一天的 24:00，日期換成昨天、上星期幾這種說法。
						</motion.p>
						<motion.dl {...reveal} className="mt-12 divide-y divide-base-content/10 border-y border-base-content/10">
							{TIME_EXAMPLES.map(([before, after]) => (
								<div key={before} className="grid grid-cols-1 gap-1 py-5 sm:grid-cols-2 sm:gap-8">
									<dt className="font-mono text-sm text-base-content/45 sm:text-base">{before}</dt>
									<dd className="text-xl font-semibold tracking-tight sm:text-2xl">{after}</dd>
								</div>
							))}
						</motion.dl>
					</section>

					<Feature
						title={
							<>
								一個檔案，
								<br />
								就是一個檔案
							</>
						}
						shot={<Shot name="materials" alt="EM3 課程頁：教材依時間排列，PDF 可直接預覽" />}
					>
						<p>E3 的「教材」其實是資料夾，而大部分資料夾裡只有一份投影片。EM3 把它們攤平，最新的放最上面，一週內的新檔案會標出來。</p>
						<p>PDF、圖片、影片直接在旁邊打開，不用每次都下載。</p>
					</Feature>

					<Feature
						flip
						title={
							<>
								上傳檔案，
								<br />
								交出去，
								<br />
								很難嗎？
							</>
						}
						shot={<Shot name="submit" alt="EM3 作業頁：拖放檔案後按繳交" />}
					>
						<p>沒有沒人用的維基圖庫、沒有授權條款下拉選單、沒有「儲存更改」。允許的檔案類型寫在拖放區裡，選錯當場就會提醒。</p>
						<p>按下繳交前會列出 E3 上最後會有哪些檔案；逾期的話也會先告訴你。</p>
					</Feature>

					<Feature
						title={
							<>
								學期過了，
								<br />
								課程就不見
								<br />
								是三小。
							</>
						}
						shot={<Shot name="courses" alt="EM3 課程列表：依學期分組，每門課有自己的顏色與圖示" />}
					>
						<p>依學期分組，本學期在最上面；微學分、線上課程分開放。每門課有自己的顏色和圖示，名字太長可以取簡稱，不想看的可以藏起來。</p>
						<p>這些設定只存在你的瀏覽器，可以匯出成檔案帶到別台電腦。</p>
					</Feature>

					<Feature
						flip
						title={
							<>
								知道你在哪堂課
								<br />
								快速獲得資源
							</>
						}
						shot={<Shot name="timetable" alt="EM3 課表編輯器" />}
					>
						<p>貼上課綱上的時間代碼，像是 T34R7-EC022，或直接在格子上點。之後側欄和首頁會自動把正在上的課標出來，連下課倒數都有。</p>
					</Feature>

					<section className="grid grid-cols-1 gap-8 border-t border-base-content/10 pt-20 lg:grid-cols-12 lg:gap-16">
						<motion.h2 {...reveal} className="text-3xl leading-tight font-bold tracking-tight text-balance sm:text-5xl lg:col-span-6">
							老師那一側的 E3，
							<br />
							一樣拉完了。
						</motion.h2>
						<motion.div {...reveal} className="space-y-4 text-[1.05rem] leading-relaxed text-base-content/70 lg:col-span-6">
							<p>評分表在 1920 寬的螢幕上一列都塞不下；下載全部的資料夾用的是對不回學號的「參與者編號」；有四份選課已失效的學生交的作業，根本不在評分表裡。</p>
						</motion.div>
					</section>

					<Feature
						title={
							<>
								J、K、⌘↵，
								<br />
								下一位。
							</>
						}
						shot={<Shot name="grading" alt="EM3 評分工作台：左邊學生名單，右邊繳交內容與評分" />}
					>
						<p>左邊名單、右邊作業，打分數、寫評語、⌘↵ 存檔跳下一位。評語可以用按鈕排版或直接寫 Markdown，常用的句子存成片語一鍵插入。</p>
						<p>下載全部會照「學號_姓名」分資料夾、附成績表；改好的檔案拖回來自動對回每位學生，成績用 CSV 匯入、寫入前先給你看新舊對照。Excel 存成 Big5 也讀得懂。</p>
					</Feature>

					<section className="space-y-10">
						<motion.div {...reveal} className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-16">
							<h2 className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl lg:col-span-5">
								出題有 136 個欄位，
								<br />
								是在開飛機？
							</h2>
							<div className="space-y-4 text-[1.05rem] leading-relaxed text-base-content/70 lg:col-span-7">
								<p>在 EM3 打題目，或直接從 Excel 貼上，下載 Moodle XML 丟進 E3 題庫，一份小考從一百多次點擊變成幾分鐘。</p>
								<p>公告用 Markdown 寫，程式碼、數學式都留得住；發布前先看學生會看到的樣子。E3 沒開放新增教材的 API，所以教材在這裡寫好、一鍵複製貼回 E3。</p>
							</div>
						</motion.div>
						<motion.div {...reveal} className="grid grid-cols-1 gap-6 md:grid-cols-2">
							<Shot name="quiz" alt="EM3 小考出題：題目卡片與 Moodle XML 匯出" />
							<Shot name="announce" alt="EM3 發布公告：Milkdown 編輯器" />
						</motion.div>
					</section>

					<section className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-16">
						<motion.div {...reveal} className="lg:col-span-5">
							<h2 className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl">全鍵盤操作，有手就行</h2>
							<p className="mt-5 text-[1.05rem] leading-relaxed text-base-content/70">每個按鈕都能用 Tab 走到，常用的事都有單鍵快捷鍵。忘了的時候，按 {MOD_LABEL} / 就會列出來。</p>
							<dl className="mt-8 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
								{KEYS.map(([k, label]) => (
									<div key={k} className="flex items-center gap-3">
										<dt className="flex gap-1">
											{k.split(/\s+/).map(part => (
												<kbd key={part} className="kbd kbd-sm">
													{part}
												</kbd>
											))}
										</dt>
										<dd className="text-sm text-base-content/70">{label}</dd>
									</div>
								))}
							</dl>
						</motion.div>
						<motion.div {...reveal} className="lg:col-span-7 lg:-mr-28 xl:-mr-40">
							<Shot name="shortcuts" alt="EM3 鍵盤快捷鍵列表" />
						</motion.div>
					</section>

					<section className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
						<motion.div {...reveal} className="lg:col-span-5">
							<h2 className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl">通勤路上也看得清楚</h2>
							<p className="mt-5 text-[1.05rem] leading-relaxed text-base-content/70">手機上是底部導覽列和精簡的週曆，點日期就列出當天要交的東西。PDF 交給手機自己的檢視器開。</p>
						</motion.div>
						<motion.div {...reveal} className="mx-auto grid w-full max-w-lg grid-cols-2 gap-5 sm:gap-8 lg:col-span-7">
							<Phone name="mobile-dashboard" alt="EM3 手機版首頁" />
							<div className="pt-16">
								<Phone name="mobile-course" alt="EM3 手機版課程頁" />
							</div>
						</motion.div>
					</section>

					<section>
						<motion.h2 {...reveal} className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
							{ALL_THEMES.length} 個主題，點一下就換
						</motion.h2>
						<motion.p {...reveal} className="mt-5 max-w-2xl text-[1.05rem] leading-relaxed text-base-content/70">
							daisyUI 的全部主題，加上 EM3 自己的淺色和深色。現在就可以試，這一頁會跟著變。
						</motion.p>
						<motion.div {...reveal} className="mt-10 flex flex-wrap gap-2">
							<button
								onClick={() => setPref("theme", "system")}
								className={`btn btn-sm rounded-full ${theme === "system" ? "btn-neutral" : "border-base-content/15"}`}
								aria-pressed={theme === "system"}
							>
								跟隨系統
							</button>
							{ALL_THEMES.map(t => (
								<button
									key={t.name}
									onClick={() => setPref("theme", t.name)}
									aria-pressed={theme === t.name}
									className={`flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition hover:-translate-y-0.5 ${theme === t.name ? "border-base-content" : "border-base-content/15"}`}
									style={{ backgroundColor: t.swatch[0], color: t.swatch[4] }}
								>
									<span className="flex -space-x-1">
										{t.swatch.slice(1, 4).map((c, i) => (
											<span key={i} className="size-4 rounded-full border border-black/10" style={{ backgroundColor: c }} />
										))}
									</span>
									{t.name}
								</button>
							))}
						</motion.div>
					</section>

					<section className="grid grid-cols-1 gap-10 border-t border-base-content/10 pt-16 lg:grid-cols-12">
						<motion.h2 {...reveal} className="text-3xl leading-tight font-bold tracking-tight lg:col-span-4 sm:text-4xl">
							你的帳號，
							<br />
							只跟 Moodle 說話
						</motion.h2>
						<motion.ul {...reveal} className="space-y-6 text-[1.05rem] leading-relaxed text-base-content/70 lg:col-span-8">
							<li>
								<strong className="text-base-content">沒有後端。</strong>EM3 是一個靜態網頁，瀏覽器直接呼叫所選學校的 Moodle 行動版 API，中間沒有任何伺服器。
							</li>
							<li>
								<strong className="text-base-content">不存密碼。</strong>密碼只用來向 Moodle 換一組登入憑證，憑證和學校網址放在這個網站的 cookie，登出就清掉。
							</li>
							<li>
								<strong className="text-base-content">不替你按已讀。</strong>公告的已讀狀態只記在你的瀏覽器（站內信例外，打開時會像在 E3 一樣標為已讀）；EM3
								不會在你按下繳交之前碰你的作業，老師的評分也要按下儲存才會寫入。
							</li>
							<li>
								<strong className="text-base-content">程式碼全部公開。</strong>
								<a href={REPO} target="_blank" rel="noreferrer" className="link">
									github.com/elvisdragonmao/EM3
								</a>
								，有疑慮可以自己看，也可以自己架一份。
							</li>
						</motion.ul>
					</section>

					<section className="text-center">
						<motion.div {...reveal} className="flex flex-col items-center">
							<Logo size={96} />
							<h2 className="mt-8 text-4xl leading-tight font-black tracking-tight sm:text-6xl">今天要交什麼？</h2>
							<p className="mt-5 max-w-xl text-lg text-base-content/70">登入看看。覺得好用的話，到 GitHub 給一顆星，讓更多同學找到它。</p>
							<div className="mt-10 flex flex-wrap justify-center gap-3">
								{cta}
								<StarButton big />
							</div>
						</motion.div>
					</section>
				</div>
			</main>

			<footer className="border-t border-base-content/10">
				<div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-base-content/55 sm:flex-row sm:items-center sm:px-6">
					<span className="flex items-center gap-2">
						<Logo size={20} />
						EM3 由<a href="https://elvismao.com/">毛哥EM</a>製作，與國立陽明交通大學無關。
					</span>
					<span className="sm:ml-auto">
						<a href={REPO} target="_blank" rel="noreferrer" className="link link-hover">
							GitHub
						</a>
						<span className="mx-2">·</span>
						Apache-2.0
					</span>
				</div>
			</footer>
		</div>
	);
}
