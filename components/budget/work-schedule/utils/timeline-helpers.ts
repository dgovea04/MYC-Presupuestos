"use client";

import type { TimelineDay } from "../types";

export function buildTimelineDays(startDate: string | null, endDate: string | null): TimelineDay[] {
  if (!startDate || !endDate) {
    return [];
  }

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start.getTime() > end.getTime()) {
    return [];
  }

  const days: TimelineDay[] = [];
  const cursor = new Date(start);

  while (cursor.getTime() <= end.getTime()) {
    days.push({
      iso: cursor.toISOString().slice(0, 10),
      date: new Date(cursor),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

export function getTimelineColumnStartX(index: number, timelineDayWidth: number, timelineDayGap: number) {
  return index * (timelineDayWidth + timelineDayGap);
}

export function getTimelineColumnEndX(index: number, timelineDayWidth: number, timelineDayGap: number) {
  return getTimelineColumnStartX(index, timelineDayWidth, timelineDayGap) + timelineDayWidth;
}

export function groupTimelineWeeks(days: TimelineDay[]) {
  const weeks: { days: TimelineDay[]; startIndex: number }[] = [];
  let currentWeek: TimelineDay[] = [];

  for (let i = 0; i < days.length; i++) {
    currentWeek.push(days[i]);

    const isLastDay = i === days.length - 1;
    const nextDay = !isLastDay ? days[i + 1] : null;
    const isEndOfWeek = nextDay ? nextDay.date.getUTCDay() === 1 : true;

    if (isEndOfWeek) {
      weeks.push({ days: [...currentWeek], startIndex: i - currentWeek.length + 1 });
      currentWeek = [];
    }
  }

  return weeks;
}

export function groupTimelineMonths(days: TimelineDay[]) {
  const months: { year: number; month: number; days: TimelineDay[]; startIndex: number }[] = [];

  for (let i = 0; i < days.length; ) {
    const day = days[i];
    const year = day.date.getUTCFullYear();
    const month = day.date.getUTCMonth();

    const monthDays: TimelineDay[] = [];
    let j = i;

    while (
      j < days.length &&
      days[j].date.getUTCFullYear() === year &&
      days[j].date.getUTCMonth() === month
    ) {
      monthDays.push(days[j]);
      j++;
    }

    months.push({ year, month: month + 1, days: monthDays, startIndex: i });
    i = j;
  }

  return months;
}
