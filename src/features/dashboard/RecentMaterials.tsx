import { FileIcon } from "@/features/course/FileIcon";
import { openFile } from "@/features/course/FilePreview";
import { materialsFrom, useManyContents } from "@/features/course/materials";
import type { ParsedCourse } from "@/features/courses/parse";
import { humanSize } from "@/lib/moodle/files";
import { CourseTag } from "@/shared/ui/CourseTag";
import { Empty, Lines, SectionTitle } from "@/shared/ui/States";
import { Ago } from "@/shared/ui/Time";
import { FilesIcon } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

/** Newest files across this semester's courses — what students open in class. */
export function RecentMaterials({ courses }: { courses: ParsedCourse[] }) {
	const { data, isPending } = useManyContents(courses.map(c => c.id));
	const [limit, setLimit] = useState(6);
	const files = useMemo(() => {
		const out = [];
		for (const c of courses) {
			for (const m of materialsFrom(data?.get(c.id) ?? [])) for (const f of m.files) out.push({ c, m, f });
		}
		return out.sort((a, b) => b.f.time - a.f.time);
	}, [data, courses]);

	return (
		<section className="card-quiet p-4">
			<SectionTitle>最近更新的教材</SectionTitle>
			{isPending ? (
				<Lines n={3} />
			) : !files.length ? (
				<Empty icon={<FilesIcon size={36} weight="duotone" />} title="這學期還沒有教材" />
			) : (
				<>
					<ul className="grid grid-cols-1 gap-1 xl:grid-cols-2">
						{files.slice(0, limit).map(({ c, m, f }) => (
							<li key={f.key}>
								<button data-nav onClick={() => openFile(f)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-base-content/[0.04]">
									<FileIcon ext={f.ext} size={28} />
									<span className="min-w-0 grow">
										<span className="block truncate text-sm font-medium" title={f.name}>
											{f.name}
										</span>
										<span className="flex items-center gap-1.5 text-xs text-base-content/50">
											<CourseTag course={c} />
											<span className="shrink-0">·</span>
											<Ago ts={f.time} className="shrink-0 whitespace-nowrap" />
											<span className="hidden shrink-0 whitespace-nowrap sm:inline">· {humanSize(f.size)}</span>
										</span>
									</span>
									<span className="sr-only">{m.title}</span>
								</button>
							</li>
						))}
					</ul>
					{files.length > limit && (
						<button className="btn btn-ghost btn-sm mt-2 w-full" onClick={() => setLimit(l => l + 10)}>
							顯示更多
						</button>
					)}
				</>
			)}
		</section>
	);
}
