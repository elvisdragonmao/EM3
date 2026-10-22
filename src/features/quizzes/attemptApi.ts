import { call } from "@/lib/moodle/client";
import { useQuery } from "@tanstack/react-query";
import type { Quiz, QuizAttempt } from "./api";
import { type AttemptAccess, attemptBlockers, type Field, type NavQuestion, type QuizAccess } from "./attempt";

// The Moodle mobile web service calls behind answering a quiz in EM3, in the
// order the official Moodle app uses them. Every call that changes the attempt
// is made only from a direct student action, autosave of what they typed, or
// the timer running out.

/** Preflight data such as the quiz password; Moodle asks for it on every call. */
export type Preflight = Field[];

export interface AttemptQuestion extends NavQuestion {
	html: string;
	sequencecheck?: number;
	maxmark?: number;
	responsefileareas?: { area: string; files: unknown[] }[];
}

export interface AttemptPage {
	attempt: QuizAttempt & { layout?: string; currentpage?: number; uniqueid?: number };
	messages: string[];
	nextpage: number;
	questions: AttemptQuestion[];
}

export interface AttemptSummary {
	questions: AttemptQuestion[];
	totalunanswered?: number;
}

export function useQuizAccess(quizId: number | undefined) {
	return useQuery({
		queryKey: ["quiz-access", quizId],
		enabled: !!quizId,
		staleTime: 60_000,
		queryFn: () => call<QuizAccess>("mod_quiz_get_quiz_access_information", { quizid: quizId! })
	});
}

/** With no attempt id, says whether a new attempt may start and if it needs preflight data. */
export function useAttemptAccess(quizId: number | undefined, attemptId: number | undefined) {
	return useQuery({
		queryKey: ["quiz-attempt-access", quizId, attemptId ?? 0],
		enabled: !!quizId,
		staleTime: 30_000,
		queryFn: () => call<AttemptAccess>("mod_quiz_get_attempt_access_information", { quizid: quizId!, attemptid: attemptId ?? 0 })
	});
}

export function useRequiredQtypes(quizId: number | undefined) {
	return useQuery({
		queryKey: ["quiz-qtypes", quizId],
		enabled: !!quizId,
		staleTime: 10 * 60_000,
		queryFn: async () => (await call<{ questiontypes: string[] }>("mod_quiz_get_quiz_required_qtypes", { quizid: quizId! })).questiontypes
	});
}

/** Whether EM3 can run the quiz (or the unfinished attempt), and if not, why. */
export function useAttemptSupport(quiz: Pick<Quiz, "id"> | undefined, unfinished: Pick<QuizAttempt, "id"> | undefined) {
	const access = useQuizAccess(quiz?.id);
	const qtypes = useRequiredQtypes(quiz?.id);
	const attemptAccess = useAttemptAccess(quiz?.id, unfinished?.id);
	const blockers = access.data && qtypes.data ? attemptBlockers(access.data, qtypes.data, attemptAccess.data ?? null, !!unfinished) : [];
	return {
		pending: access.isPending || qtypes.isPending || attemptAccess.isPending,
		error: access.error ?? qtypes.error ?? attemptAccess.error,
		blockers,
		access: access.data,
		attemptAccess: attemptAccess.data
	};
}

export async function startAttemptWith(quizId: number, preflight: Preflight) {
	return (await call<{ attempt: QuizAttempt }>("mod_quiz_start_attempt", { quizid: quizId, preflightdata: preflight })).attempt;
}

/** One page of an attempt in progress. Moodle also records it as the attempt's current page. */
export const attemptPage = (attemptId: number, page: number, preflight: Preflight) => call<AttemptPage>("mod_quiz_get_attempt_data", { attemptid: attemptId, page, preflightdata: preflight });

/** Every question's state, for the navigator and the summary. Read-only. */
export const attemptSummary = (attemptId: number, preflight: Preflight) => call<AttemptSummary>("mod_quiz_get_attempt_summary", { attemptid: attemptId, preflightdata: preflight });

export const attemptEndTime = async (quizId: number, attemptId: number) =>
	(await call<AttemptAccess>("mod_quiz_get_attempt_access_information", { quizid: quizId, attemptid: attemptId })).endtime ?? 0;

/** Autosave: stores the answers without grading or moving the attempt on. */
export const saveAttempt = (attemptId: number, data: Field[], preflight: Preflight) =>
	call<{ status: boolean; warnings?: { message: string }[] }>("mod_quiz_save_attempt", { attemptid: attemptId, data, preflightdata: preflight });

/** Processes the page's answers (page change, "Check"), or finishes the attempt. */
export const processAttempt = (attemptId: number, data: Field[], preflight: Preflight, opts: { finish?: boolean; timeup?: boolean } = {}) =>
	call<{ state: QuizAttempt["state"]; warnings?: { message: string }[] }>("mod_quiz_process_attempt", {
		attemptid: attemptId,
		data,
		finishattempt: !!opts.finish,
		timeup: !!opts.timeup,
		preflightdata: preflight
	});
