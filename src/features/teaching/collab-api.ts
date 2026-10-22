import { useServer, useServerReady } from "@/features/server/store";
import { api } from "@/lib/server/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

// TA collaboration on the EM3 server (worker/grading). Server version only: every hook
// here is disabled unless the server is linked, so the local version never calls it.

export interface Grader {
	id: number;
	name: string;
	roles?: string[];
}

export interface Allocations {
	/** Student Moodle id → grader Moodle id. */
	allocations: Record<string, number>;
	graders: Grader[];
	updatedAt: number | null;
	updatedByName: string | null;
}

export interface Lock {
	student: number;
	grader: number;
	graderName: string;
	expiresAt: number;
}

export interface Draft {
	student: number;
	grade: number | null;
	/** Feedback comment HTML, or null when the assignment has no comment feedback. */
	feedback: string | null;
	grader: number;
	graderName: string;
	updatedAt: number;
}

export interface Release {
	releaseAt: number;
	notifyStudents: boolean;
	status: "scheduled" | "running" | "released" | "failed" | "cancelled";
	error: string | null;
	releasedAt: number | null;
	attempts: number;
	ownerName: string;
	updatedAt: number;
}

export interface AssignCollab {
	locks: Lock[];
	drafts: Draft[];
	release: Release | null;
}

/** Moodle user id of the server account, i.e. "me" in locks, drafts and allocations. */
export const useMe = () => useServer(s => s.account?.userid);

/** While true, saving writes a server draft instead of Moodle. */
export const isHolding = (r: Release | null | undefined) => r?.status === "scheduled" || r?.status === "failed";

const courseKey = (courseId: number) => ["collab", "course", courseId];
const assignKey = (assignId: number | undefined) => ["collab", "assign", assignId];

export function useAllocations(courseId: number) {
	const ready = useServerReady();
	return useQuery({
		queryKey: [...courseKey(courseId), "alloc"],
		enabled: ready,
		staleTime: 60_000,
		queryFn: () => api<Allocations>(`grading/${courseId}/allocations`)
	});
}

export function useGraders(courseId: number, enabled: boolean) {
	const ready = useServerReady();
	return useQuery({
		queryKey: [...courseKey(courseId), "graders"],
		enabled: ready && enabled,
		staleTime: 10 * 60_000,
		queryFn: async () => (await api<{ graders: Grader[] }>(`grading/${courseId}/graders`)).graders
	});
}

export function useSaveAllocations(courseId: number) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (allocations: Record<number, number>) => api<{ count: number }>(`grading/${courseId}/allocations`, { method: "PUT", body: { allocations } }),
		onSuccess: () => void qc.invalidateQueries({ queryKey: courseKey(courseId) })
	});
}

/** Locks, drafts and the release of one assignment, refreshed every 20 s. */
export function useAssignCollab(courseId: number, assignId: number | undefined) {
	const ready = useServerReady();
	return useQuery({
		queryKey: assignKey(assignId),
		enabled: ready && !!assignId,
		refetchInterval: 20_000,
		staleTime: 10_000,
		queryFn: () => api<AssignCollab>(`grading/${courseId}/assign/${assignId}`)
	});
}

const HEARTBEAT = 45_000;

/**
 * Holds the "I'm grading this student" lock while mounted. Returns the lock as the server
 * sees it, so a student someone else opened first shows who.
 */
export function useGradingLock(courseId: number, assignId: number | undefined, student: number) {
	const ready = useServerReady();
	const qc = useQueryClient();
	const [lock, setLock] = useState<Lock | null>(null);
	useEffect(() => {
		if (!ready || !assignId) return;
		const path = `grading/${courseId}/assign/${assignId}/locks/${student}`;
		let alive = true;
		const beat = () =>
			api<{ lock: Lock | null }>(path, { method: "POST" })
				.then(r => alive && setLock(r.lock))
				.catch(() => {});
		void beat().then(() => qc.invalidateQueries({ queryKey: assignKey(assignId) }));
		const timer = setInterval(beat, HEARTBEAT);
		// Closing the tab releases the lock too; keepalive lets the request outlive the page.
		const release = () => void fetch(`/api/${path}`, { method: "DELETE", credentials: "same-origin", keepalive: true }).catch(() => {});
		window.addEventListener("pagehide", release);
		return () => {
			alive = false;
			clearInterval(timer);
			window.removeEventListener("pagehide", release);
			release();
		};
	}, [ready, courseId, assignId, student, qc]);
	return lock;
}

export function useCollabActions(courseId: number, assignId: number | undefined) {
	const qc = useQueryClient();
	const base = `grading/${courseId}/assign/${assignId}`;
	const refresh = () => void qc.invalidateQueries({ queryKey: assignKey(assignId) });
	const refreshMoodle = () => void qc.invalidateQueries({ queryKey: ["teach"] });
	return {
		schedule: useMutation({ mutationFn: (releaseAt: number) => api(`${base}/release`, { method: "PUT", body: { releaseAt, notifyStudents: true } }), onSettled: refresh }),
		cancel: useMutation({ mutationFn: () => api(`${base}/release`, { method: "DELETE" }), onSettled: refresh }),
		writeNow: useMutation({
			mutationFn: () => api<{ written: number }>(`${base}/release/now`, { method: "POST" }),
			onSettled: () => {
				refresh();
				refreshMoodle();
			}
		}),
		discardAll: useMutation({ mutationFn: () => api(`${base}/drafts`, { method: "DELETE" }), onSettled: refresh }),
		discard: useMutation({ mutationFn: (student: number) => api(`${base}/drafts/${student}`, { method: "DELETE" }), onSettled: refresh })
	};
}

export interface DraftInput {
	grade: number | null;
	feedback: string | null;
	/** The draft's updatedAt when it was loaded (null: there was none); omit to overwrite whatever is there. */
	expectedUpdatedAt?: number | null;
}

export const saveDraft = (courseId: number, assignId: number, student: number, input: DraftInput) =>
	api<{ draft: Draft }>(`grading/${courseId}/assign/${assignId}/drafts/${student}`, { method: "PUT", body: input });

export const saveDrafts = (courseId: number, assignId: number, drafts: { student: number; grade: number | null; feedback: string | null }[]) =>
	api<{ count: number }>(`grading/${courseId}/assign/${assignId}/drafts`, { method: "PUT", body: { drafts } });

/** The held grade as it is now (after a 409 from saveDraft). */
export const fetchDraft = async (courseId: number, assignId: number, student: number) => (await api<AssignCollab>(`grading/${courseId}/assign/${assignId}`)).drafts.find(d => d.student === student);

export const deleteDraft = (courseId: number, assignId: number, student: number) => api(`grading/${courseId}/assign/${assignId}/drafts/${student}`, { method: "DELETE" });

export const invalidateCollab = (qc: ReturnType<typeof useQueryClient>, assignId: number | undefined) => qc.invalidateQueries({ queryKey: assignKey(assignId) });
