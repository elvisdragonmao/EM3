import { CourseGlyph, useCourseLook } from "@/features/courses/look";
import type { ParsedCourse } from "@/features/courses/parse";
import { Link } from "@tanstack/react-router";

/** Colour dot + course title. Used wherever an item needs to say which course it belongs to. */
export function CourseTag({ course, link = false, className = "" }: { course: ParsedCourse; link?: boolean; className?: string }) {
	const look = useCourseLook(course)!;
	const body = (
		<>
			<span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: look.color }} aria-hidden />
			<span className="truncate" lang={look.titleLang}>
				{look.title}
			</span>
		</>
	);
	const cls = `inline-flex max-w-full min-w-0 items-center gap-1.5 text-xs font-medium text-base-content/70 ${className}`;
	return link ? (
		<Link to="/courses/$courseId" params={{ courseId: String(course.id) }} className={`${cls} hover:text-base-content`}>
			{body}
		</Link>
	) : (
		<span className={cls}>{body}</span>
	);
}

export function CourseHeaderGlyph({ course, size = "md" }: { course: ParsedCourse; size?: "sm" | "md" | "lg" }) {
	const look = useCourseLook(course)!;
	return <CourseGlyph look={look} size={size} />;
}
