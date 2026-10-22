import { call, callMany, uploadToDraft } from "@/lib/moodle/client";
import { fileUrl } from "@/lib/moodle/files";
import type { Assignment, AssignmentsResponse, InlineFile, SubmissionStatus } from "@/lib/moodle/types";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { t } from "./messages";

export function assignmentsQuery(courseIds: number[]) {
	const ids = [...courseIds].sort((a, b) => a - b);
	return queryOptions({
		queryKey: ["assignments", ids],
		queryFn: async () => {
			const res = await call<AssignmentsResponse>("mod_assign_get_assignments", { courseids: ids });
			return res.courses.flatMap(c => c.assignments);
		},
		enabled: ids.length > 0,
		staleTime: 5 * 60_000
	});
}

export const useAssignments = (courseIds: number[]) => useQuery(assignmentsQuery(courseIds));

export function submissionStatusQuery(assignid: number) {
	return queryOptions({
		queryKey: ["submission", assignid],
		queryFn: () => call<SubmissionStatus>("mod_assign_get_submission_status", { assignid }),
		staleTime: 60_000
	});
}

export const useSubmissionStatus = (assignid: number | undefined) => useQuery({ ...submissionStatusQuery(assignid ?? 0), enabled: !!assignid });

/** Submission status for many assignments in a single request; also primes the per-assignment cache. */
export function useSubmissionStatuses(assignIds: number[]) {
	const qc = useQueryClient();
	const ids = [...assignIds].sort((a, b) => a - b);
	return useQuery({
		queryKey: ["submissions", ids],
		enabled: ids.length > 0,
		staleTime: 60_000,
		queryFn: async ({ signal }) => {
			const results = await callMany<SubmissionStatus>(
				ids.map(assignid => ({ fn: "mod_assign_get_submission_status", args: { assignid } })),
				signal
			);
			const map: Record<number, SubmissionStatus> = {};
			results.forEach((r, i) => {
				if (!r) return;
				map[ids[i]] = r;
				qc.setQueryData(submissionStatusQuery(ids[i]).queryKey, r);
			});
			return map;
		}
	});
}

export type TaskState = "upcoming" | "todo" | "late" | "closed" | "submitted" | "graded";

/** Translated state names; getters so the label follows the current language. */
export const TASK_STATE_LABEL: Record<TaskState, string> = {
	get upcoming() {
		return t("stateUpcoming");
	},
	get todo() {
		return t("stateTodo");
	},
	get late() {
		return t("stateLate");
	},
	get closed() {
		return t("stateClosed");
	},
	get submitted() {
		return t("stateSubmitted");
	},
	get graded() {
		return t("stateGraded");
	}
};

/** Label for a task's state; quizzes say "attempted" instead of "submitted". */
export const taskStateLabel = (state: TaskState, kind: "assign" | "quiz" = "assign") => (kind === "quiz" && state === "submitted" ? t("quizAttempted") : TASK_STATE_LABEL[state]);

export function submissionFiles(status: SubmissionStatus | undefined): InlineFile[] {
	const sub = status?.lastattempt?.submission ?? status?.lastattempt?.teamsubmission;
	return sub?.plugins?.find(p => p.type === "file")?.fileareas?.flatMap(a => a.files ?? []) ?? [];
}

export function taskState(a: Assignment, status: SubmissionStatus | undefined, now = Date.now() / 1000): TaskState {
	const sub = status?.lastattempt?.submission ?? status?.lastattempt?.teamsubmission;
	if (status?.feedback || status?.lastattempt?.graded) return "graded";
	if (sub?.status === "submitted") return "submitted";
	if (a.allowsubmissionsfromdate && a.allowsubmissionsfromdate > now) return "upcoming";
	const extension = status?.lastattempt?.extensionduedate ?? 0;
	const due = Math.max(a.duedate, extension);
	if (!due || due > now) return "todo";
	if (a.cutoffdate && a.cutoffdate < now) return "closed";
	return "late";
}

export interface AssignRules {
	fileEnabled: boolean;
	textEnabled: boolean;
	maxFiles: number;
	maxBytes: number;
	accept: string[];
	wordLimit?: number;
}

