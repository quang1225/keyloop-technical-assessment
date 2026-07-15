export const DEMO_DATE = "2026-07-15";
export const DEMO_CLOCK = "07:00";
export const TIME_ZONE = "Europe/London";

export function formatSlotLabel(iso: string, timeZone = TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}

export function isSlotFree(slotIso: string, freeSlots: string[]): boolean {
  return freeSlots.includes(slotIso);
}

export function shiftDate(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

export function formatDayHeading(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(dt);
}

export function isWeekday(isoDate: string): boolean {
  const [y, m, d] = isoDate.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day >= 1 && day <= 5;
}

/** Nearby weekdays around a pivot date (for quick-pick chips). */
export function nearbyWeekdays(pivot: string, count = 5): string[] {
  const out: string[] = [];
  let offset = 0;
  while (out.length < count) {
    const candidate = shiftDate(pivot, offset);
    if (isWeekday(candidate)) out.push(candidate);
    offset += 1;
    if (offset > 14) break;
  }
  return out;
}

const DAY_START_MIN = 8 * 60;
const DAY_END_MIN = 17 * 60;
const WORKING_MINUTES = DAY_END_MIN - DAY_START_MIN;

/** Fraction of the working day (0–1) occupied by appointments for one bay. */
export function bayUtilization(
  appointments: { starts_at: string; ends_at: string }[],
  timeZone = TIME_ZONE,
): number {
  if (appointments.length === 0) return 0;
  let busy = 0;
  for (const appt of appointments) {
    const start = hhmmToMinutes(formatSlotLabel(appt.starts_at, timeZone));
    const end = hhmmToMinutes(formatSlotLabel(appt.ends_at, timeZone));
    const clippedStart = Math.max(DAY_START_MIN, start);
    const clippedEnd = Math.min(DAY_END_MIN, end);
    if (clippedEnd > clippedStart) busy += clippedEnd - clippedStart;
  }
  return Math.min(1, busy / WORKING_MINUTES);
}

function hhmmToMinutes(label: string): number {
  const [hour, minute] = label.split(":").map(Number);
  return hour * 60 + minute;
}

/** Cycle through free slot ISOs (wraps). */
export function nextFreeSlot(current: string | null, freeSlots: string[], delta: 1 | -1): string | null {
  if (freeSlots.length === 0) return null;
  if (!current) return freeSlots[delta === 1 ? 0 : freeSlots.length - 1];
  const idx = freeSlots.indexOf(current);
  if (idx < 0) return freeSlots[0];
  const next = (idx + delta + freeSlots.length) % freeSlots.length;
  return freeSlots[next];
}
