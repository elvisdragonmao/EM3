export const LEAD_HOURS = [0.25, 1, 3, 6, 24, 72, 168];
export const MAX_LEADS = LEAD_HOURS.length;
export const DEFAULT_LEADS = [24, 3];

// Older settings accepted any whole-hour value up to a week.
export const validLead = (h: unknown): h is number => typeof h === "number" && (h === 0.25 || (Number.isInteger(h) && h >= 1 && h <= 168));
