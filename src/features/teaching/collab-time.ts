// Release times are picked in Taipei time whatever the device's zone. Import-free for the tests.

/** Taipei wall-clock date and time ("2026-10-24", "20:00") for an epoch ms, and back. Taiwan has no DST. */
const TPE_OFFSET = 8 * 3600_000;
export const toTaipei = (ms: number) => {
	const iso = new Date(ms + TPE_OFFSET).toISOString();
	return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
};
export const fromTaipei = (date: string, time: string) => {
	const ms = Date.parse(`${date}T${time}:00Z`);
	return Number.isNaN(ms) ? null : ms - TPE_OFFSET;
};
