import { MoodleError } from "@/lib/moodle/client";
import { DEFAULT_MOODLE_URL, MOODLE_SITES } from "@/lib/moodle/site";
import { finishSso, registerSsoHandler, startSso } from "@/lib/moodle/sso";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowRightIcon, BellRingingIcon, CaretDownIcon, CheckIcon, CopyIcon, EyeIcon, EyeSlashIcon, LockSimpleIcon, ShieldCheckIcon, UserIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { type FormEvent, useState } from "react";
import { lastSite, useSession } from "./session";
import { Logo } from "@/shared/ui/Logo";

export function LoginPage() {
	const signIn = useSession(s => s.signIn);
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
	const [error, setError] = useState<string | null>(null);

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
			setError(err instanceof MoodleError && err.code === "invalidlogin" ? "學號或密碼不正確" : err instanceof Error ? err.message : "登入失敗，請稍後再試");
		} finally {
			setBusy(false);
		}
	}

	const pasteSsoLink = () => {
		try {
			finishSso(ssoLink); // Check here first, so a wrong paste keeps the school picked.
		} catch (err) {
			return setError(err instanceof Error ? err.message : "連結格式不正確");
		}
		void navigate({ to: "/sso", search: { u: ssoLink } });
	};

	return (
		<main className="relative flex min-h-dvh flex-col items-center justify-center overflow-x-hidden bg-base-200 px-4 py-6">
			<Backdrop />
			<motion.div
				initial={{ opacity: 0, y: 24, scale: 0.98 }}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				transition={{ type: "spring", stiffness: 260, damping: 28 }}
				className="surface relative w-full max-w-md rounded-[1.75rem] p-7 shadow-2xl sm:p-9"
			>
				<div className="mb-8 flex items-center gap-3">
					<Logo size={52} />
					<div>
						<h1 className="text-xl font-semibold tracking-tight">EM3</h1>
						<p className="text-sm text-base-content/60">更快、更人類的 Moodle</p>
					</div>
				</div>
				{!showOtherSchools && <p className="mb-5 text-sm font-medium text-base-content/70">使用陽明交通大學 E3 登入</p>}

				<form onSubmit={submit} className="space-y-4">
					{showOtherSchools && (
						<fieldset className="fieldset">
							<label htmlFor="moodle-site" className="fieldset-legend">
								學校
							</label>
							<select
								id="moodle-site"
								aria-label="選擇 Moodle 學校"
								className="select select-lg w-full"
								value={customSite ? "custom" : baseUrl}
								onChange={e => {
									const custom = e.target.value === "custom";
									setCustomSite(custom);
									setBaseUrl(custom ? "" : e.target.value);
									if (MOODLE_SITES.find(site => site.baseUrl === e.target.value)?.sso) registerSsoHandler();
								}}
							>
								{MOODLE_SITES.map(site => (
									<option key={site.baseUrl} value={site.baseUrl}>
										{site.name}
									</option>
								))}
								<option value="custom">其他學校／自訂 Moodle 網址</option>
							</select>
							{customSite && (
								<>
									<input
										type="text"
										inputMode="url"
										className="input input-lg mt-2 w-full"
										autoComplete="url"
										required
										placeholder="https://moodle.example.edu.tw"
										value={baseUrl}
										onChange={e => setBaseUrl(e.target.value)}
									/>
									<p className="label">可貼上 Moodle 首頁或登入頁網址。</p>
								</>
							)}
						</fieldset>
					)}
					{passwordLogin && (
						<>
							<label className="input input-lg w-full">
								<UserIcon size={18} className="opacity-50" />
								<input className="grow" autoComplete="username" inputMode="text" required placeholder="帳號或學號" value={username} onChange={e => setUsername(e.target.value)} />
							</label>
							<label className="input input-lg w-full pr-2">
								<LockSimpleIcon size={18} className="opacity-50" />
								<input
									type={reveal ? "text" : "password"}
									className="grow"
									autoComplete="current-password"
									required
									placeholder="Moodle 密碼"
									value={password}
									onChange={e => setPassword(e.target.value)}
								/>
								<button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={() => setReveal(r => !r)} aria-label={reveal ? "隱藏密碼" : "顯示密碼"}>
									{reveal ? <EyeSlashIcon size={16} /> : <EyeIcon size={16} />}
								</button>
							</label>
						</>
					)}

					<label className="flex cursor-pointer items-center gap-2 text-sm">
						<input type="checkbox" className="checkbox checkbox-sm" checked={remember} onChange={e => setRemember(e.target.checked)} />
						保持登入 90 天
					</label>

					{error && (
						<motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} role="alert" className="text-sm text-error">
							{error}
						</motion.p>
					)}

					{passwordLogin && (
						<button className="btn btn-neutral btn-lg w-full" disabled={busy}>
							{busy ? (
								<span className="loading loading-spinner loading-sm" />
							) : (
								<>
									登入
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
									<p className="text-sm leading-relaxed">瀏覽器詢問是否開啟 web+emthree 連結時，請選擇「允許」；登入完成後將自動返回 EM3。</p>
									<p className="text-xs leading-relaxed text-base-content/60">
										誤關詢問會被 Chrome 視為封鎖，請至
										<button
											type="button"
											aria-label="複製 chrome://settings/handlers"
											className="mx-1 inline-flex items-center gap-1 rounded-field bg-base-content/10 px-1.5 py-0.5 font-mono text-base-content/80 transition-colors hover:bg-base-content/15"
											onClick={() =>
												navigator.clipboard
													.writeText("chrome://settings/handlers")
													.then(() => {
														setCopied(true);
														setTimeout(() => setCopied(false), 1500);
													})
													// Clipboard refused: the URL stays on screen to copy by hand.
													.catch(() => {})
											}
										>
											chrome://settings/handlers
											{copied ? <CheckIcon size={12} className="text-success" /> : <CopyIcon size={12} />}
										</button>
										移除封鎖後，
										{/* A click, not a reload: the page may reopen on the remembered school without picking it again. */}
										<button type="button" className="link" onClick={registerSsoHandler}>
											重新詢問
										</button>
										。
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
									setError("無法開始單一登入，請確認瀏覽器允許此網站儲存資料。");
								}
							}}
						>
							使用學校單一登入（SSO）
						</button>
						{/* Safari cannot register the web+emthree handler, so there the paste box is the main path. */}
						<details open={!("registerProtocolHandler" in navigator)} className="group rounded-field border border-base-content/10">
							<summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-2.5 text-xs text-base-content/70 [&::-webkit-details-marker]:hidden">
								單一登入完成後沒有回到 EM3？
								<CaretDownIcon size={14} className="shrink-0 transition-transform group-open:rotate-180" />
							</summary>
							<div className="space-y-3 border-t border-base-content/10 px-3.5 pt-3 pb-3.5">
								<ol className="space-y-2 text-xs leading-relaxed text-base-content/70">
									{[`在 ${sso.pageName ?? "Moodle"} 的完成頁面，長按或按右鍵複製「${sso.linkText ?? "若應用程式沒有自動開啟，請點選這裡"}」的連結。`, "貼到下方欄位，選擇「完成登入」。"].map(
										(step, i) => (
											<li key={i} className="flex gap-2.5">
												<span className="grid size-5 shrink-0 place-items-center rounded-full bg-base-content/10 font-semibold tabular-nums">{i + 1}</span>
												<span>{step}</span>
											</li>
										)
									)}
								</ol>
								<div className="join w-full">
									<input className="input input-sm join-item grow" placeholder="web+emthree://token=…" value={ssoLink} onChange={e => setSsoLink(e.target.value)} />
									<button type="button" className="btn btn-sm join-item" disabled={!ssoLink.trim()} onClick={pasteSsoLink}>
										完成登入
									</button>
								</div>
							</div>
						</details>
					</div>
				)}
				<button
					type="button"
					className="btn btn-ghost btn-sm mt-2 w-full font-normal text-base-content/60"
					onClick={() => {
						if (showOtherSchools) {
							setBaseUrl(DEFAULT_MOODLE_URL);
							setCustomSite(false);
						}
						setShowOtherSchools(value => !value);
					}}
				>
					{showOtherSchools ? "改用陽明交通大學 E3" : "不是陽明交大的學生？選擇其他學校"}
				</button>

				<p className="mt-6 flex gap-2 text-xs leading-relaxed text-base-content/55">
					<ShieldCheckIcon size={16} className="mt-0.5 shrink-0" />
					這是個靜態網頁，密碼不會傳到 EM3 伺服器。
				</p>
			</motion.div>
			<Link to="/welcome" className="relative mt-6 text-sm text-base-content/55 hover:text-base-content">
				EM3 是什麼？
			</Link>
		</main>
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
				<Logo size={1100} className="max-w-[160vw]" />
			</motion.div>
			<div className="absolute inset-0 opacity-[0.07]">
				<Logo size={1100} className="absolute top-1/2 left-1/2 max-w-[160vw] -translate-x-1/2 -translate-y-1/2" />
			</div>
		</div>
	);
}
