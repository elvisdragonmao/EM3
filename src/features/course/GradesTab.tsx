import { useSession } from "@/features/auth/session";
import type { ParsedCourse } from "@/features/courses/parse";
import { call } from "@/lib/moodle/client";
import { cleanHtml } from "@/lib/moodle/files";
import { Empty, ErrorNote, Lines } from "@/shared/ui/States";
import { ChartBarIcon, ChatTextIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { t as tr } from "./messages";

interface GradeItem {
	id: number;
	itemname: string | null;
	itemtype: "mod" | "manual" | "course" | "category";
	itemmodule: string | null;
	cmid?: number;
	gradeformatted: string;
	rangeformatted: string;
	percentageformatted: string;
	feedback: string;
	gradeishidden: boolean;
	gradedategraded: number | null;
}

const decode = (s: string) => new DOMParser().parseFromString(s, "text/html").body.textContent ?? s;
const empty = (s: string | undefined) => !s || s.trim() === "-" || s.trim() === "";

export function GradesTab({ course }: { course: ParsedCourse }) {
	const userid = useSession(s => s.userid)!;
	const { data, isPending, error, refetch } = useQuery({
		queryKey: ["grades", course.id],
		staleTime: 5 * 60_000,
		queryFn: async () => (await call<{ usergrades: { gradeitems: GradeItem[] }[] }>("gradereport_user_get_grade_items", { courseid: course.id, userid })).usergrades[0]?.gradeitems ?? []
	});

	if (error) return <ErrorNote error={error} retry={refetch} />;
	if (isPending) return <Lines n={5} />;
	const items = (data ?? []).filter(i => i.itemtype !== "category" && !i.gradeishidden);
	const total = items.find(i => i.itemtype === "course");
	const rows = items.filter(i => i.itemtype !== "course");
	const released = rows.filter(i => !empty(i.gradeformatted)).length;
	if (!rows.length) return <Empty icon={<ChartBarIcon size={40} weight="duotone" />} title={tr("noGradeItems")} />;

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap gap-3">
				<div className="card-quiet min-w-40 grow px-4 py-3 sm:grow-0">
					<p className="text-xs text-base-content/65">{tr("released")}</p>
					<p className="text-2xl font-semibold tabular-nums">
						{released}
						<span className="text-base font-normal text-base-content/65"> / {rows.length}</span>
					</p>
				</div>
				{total && !empty(total.gradeformatted) && (
					<div className="card-quiet min-w-40 grow px-4 py-3 sm:grow-0">
						<p className="text-xs text-base-content/65">{tr("total")}</p>
						<p className="text-2xl font-semibold tabular-nums">{decode(total.gradeformatted)}</p>
					</div>
				)}
			</div>
			<div className="card-quiet overflow-hidden">
				<table className="w-full">
					<caption className="sr-only">{tr("gradesCaption")}</caption>
					<thead className="sr-only">
						<tr>
							<th scope="col">{tr("colItem")}</th>
							<th scope="col">{tr("colGrade")}</th>
						</tr>
					</thead>
					{rows.map(i => {
						const has = !empty(i.gradeformatted);
						return (
							<tbody key={i.id} className="border-t border-base-content/[0.06] first-of-type:border-t-0">
								<tr>
									<th scope="row" className={`w-full px-4 pt-3 text-left align-middle font-normal ${i.feedback ? "pb-0" : "pb-3"}`}>
										{(i.itemmodule === "assign" || i.itemmodule === "quiz") && i.cmid ? (
											<Link
												to={i.itemmodule === "quiz" ? "/courses/$courseId/quiz/$cmid" : "/courses/$courseId/assign/$cmid"}
												params={{ courseId: String(course.id), cmid: String(i.cmid) }}
												className="font-medium break-words hover:underline"
											>
												{i.itemname}
											</Link>
										) : (
											<span className="block font-medium break-words">{i.itemname ?? tr("unnamed")}</span>
										)}
										<span className="block text-xs text-base-content/65">{tr("range", decode(i.rangeformatted))}</span>
									</th>
									<td className={`px-4 pt-3 text-right align-middle whitespace-nowrap ${i.feedback ? "pb-0" : "pb-3"}`}>
										<span className={`block text-lg font-semibold tabular-nums ${has ? "" : "text-base-content/65"}`}>{has ? decode(i.gradeformatted) : tr("notReleased")}</span>
										{has && !empty(i.percentageformatted) && <span className="block text-xs text-base-content/65 tabular-nums">{decode(i.percentageformatted)}</span>}
									</td>
								</tr>
								{i.feedback && (
									<tr>
										<td colSpan={2} className="px-4 pt-2 pb-3">
											<div className="flex gap-2 rounded-lg bg-base-200 p-3 text-sm">
												<ChatTextIcon size={16} className="mt-0.5 shrink-0 text-base-content/65" />
												<span className="sr-only">{tr("feedback")}</span>
												<div className="prose-e3 min-w-0" dangerouslySetInnerHTML={{ __html: cleanHtml(i.feedback) }} />
											</div>
										</td>
									</tr>
								)}
							</tbody>
						);
					})}
				</table>
			</div>
		</div>
	);
}
