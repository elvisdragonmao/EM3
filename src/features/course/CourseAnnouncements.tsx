import { AnnouncementList } from "@/features/announcements/AnnouncementList";
import { useAnnouncements } from "@/features/announcements/api";
import type { ParsedCourse } from "@/features/courses/parse";
import { usePrefs } from "@/features/preferences/store";
import { Empty, ErrorNote, Lines } from "@/shared/ui/States";
import { CheckIcon, MegaphoneIcon } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { t as tr } from "./messages";

export function CourseAnnouncements({ course }: { course: ParsedCourse }) {
	const ids = useMemo(() => [course.id], [course.id]);
	const { data, isPending, error, refetch } = useAnnouncements(ids, { perForum: 50, includeGeneral: true });
	const [kind, setKind] = useState<"news" | "general">("news");
	const markSeen = usePrefs(s => s.markSeen);
	const seen = usePrefs(s => s.seen);
	const [marked, setMarked] = useState(false);

	if (error) return <ErrorNote error={error} retry={refetch} />;
	if (isPending) return <Lines n={5} />;
	const news = (data ?? []).filter(a => a.forumType === "news");
	const general = (data ?? []).filter(a => a.forumType !== "news");
	const list = kind === "news" ? news : general;
	const unread = list.filter(a => !seen[a.discussion]);

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-2">
				{general.length > 0 && (
					<div className="join" role="group" aria-label={tr("postKind")}>
						<button type="button" className={`btn join-item btn-sm ${kind === "news" ? "btn-active" : ""}`} aria-pressed={kind === "news"} onClick={() => setKind("news")}>
							{tr("news")} {news.length}
						</button>
						<button type="button" className={`btn join-item btn-sm ${kind === "general" ? "btn-active" : ""}`} aria-pressed={kind === "general"} onClick={() => setKind("general")}>
							{tr("general")} {general.length}
						</button>
					</div>
				)}
				{unread.length > 0 && (
					<button
						type="button"
						className="btn btn-ghost btn-sm ml-auto"
						onClick={() => {
							markSeen(unread.map(a => a.discussion));
							setMarked(true);
						}}
					>
						<CheckIcon size={15} />
						{tr("markAllRead")}
					</button>
				)}
				<span role="status" className="sr-only">
					{marked && !unread.length ? tr("markedRead") : ""}
				</span>
			</div>
			{list.length ? <AnnouncementList items={list} showCourse={false} /> : <Empty icon={<MegaphoneIcon size={40} weight="duotone" />} title={tr("noPosts")} />}
		</div>
	);
}
