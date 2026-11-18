import type { TimetableEntry } from "../preferences/store";
import { useEffect, useState } from "react";
import { dayIndex, periodByCode, periodEndMinutes, periodStartMinutes, slotBlocks } from "./periods";

export interface ClassBlock {
	courseId: number;
	day: number;
	from: string;
	to: string;
	start: number;
	end: number;
	room?: string;
}

export function blocksFor(timetable: Record<string, TimetableEntry>): ClassBlock[] {
	return Object.entries(timetable).flatMap(([id, entry]) =>
		slotBlocks(entry.slots).map(b => ({ courseId: Number(id), ...b, start: periodStartMinutes(b.from), end: periodEndMinutes(b.to), room: entry.room }))
	);
}

export interface ClassMoment {
	now?: ClassBlock;
	next?: ClassBlock;
	/** Minutes until `next` starts, or until `now` ends. */
	minutes?: number;
	/** 0..1 through the current class. */
	progress?: number;
}

export function classMoment(timetable: Record<string, TimetableEntry>, at = new Date()): ClassMoment {
	const day = dayIndex(at);
	const t = at.getHours() * 60 + at.getMinutes();
	const today = blocksFor(timetable)
		.filter(b => b.day === day)
		.sort((a, b) => a.start - b.start);
	const now = today.find(b => t >= b.start && t < b.end);
	const next = today.find(b => b.start > t);
	if (now) return { now, next, minutes: now.end - t, progress: (t - now.start) / (now.end - now.start) };
	return { next, minutes: next ? next.start - t : undefined };
}

/** Re-renders every 30 s so time-based UI (now/next class, countdowns) stays fresh. */
export function useNow(intervalMs = 30_000) {
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		const id = setInterval(() => setNow(new Date()), intervalMs);
		return () => clearInterval(id);
	}, [intervalMs]);
	return now;
}

export const blockTime = (b: { from: string; to: string }) => `${periodByCode(b.from)!.start}–${periodByCode(b.to)!.end}`;
