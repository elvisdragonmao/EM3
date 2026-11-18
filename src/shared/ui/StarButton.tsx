import { tc } from "@/i18n/common";
import { GithubLogoIcon, StarIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { t } from "./messages";

export const REPO = "https://github.com/elvisdragonmao/EM3";

function useStars() {
	return useQuery({
		queryKey: ["github-stars"],
		staleTime: 60 * 60_000,
		retry: false,
		queryFn: async ({ signal }) => {
			const res = await fetch("https://api.github.com/repos/elvisdragonmao/EM3", { signal });
			if (!res.ok) throw new Error(String(res.status));
			return ((await res.json()) as { stargazers_count: number }).stargazers_count;
		}
	});
}

export function StarButton({ big = false }: { big?: boolean }) {
	const { data: stars } = useStars();
	return (
		<a href={REPO} target="_blank" rel="noreferrer" className={`btn ${big ? "btn-lg" : "btn-sm btn-ghost"} gap-2 ${big ? "border-base-content/15 bg-base-100" : "border-base-content/15"}`}>
			<GithubLogoIcon size={big ? 20 : 18} weight="fill" />
			<span className={big ? "" : "sr-only md:not-sr-only"}>{t("starOnGitHub")}</span>
			{typeof stars === "number" && (
				<>
					<span aria-hidden className="flex items-center gap-1 border-l border-base-content/15 pl-2 tabular-nums text-base-content/70">
						<StarIcon size={14} weight="fill" className="text-warning" />
						{stars}
					</span>
					<span className="sr-only">{t("starCount", stars)}</span>
				</>
			)}
			<span className="sr-only">{tc("openInNewTab")}</span>
		</a>
	);
}