const cfg = (a: Assignment, plugin: string, name: string) => a.configs.find(c => c.subtype === "assignsubmission" && c.plugin === plugin && c.name === name)?.value;

/** E3 mixes extension lists with Moodle type groups ("document"). Expand the common groups. */
const TYPE_GROUPS: Record<string, string[]> = {
	document: [".pdf", ".doc", ".docx", ".odt", ".rtf", ".txt"],
	presentation: [".ppt", ".pptx", ".odp", ".key"],
	spreadsheet: [".xls", ".xlsx", ".ods", ".csv"],
	archive: [".zip", ".rar", ".7z", ".tar", ".gz"],
	image: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic"],
	web_image: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
	audio: [".mp3", ".m4a", ".wav"],
	video: [".mp4", ".mov", ".webm"],
	html_track: [".vtt"]
};

export function assignRules(a: Assignment): AssignRules {
	const raw = (cfg(a, "file", "filetypeslist") ?? "")
		.split(/[,;\s]+/)
		.map(s => s.trim().toLowerCase())
		.filter(Boolean);
	const accept = [...new Set(raw.flatMap(t => TYPE_GROUPS[t] ?? (t.startsWith(".") ? [t] : t === "*" ? [] : [`.${t}`])))];
	return {
		fileEnabled: cfg(a, "file", "enabled") === "1",
		textEnabled: cfg(a, "onlinetext", "enabled") === "1",
		maxFiles: Number(cfg(a, "file", "maxfilesubmissions") ?? 20),
		maxBytes: Number(cfg(a, "file", "maxsubmissionsizebytes") ?? 0),
		accept,
		wordLimit: Number(cfg(a, "onlinetext", "wordlimit") ?? 0) || undefined
	};
}

interface SubmitInput {
	assignment: Assignment;
	/** Files already on E3 that should stay in the submission. */
	keep: InlineFile[];
	add: File[];
	text?: string;
	acceptStatement: boolean;
	onProgress?: (stage: "preparing" | "uploading" | "saving" | "submitting", fraction?: number) => void;
}

/**
 * Replaces the submission with `keep` + `add`. Moodle's file manager semantics
 * replace the whole file area, so kept files are re-uploaded from E3 first.
 */
export function useSubmitAssignment() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async ({ assignment, keep, add, text, acceptStatement, onProgress }: SubmitInput) => {
			const rules = assignRules(assignment);
			const plugindata: Record<string, unknown> = {};
			if (rules.fileEnabled) {
				onProgress?.("preparing");
				const kept = await Promise.all(
					keep.map(async f => {
						const blob = await (await fetch(fileUrl(f.fileurl))).blob();
						return new File([blob], f.filename, { type: f.mimetype || blob.type });
					})
				);
				const all = [...kept, ...add];
				onProgress?.("uploading", 0);
				const itemid = all.length ? await uploadToDraft(all, 0, p => onProgress?.("uploading", p)) : (await call<{ itemid: number }>("core_files_get_unused_draft_itemid")).itemid;
				plugindata.files_filemanager = itemid;
			}
			if (rules.textEnabled && text !== undefined) plugindata.onlinetext_editor = { text, format: 1, itemid: 0 };

			onProgress?.("saving");
			const warnings = await call<{ item: string; warningcode: string; message: string }[]>("mod_assign_save_submission", { assignmentid: assignment.id, plugindata: plugindata as never });
			if (warnings.length) throw new Error(warnings.map(w => w.message).join("\n"));

			if (assignment.submissiondrafts) {
				onProgress?.("submitting");
				const w2 = await call<{ message: string }[]>("mod_assign_submit_for_grading", { assignmentid: assignment.id, acceptsubmissionstatement: acceptStatement });
				if (w2.length) throw new Error(w2.map(w => w.message).join("\n"));
			}
		},
		onSettled: (_d, _e, v) => {
			void qc.invalidateQueries({ queryKey: ["submission", v.assignment.id] });
			void qc.invalidateQueries({ queryKey: ["submissions"] });
		}
	});
}
