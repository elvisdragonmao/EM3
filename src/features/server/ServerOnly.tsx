import { CloudIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { t } from "./messages";
import { linkServer, useServer } from "./store";

/** Renders children only when the server version is connected; otherwise explains what's needed. */
export function ServerOnly({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
	const mode = useServer(s => s.mode);
	const status = useServer(s => s.status);
	const setMode = useServer(s => s.setMode);
	if (mode === "server" && status === "linked") return <>{children}</>;
	if (mode === "server") return <p className="text-sm text-base-content/65">{t("notLinked")}</p>;
	return (
		<div className={`flex flex-wrap items-center gap-3 rounded-box border hairline ${compact ? "p-3" : "p-4"}`}>
			<CloudIcon size={20} weight="duotone" className="shrink-0 text-primary" />
			<div className="min-w-0 grow">
				<p className="text-sm font-medium">{t("needsServer")}</p>
				{!compact && <p className="text-xs text-base-content/65">{t("needsServerBody")}</p>}
			</div>
			<button
				type="button"
				className="btn btn-sm btn-primary"
				onClick={() => {
					setMode("server");
					void linkServer();
				}}
			>
				{t("switchToServer")}
			</button>
		</div>
	);
}
