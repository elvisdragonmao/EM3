import { useSession } from "@/features/auth/session";
import { createHashHistory, createRootRoute, createRoute, createRouter, lazyRouteComponent, Outlet, redirect } from "@tanstack/react-router";
import type { MailSearch } from "@/features/mail/api";
import { AppShell } from "./AppShell";

// Hash history keeps every route reloadable on any static host (GitHub Pages,
// Cloudflare assets, a USB stick) without server-side rewrites.

const rootRoute = createRootRoute({ component: Outlet });

const loginRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/login",
	validateSearch: (s: Record<string, unknown>): { next?: string } => ({ next: typeof s.next === "string" ? s.next : undefined }),
	component: lazyRouteComponent(() => import("@/features/auth/LoginPage"), "LoginPage"),
	beforeLoad: () => {
		if (useSession.getState().token) throw redirect({ to: "/" });
	}
});

const ssoRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/sso",
	validateSearch: (s: Record<string, unknown>): { u?: string } => ({ u: typeof s.u === "string" ? s.u : undefined }),
	component: lazyRouteComponent(() => import("@/features/auth/SsoPage"), "SsoPage")
});

const welcomeRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/welcome",
	component: lazyRouteComponent(() => import("@/features/landing/LandingPage"), "LandingPage")
});

const appRoute = createRoute({
	getParentRoute: () => rootRoute,
	id: "app",
	component: AppShell,
	beforeLoad: ({ location }) => {
		if (useSession.getState().token) return;
		// Visitors land on the introduction; deep links and the installed app go straight to sign-in.
		if (location.pathname === "/" && !matchMedia("(display-mode: standalone)").matches) throw redirect({ to: "/welcome" });
		throw redirect({ to: "/login", search: { next: location.href } });
	}
});

const dashboardRoute = createRoute({
	getParentRoute: () => appRoute,
	path: "/",
	component: lazyRouteComponent(() => import("@/features/dashboard/DashboardPage"), "DashboardPage")
});

const coursesRoute = createRoute({
	getParentRoute: () => appRoute,
	path: "/courses",
	component: lazyRouteComponent(() => import("@/features/courses/CoursesPage"), "CoursesPage")
});

export type CourseTab = "materials" | "assignments" | "announcements" | "grades" | "teach";

const courseRoute = createRoute({
	getParentRoute: () => appRoute,
	path: "/courses/$courseId",
	validateSearch: (s: Record<string, unknown>): { tab?: CourseTab; q?: string } => ({
		tab: (["materials", "assignments", "announcements", "grades", "teach"] as const).includes(s.tab as CourseTab) ? (s.tab as CourseTab) : undefined,
		q: typeof s.q === "string" ? s.q : undefined
	}),
	component: lazyRouteComponent(() => import("@/features/course/CoursePage"), "CoursePage")
});

const assignmentRoute = createRoute({
	getParentRoute: () => appRoute,
	path: "/courses/$courseId/assign/$cmid",
	component: lazyRouteComponent(() => import("@/features/assignments/AssignmentPage"), "AssignmentPage")
});

const quizRoute = createRoute({
	getParentRoute: () => appRoute,
	path: "/courses/$courseId/quiz/$cmid",
	component: lazyRouteComponent(() => import("@/features/quizzes/QuizPage"), "QuizPage")
});

const gradingRoute = createRoute({
	getParentRoute: () => appRoute,
	path: "/courses/$courseId/assign/$cmid/grade",
	validateSearch: (s: Record<string, unknown>): { student?: number } => ({ student: Number(s.student) || undefined }),
	component: lazyRouteComponent(() => import("@/features/teaching/GradingPage"), "GradingPage")
});

const announceRoute = createRoute({
	getParentRoute: () => appRoute,
	path: "/courses/$courseId/announce",
	component: lazyRouteComponent(() => import("@/features/teaching/AnnouncePage"), "AnnouncePage")
});

const quizBuilderRoute = createRoute({
	getParentRoute: () => appRoute,
	path: "/courses/$courseId/quiz-builder",
	component: lazyRouteComponent(() => import("@/features/teaching/QuizBuilderPage"), "QuizBuilderPage")
});

const writeRoute = createRoute({
	getParentRoute: () => appRoute,
	path: "/courses/$courseId/write",
	component: lazyRouteComponent(() => import("@/features/teaching/WritePage"), "WritePage")
});

const discussionRoute = createRoute({
	getParentRoute: () => appRoute,
	path: "/courses/$courseId/discussion/$discussionId",
	component: lazyRouteComponent(() => import("@/features/announcements/DiscussionPage"), "DiscussionPage")
});

const tasksRoute = createRoute({
	getParentRoute: () => appRoute,
	path: "/tasks",
	component: lazyRouteComponent(() => import("@/features/assignments/TasksPage"), "TasksPage")
});

const announcementsRoute = createRoute({
	getParentRoute: () => appRoute,
	path: "/announcements",
	validateSearch: (s: Record<string, unknown>): { course?: number } => ({ course: Number(s.course) || undefined }),
	component: lazyRouteComponent(() => import("@/features/announcements/AnnouncementsPage"), "AnnouncementsPage")
});

const mailRoute = createRoute({
	getParentRoute: () => appRoute,
	path: "/mail",
	validateSearch: (s: Record<string, unknown>): MailSearch => ({
		folder: ["inbox", "starred", "sent", "drafts", "trash"].includes(s.folder as string) ? (s.folder as MailSearch["folder"]) : undefined,
		course: Number(s.course) || undefined,
		m: Number(s.m) || undefined,
		q: typeof s.q === "string" && s.q ? s.q : undefined,
		page: Number(s.page) || undefined
	}),
	component: lazyRouteComponent(() => import("@/features/mail/MailPage"), "MailPage")
});

const calendarRoute = createRoute({
	getParentRoute: () => appRoute,
	path: "/calendar",
	component: lazyRouteComponent(() => import("@/features/calendar/CalendarPage"), "CalendarPage")
});

const timetableRoute = createRoute({
	getParentRoute: () => appRoute,
	path: "/timetable",
	component: lazyRouteComponent(() => import("@/features/timetable/TimetablePage"), "TimetablePage")
});

const settingsRoute = createRoute({
	getParentRoute: () => appRoute,
	path: "/settings",
	component: lazyRouteComponent(() => import("@/features/settings/SettingsPage"), "SettingsPage")
});

const routeTree = rootRoute.addChildren([
	loginRoute,
	ssoRoute,
	welcomeRoute,
	appRoute.addChildren([
		dashboardRoute,
		coursesRoute,
		courseRoute,
		assignmentRoute,
		quizRoute,
		gradingRoute,
		announceRoute,
		quizBuilderRoute,
		writeRoute,
		discussionRoute,
		tasksRoute,
		announcementsRoute,
		mailRoute,
		calendarRoute,
		timetableRoute,
		settingsRoute
	])
]);

export const router = createRouter({
	routeTree,
	history: createHashHistory(),
	defaultPreload: "intent",
	defaultPreloadStaleTime: 0,
	scrollRestoration: true
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
