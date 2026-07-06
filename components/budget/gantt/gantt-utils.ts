import { buildWorkScheduleMonthlyDistributionsFromRange } from "@/lib/calculations/work-schedule";

export function addIsoDays(startDate: string, days: number): string {
  const date = new Date(`${startDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function diffInDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export function pixelsToDays(deltaPx: number, timelineColumnWidth: number): number {
  if (timelineColumnWidth <= 0) return 0;
  return Math.round(deltaPx / timelineColumnWidth);
}

export function clampDateToTimeline(date: string, timelineStartIso: string | null, timelineEndIso: string | null): string {
  if (timelineStartIso && date < timelineStartIso) return timelineStartIso;
  if (timelineEndIso && date > timelineEndIso) return timelineEndIso;
  return date;
}

export type GanttBarChangeResult = {
  startDate: string;
  endDate: string;
  durationDays: number;
  monthlyDistributions: Array<{ year: number; month: number; percentage: number }>;
  error?: string;
};

export function computeDraggedBarDates(
  originalStartDate: string,
  originalEndDate: string,
  originalDurationDays: number,
  deltaPx: number,
  timelineColumnWidth: number,
  timelineStartIso: string | null,
  timelineEndIso: string | null,
): GanttBarChangeResult {
  const deltaDays = pixelsToDays(deltaPx, timelineColumnWidth);
  let nextStartDate = addIsoDays(originalStartDate, deltaDays);
  let nextEndDate = addIsoDays(originalEndDate, deltaDays);

  nextStartDate = clampDateToTimeline(nextStartDate, timelineStartIso, timelineEndIso);
  nextEndDate = addIsoDays(nextStartDate, originalDurationDays - 1);
  nextEndDate = clampDateToTimeline(nextEndDate, timelineStartIso, timelineEndIso);

  // Recalculate duration if clamping changed it
  const nextDurationDays = diffInDays(nextStartDate, nextEndDate) + 1;

  return {
    startDate: nextStartDate,
    endDate: nextEndDate,
    durationDays: nextDurationDays,
    monthlyDistributions: buildWorkScheduleMonthlyDistributionsFromRange(nextStartDate, nextEndDate),
  };
}

export function computeResizedBarDates(
  originalStartDate: string,
  originalEndDate: string,
  originalDurationDays: number,
  deltaPx: number,
  timelineColumnWidth: number,
  mode: "resizing-left" | "resizing-right",
  timelineStartIso: string | null,
  timelineEndIso: string | null,
): GanttBarChangeResult {
  const deltaDays = pixelsToDays(deltaPx, timelineColumnWidth);

  if (mode === "resizing-left") {
    let nextStartDate = addIsoDays(originalStartDate, deltaDays);
    nextStartDate = clampDateToTimeline(nextStartDate, timelineStartIso, timelineEndIso);

    // Ensure start <= end and at least 1 day
    if (nextStartDate > originalEndDate) {
      nextStartDate = originalEndDate;
    }

    const nextDurationDays = diffInDays(nextStartDate, originalEndDate) + 1;

    return {
      startDate: nextStartDate,
      endDate: originalEndDate,
      durationDays: nextDurationDays,
      monthlyDistributions: buildWorkScheduleMonthlyDistributionsFromRange(nextStartDate, originalEndDate),
    };
  }

  // resize-right
  let nextEndDate = addIsoDays(originalEndDate, deltaDays);
  nextEndDate = clampDateToTimeline(nextEndDate, timelineStartIso, timelineEndIso);

  if (nextEndDate < originalStartDate) {
    nextEndDate = originalStartDate;
  }

  const nextDurationDays = diffInDays(originalStartDate, nextEndDate) + 1;

  return {
    startDate: originalStartDate,
    endDate: nextEndDate,
    durationDays: nextDurationDays,
    monthlyDistributions: buildWorkScheduleMonthlyDistributionsFromRange(originalStartDate, nextEndDate),
  };
}

export function formatDateLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  return date.toLocaleDateString("es-PE", { day: "2-digit", month: "short", timeZone: "UTC" });
}
