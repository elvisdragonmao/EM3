import type { TaskState } from "@/features/assignments/api";
import { call, callMany } from "@/lib/moodle/client";
import type { InlineFile } from "@/lib/moodle/types";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { t } from "./messages";

// Quizzes are taken on E3 (EM3 never starts an attempt). EM3 reads the quiz
// settings, the student's own attempts and, once an attempt is finished, its
// review — the same page E3 shows after submitting, if the teacher allows it.

export interface Quiz {
	id: number;
	course: number;
	coursemodule: number;
	name: string;
	intro?: string;
	introfiles?: InlineFile[];
	timeopen: number;
	timeclose: number;
	timelimit: number;
	/** Attempts allowed; 0 = unlimited. */
	attempts: number;
	/** Maximum grade the quiz is scaled to. */
	grade: number;
	/** Sum of the question marks (raw attempt score is out of this). */
	sumgrades: number;
	decimalpoints?: number;
	/** 1 highest, 2 average, 3 first, 4 last attempt. */
	grademethod?: number;
	visible?: boolean;
}

export interface QuizAttempt {
	id: number;
	quiz: number;
	attempt: number;
	state: "inprogress" | "overdue" | "finished" | "abandoned";
	/** Raw score; null while hidden by the review settings or not graded yet. */
	sumgrades: number | null;
	timestart: number;
	timefinish: number;
}

export function quizzesQuery(courseIds: number[]) {
	const ids = [...courseIds].sort((a, b) => a - b);
	return queryOptions({
		queryKey: ["quizzes", ids],
		enabled: ids.length > 0,
		staleTime: 10 * 60_000,
		queryFn: async () => (await call<{ quizzes: Quiz[] }>("mod_quiz_get_quizzes_by_courses", { courseids: ids })).quizzes
	});
}

export const useQuizzes = (courseIds: number[]) => useQuery(quizzesQuery(courseIds));

/** The student's own attempts per quiz id, in one batched request. */
export function useQuizAttempts(quizIds: number[]) {
	const ids = [...quizIds].sort((a, b) => a - b);
	return useQuery({
		queryKey: ["quiz-attempts", ids],
		enabled: ids.length > 0,
		staleTime: 60_000,
		queryFn: async ({ signal }) => {
			const res = await callMany<{ attempts: QuizAttempt[] }>(
				ids.map(quizid => ({ fn: "mod_quiz_get_user_attempts", args: { quizid, status: "all" } })),
				signal
			);
			const map: Record<number, QuizAttempt[]> = {};
			res.forEach((r, i) => r && (map[ids[i]] = r.attempts));
			return map;
		}
	});
}

export function useBestGrade(quizId: number | undefined) {
	return useQuery({
		queryKey: ["quiz-best", quizId],
		enabled: !!quizId,
		staleTime: 60_000,
		queryFn: () => call<{ hasgrade: boolean; grade?: number }>("mod_quiz_get_user_best_grade", { quizid: quizId! })
	});
}

export interface ReviewQuestionRaw {
	slot: number;
	type: string;
	number?: number;
	html: string;
	state?: string;
	stateclass?: string;
	status?: string;
	mark?: string;
	maxmark?: number;
}

export interface AttemptReview {
	/** Scaled grade, or null when the teacher hides marks. */
	grade: number | string | null;
	attempt: QuizAttempt;
	questions: ReviewQuestionRaw[];
}

/** Every page of a finished attempt's review. Read-only: E3 logs a review only through mod_quiz_view_attempt_review, which EM3 never calls. */
export function useAttemptReview(attemptId: number | undefined) {
	return useQuery({
		queryKey: ["quiz-review", attemptId],
		enabled: !!attemptId,
		staleTime: 10 * 60_000,
		retry: false,
		queryFn: () => call<AttemptReview>("mod_quiz_get_attempt_review", { attemptid: attemptId!, page: -1 })
	});
}

/** A finished attempt counts as done; graded once E3 shows its score. */
export function quizState(q: Quiz, attempts: QuizAttempt[], now = Date.now() / 1000): TaskState {
	const done = attempts.filter(a => a.state === "finished");
	if (done.some(a => a.sumgrades !== null)) return "graded";
	if (done.length) return "submitted";
	if (q.timeopen > now) return "upcoming";
	if (q.timeclose && q.timeclose < now) return "closed";
	return "todo";
}

/** Scales a raw attempt score to the quiz grade, e.g. 3 of 4 marks on a quiz worth 10 → 7.5. */
export function scaledGrade(q: Quiz, sumgrades: number | null) {
	if (sumgrades === null || !q.sumgrades) return null;
	return (sumgrades / q.sumgrades) * q.grade;
}

/**
 * The quiz grade from finished attempts, following the teacher's grading method.
 * mod_quiz_get_user_best_grade hides the grade while an attempt is open; the
 * finished attempts still carry their scores.
 */
export function gradeFromAttempts(q: Quiz, attempts: QuizAttempt[]) {
	const scores = attempts
		.filter(a => a.state === "finished" && a.sumgrades !== null)
		.sort((a, b) => a.attempt - b.attempt)
		.map(a => scaledGrade(q, a.sumgrades)!);
	if (!scores.length) return null;
	if (q.grademethod === 2) return scores.reduce((n, x) => n + x, 0) / scores.length;
	if (q.grademethod === 3) return scores[0];
	if (q.grademethod === 4) return scores[scores.length - 1];
	return Math.max(...scores);
}

export const formatGrade = (n: number, q?: Pick<Quiz, "decimalpoints">) => String(Number(n.toFixed(q?.decimalpoints ?? 2)));

/** Short facts shown before leaving for E3 to take the quiz. */
export function quizNotes(q: Quiz, attempts: QuizAttempt[]): string[] {
	const notes: string[] = [];
	const finished = attempts.filter(a => a.state === "finished").length;
	if (attempts.some(a => a.state === "inprogress" || a.state === "overdue")) notes.push(t("noteUnfinished"));
	else if (finished) notes.push(t("noteFinished", finished));
	if (q.timelimit) notes.push(t("noteTimeLimit", Math.round(q.timelimit / 60)));
	notes.push(q.attempts ? t("noteAttempts", q.attempts) : t("noteUnlimited"));
	return notes;
}

export const quizE3Reason = () => t("e3Reason");

/** Questions of an attempt in progress, all pages at once. Read-only, unlike mod_quiz_get_attempt_data, which also moves the attempt's current page. */
export async function attemptQuestions(attemptId: number) {
	return (await call<{ questions: ReviewQuestionRaw[] }>("mod_quiz_get_attempt_summary", { attemptid: attemptId })).questions;
}

/**
 * Starts a new attempt on E3: the timer (if any) starts and an attempt is used.
 * Only called after the student confirms. Quizzes that need a password or other
 * preflight data are left to E3, whose error message is shown as is.
 */
export async function startAttempt(quizId: number) {
	return (await call<{ attempt: QuizAttempt }>("mod_quiz_start_attempt", { quizid: quizId })).attempt;
}
