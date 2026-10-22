import { FileIcon } from "@/features/course/FileIcon";
import { openFile } from "@/features/course/FilePreview";
import { useCourseIndex } from "@/features/courses/api";
import { usePrefs } from "@/features/preferences/store";
import { cleanHtml, e3Link, fileExt, humanSize, linkify } from "@/lib/moodle/files";
import { fullDateTime } from "@/lib/time/relative";
import { tc } from "@/i18n/common";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { CourseTag } from "@/shared/ui/CourseTag";
import { ErrorNote, Lines } from "@/shared/ui/States";
import { Ago } from "@/shared/ui/Time";
import { ArrowLeftIcon, ArrowSquareOutIcon } from "@phosphor-icons/react";
import { Link, useParams, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { cleanAuthor, type ForumPost, useDiscussion } from "./api";
import { t } from "./messages";

export function DiscussionPage() {
	const { courseId, discussionId } = useParams({ from: "/app/courses/$courseId/discussion/$discussionId" });
	const { data, isPending, error, refetch } = useDiscussion(Number(discussionId));
	const { byId } = useCourseIndex();
	const course = byId.get(Number(courseId));
	const markSeen = usePrefs(s => s.markSeen);
	const router = useRouter();
	useDocumentTitle(data?.posts[0]?.subject);

	useEffect(() => {
		if (data) markSeen([Number(discussionId)]);
	}, [data, discussionId, markSeen]);

	if (error) return <ErrorNote error={error} retry={refetch} />;
	if (isPending) return <Lines n={4} />;
	const [first, ...replies] = data!.posts;

	return (
		<article className="mx-auto max-w-3xl">
			<button type="button" onClick={() => router.history.back()} className="btn btn-ghost btn-sm mb-4 -ml-2">
				<ArrowLeftIcon size={16} />
				{t("back")}
			</button>
			<header className="mb-6">
				{course && <CourseTag course={course} link />}
				<h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{first.subject}</h1>
				<p className="mt-2 text-sm text-base-content/65">
					{cleanAuthor(first.author.fullname)} · <Ago ts={first.timecreated} /> <span className="text-base-content/65">{t("fullTime", fullDateTime(first.timecreated))}</span>
				</p>
			</header>
			<Post post={first} />
			{replies.length > 0 && (
				<section className="mt-8 space-y-4">
					<h2 className="text-sm font-semibold text-base-content/65">{t("replies", replies.length)}</h2>
					{replies.map(p => (
						<div key={p.id} className="card-quiet p-4">
							<p className="mb-2 text-xs text-base-content/65">
								<span className="font-medium text-base-content/80">{cleanAuthor(p.author.fullname)}</span> · <Ago ts={p.timecreated} />
							</p>
							<Post post={p} />
						</div>
					))}
				</section>
			)}
			<footer className="mt-10 border-t hairline pt-4 text-sm text-base-content/65">
				<a className="link link-hover inline-flex items-center gap-1" href={e3Link(`/mod/forum/discuss.php?d=${discussionId}`)} target="_blank" rel="noreferrer">
					<ArrowSquareOutIcon size={14} />
					{t("openOnE3")}
					<span className="sr-only">{tc("openInNewTab")}</span>
				</a>
				{course && (
					<Link to="/courses/$courseId" params={{ courseId }} search={{ tab: "announcements" }} className="link link-hover ml-4">
						{t("allInCourse")}
					</Link>
				)}
			</footer>
		</article>
	);
}

function Post({ post }: { post: ForumPost }) {
	const html = useMemo(() => cleanHtml(linkify(post.message)), [post.message]);
	return (
		<div>
			<div className="prose-e3 text-[0.97rem]" dangerouslySetInnerHTML={{ __html: html }} />
			{post.attachments?.length > 0 && (
				<ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
					{post.attachments.map(f => {
						const mf = { key: f.fileurl, name: f.filename, url: f.fileurl, size: f.filesize, mime: f.mimetype, ext: fileExt(f.filename), time: f.timemodified, path: "/" };
						return (
							<li key={f.fileurl}>
								<button type="button" onClick={() => openFile(mf)} className="card-quiet flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-base-content/[0.03]">
									<FileIcon ext={mf.ext} size={28} />
									<span className="min-w-0">
										<span className="block truncate text-sm font-medium">{f.filename}</span>
										<span className="text-xs text-base-content/65">{humanSize(f.filesize)}</span>
									</span>
								</button>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
