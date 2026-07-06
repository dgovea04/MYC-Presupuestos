/**
 * Work calendar utilities for business day calculations.
 *
 * Work days bitmask (0=Monday, 6=Sunday):
 *   0 = Monday    (1 << 0 = 1)
 *   1 = Tuesday   (1 << 1 = 2)
 *   2 = Wednesday (1 << 2 = 4)
 *   3 = Thursday  (1 << 3 = 8)
 *   4 = Friday    (1 << 4 = 16)
 *   5 = Saturday  (1 << 5 = 32)
 *   6 = Sunday    (1 << 6 = 64)
 *
 * Default Mon-Fri: 1+2+4+8+16 = 31
 *
 * Exceptions: a Map from ISO date string (YYYY-MM-DD) to "HOLIDAY" or "WORK_DAY".
 * HOLIDAY overrides a normally-working day to non-working.
 * WORK_DAY overrides a normally-non-working day to working.
 */

export type CalendarExceptionMap = ReadonlyMap<string, "HOLIDAY" | "WORK_DAY">;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function parseIsoDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Fecha invalida");
  }
  return date;
}

/** Get the day-of-week index (0=Monday, 6=Sunday) for a Date */
export function getDayIndex(date: Date): number {
  // JS getDay(): 0=Sun, 1=Mon, ..., 6=Sat
  // Convert to 0=Mon, ..., 6=Sun
  const jsDay = date.getUTCDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

/** Check if a given date is a work day according to the bitmask and optional exceptions */
export function isWorkDay(
  dateOrIso: string | Date,
  workDaysBitmask: number,
  exceptions?: CalendarExceptionMap,
): boolean {
  const date = typeof dateOrIso === "string" ? parseIsoDate(dateOrIso) : dateOrIso;
  const iso = date.toISOString().slice(0, 10);

  // Exceptions override the bitmask
  if (exceptions) {
    const exception = exceptions.get(iso);
    if (exception === "HOLIDAY") return false;
    if (exception === "WORK_DAY") return true;
  }

  const dayIndex = getDayIndex(date);
  const bit = 1 << dayIndex;
  return (workDaysBitmask & bit) !== 0;
}

/** Count the number of work days between two dates (inclusive), accounting for exceptions */
export function countWorkDays(
  startIso: string,
  endIso: string,
  workDaysBitmask: number,
  exceptions?: CalendarExceptionMap,
): number {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  const cursor = new Date(start);

  let count = 0;
  while (cursor.getTime() <= end.getTime()) {
    if (isWorkDay(cursor, workDaysBitmask, exceptions)) {
      count++;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return count;
}

/** Count total calendar days between two dates (inclusive) */
export function countCalendarDays(startIso: string, endIso: string): number {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
}

/** Add N work days to a date, skipping non-work days. Returns ISO string. Accounts for exceptions. */
export function addWorkDays(
  startIso: string,
  workDays: number,
  workDaysBitmask: number,
  exceptions?: CalendarExceptionMap,
): string {
  const cursor = new Date(`${startIso}T00:00:00.000Z`);

  let added = 0;
  while (added < workDays) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isWorkDay(cursor, workDaysBitmask, exceptions)) {
      added++;
    }
  }

  return cursor.toISOString().slice(0, 10);
}

/** Get the ISO string for the next work day on or after the given date */
export function nextWorkDay(
  iso: string,
  workDaysBitmask: number,
  exceptions?: CalendarExceptionMap,
): string {
  const date = parseIsoDate(iso);
  if (isWorkDay(date, workDaysBitmask, exceptions)) {
    return iso;
  }
  return addWorkDays(iso, 1, workDaysBitmask, exceptions);
}

/** Convert calendar days to approximate work days given a bitmask */
export function calendarDaysToWorkDays(calendarDays: number, workDaysBitmask: number): number {
  const workDaysPerWeek = countBits(workDaysBitmask);
  if (workDaysPerWeek === 0) return calendarDays;
  return Math.ceil((calendarDays * workDaysPerWeek) / 7);
}

/** Convert work days to approximate calendar days given a bitmask */
export function workDaysToCalendarDays(workDays: number, workDaysBitmask: number): number {
  const workDaysPerWeek = countBits(workDaysBitmask);
  if (workDaysPerWeek === 0) return workDays;
  return Math.ceil((workDays * 7) / workDaysPerWeek);
}

export function countBits(n: number): number {
  let count = 0;
  while (n > 0) {
    count += n & 1;
    n >>>= 1;
  }
  return count;
}

const DAY_LABELS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

/** Format a work days bitmask into a human-readable label (e.g. "Lun-Vie", "Lun, Mar, Mie") */
export function formatWorkDaysLabel(workDays: number): string {
  if (workDays === 0) return "Sin dias";
  if (workDays === 127) return "Todos los dias";
  if (workDays === 31) return "Lun-Vie";

  const active = DAY_LABELS.filter((_, i) => (workDays & (1 << i)) !== 0);
  if (active.length <= 3) return active.join(", ");

  // Check if consecutive days: Mon-Fri, Mon-Sat
  const firstIndex = DAY_LABELS.indexOf(active[0]);
  const lastIndex = DAY_LABELS.indexOf(active[active.length - 1]);
  if (active.length > 3 && firstIndex >= 0 && lastIndex > firstIndex) {
    return `${DAY_LABELS[firstIndex]}-${DAY_LABELS[lastIndex]}`;
  }

  return `${active.length} dias`;
}
