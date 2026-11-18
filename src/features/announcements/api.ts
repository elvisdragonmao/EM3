import { call, callMany } from "@/lib/moodle/client";
import type { ForumDiscussion, ForumInfo, InlineFile } from "@/lib/moodle/types";
import { queryOptions, useQuery } from "@tanstack/react-query";

export function forumsQuery(courseIds: number[]) {
	const ids = [...courseIds].sort((a, b) => a - b);
	return queryOptions({
		queryKey: ["forums", ids],
		queryFn: () => call<ForumInfo[]>("mod_forum_get_forums_by_courses", { courseids: ids }),
		enabled: ids.length > 0,
		staleTime: 30 * 60_000
	});
}

export const useForums = (courseIds: number[]) => useQuery(forumsQuery(courseIds));

export interface Announcement extends ForumDiscussion {
	courseId: number;
	forumId: number;
	cmid: number;
	forumType: string;
}

interface DiscussionsResponse {
	discussions: ForumDiscussion[];
}

/**
 * Latest discussions from every news forum (E3 calls them 公告) in the given
 * courses, merged newest first. One batched request regardless of course count.
 */
export function useAnnouncements(courseIds: number[], opts: { perForum?: number; includeGeneral?: boolean } = {}) {
	const { data: forums } = useForums(courseIds);
	const perForum = opts.perForum ?? 15;
	const targets = (forums ?? []).filter(f => f.type === "news" || (opts.includeGeneral && f.type === "general"));
	return useQuery({
		queryKey: ["announcements", targets.map(f => f.id), perForum],
		enabled: !!forums,
		staleTime: 3 * 60_000,
		queryFn: async ({ signal }) => {
			const results = await callMany<DiscussionsResponse>(
				targets.map(f => ({ fn: "mod_forum_get_forum_discussions", args: { forumid: f.id, sortorder: 3, page: 0, perpage: perForum } })),
				signal
			);
			const all: Announcement[] = results.flatMap((r, i) =>
				(r?.discussions ?? []).map(d => ({ ...d, courseId: targets[i].course, forumId: targets[i].id, cmid: targets[i].cmid, forumType: targets[i].type }))
			);
			return all.sort((a, b) => postTime(b) - postTime(a));
		}
	});
}

/** When the post became visible to students. */
export const postTime = (d: Pick<ForumDiscussion, "timestart" | "created">) => Math.max(d.timestart || 0, d.created);

type ForumAttachment = Omit<InlineFile, "fileurl"> & { url?: string; fileurl?: string };

export interface ForumPost {
	id: number;
	subject: string;
	replysubject: string;
	message: string;
	messageformat: number;
	author: { id: number; fullname: string; urls?: { profileimage?: string } };
	discussionid: number;
	hasparent: boolean;
	parentid: number | null;
	timecreated: number;
	timemodified?: number;
	unread: boolean | null;
	isdeleted: boolean;
	attachments: ForumAttachment[];
	messageinlinefiles?: InlineFile[];
	html?: { rating?: string | null; taglist?: string | null; authorsubheading?: string | null };
}

export function discussionQuery(discussionid: number) {
	return queryOptions({
		queryKey: ["discussion", discussionid],
		queryFn: () => call<{ posts: ForumPost[] }>("mod_forum_get_discussion_posts", { discussionid, sortby: "created", sortdirection: "ASC" }),
		staleTime: 5 * 60_000
	});
}

export const useDiscussion = (id: number) => useQuery(discussionQuery(id));

/** E3 prefixes names with the department: 「資工系 / DCP 王小明」→「王小明」. */
export function cleanAuthor(name: string) {
	const m = /^.+?\s\/\s\S+\s+(.+)$/.exec(name.trim());
	return m ? m[1] : name.trim();
}
