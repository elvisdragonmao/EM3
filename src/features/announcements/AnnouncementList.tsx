import type { ParsedCourse } from "@/features/courses/parse";
import { usePrefs } from "@/features/preferences/store";
import { htmlToText } from "@/lib/moodle/files";
import { CourseTag } from "@/shared/ui/CourseTag";
import { Ago } from "@/shared/ui/Time";
import { PaperclipIcon, PushPinIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { type Announcement, cleanAuthor, postTime } from "./api";
import { t } from "./messages";

export function AnnouncementList({ items, byId, showCourse = true }: { items: Announcement[]; byId?: Map<number, ParsedCourse>; showCourse?: boolean }) {
	const seen = usePrefs(s => s.seen);
	return (
		<ul className="card-quiet divide-y divide-base-content/[0.06] overflow-hidden">
			{items.map(a => {
				const unread = !seen[a.discussion];
				const course = byId?.get(a.courseId);
				return (
					<li key={`${a.forumId}-${a.id}`}>
						<Link
							to="/courses/$courseId/discussion/$discussionId"
							params={{ courseId: String(a.courseId), discussionId: String(a.discussion) }}
							className="flex gap-3 px-4 py-3.5 transition-colors hover:bg-base-content/[0.03]"
							data-nav
						>
							<span className={`mt-2 size-2 shrink-0 rounded-full ${unread ? "bg-primary" : "bg-transparent"}`} />
							{unread && <span className="sr-only">{t("unread")}</span>}
							<span className="min-w-0 grow">
								<span className="flex items-center gap-2">
									{showCourse && course && <CourseTag course={course} />}
									{a.pinned && (
										<span className="text-warning" title={t("pinned")}>
											<PushPinIcon size={13} weight="fill" />
											<span className="sr-only">{t("pinned")}</span>
										</span>
									)}
									<Ago ts={postTime(a)} className="ml-auto shrink-0 text-xs text-base-content/65" />
								</span>
								<span className={`mt-0.5 block ${unread ? "font-semibold" : "font-medium text-base-content/80"}`}>{a.subject}</span>
								<span className="mt-0.5 line-clamp-2 text-sm text-base-content/65">
									<span className="text-base-content/70">{cleanAuthor(a.userfullname)}</span>・{htmlToText(a.message, 220)}
								</span>
								<span className="mt-1 flex gap-3 text-xs text-base-content/65">
									{!!a.attachments?.length && (
										<span className="flex items-center gap-1">
											<PaperclipIcon size={12} />
											{t("attachments", a.attachments.length)}
										</span>
									)}
									{a.numreplies > 0 && <span>{t("replies", a.numreplies)}</span>}
								</span>
							</span>
						</Link>
					</li>
				);
			})}
		</ul>
	);
}
