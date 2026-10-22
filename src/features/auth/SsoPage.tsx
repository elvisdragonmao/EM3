import { finishSso } from "@/lib/moodle/sso";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useSession } from "./session";

/** Landing page of the `web+emthree:` protocol handler: turns the link from Moodle into a session. */
export function SsoPage() {
	const { u } = useSearch({ from: "/sso" });
	const signInWithToken = useSession(s => s.signInWithToken);
	const navigate = useNavigate();
	const [error, setError] = useState<string | null>(u ? null : "沒有收到登入連結");
	const started = useRef(false);

	useEffect(() => {
		if (!u || started.current) return;
		started.current = true;
		(async () => {
			const { baseUrl, token, remember, next } = finishSso(u);
			await signInWithToken(baseUrl, token, remember);
			const target = next?.replace(/^#/, "");
			await navigate({ to: target && target !== "/login" ? target : "/", replace: true });
		})().catch(err => setError(err instanceof Error ? err.message : "登入失敗，請稍後再試"));
	}, [u, signInWithToken, navigate]);

	return (
		<main className="grid min-h-dvh place-items-center bg-base-200 px-4">
			{error ? (
				<div className="text-center">
					<p role="alert" className="text-error">
						{error}
					</p>
					<Link to="/login" className="btn btn-neutral mt-4">
						回登入頁
					</Link>
				</div>
			) : (
				<span className="loading loading-spinner loading-lg" />
			)}
		</main>
	);
}
