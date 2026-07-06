import { prisma } from "@/lib/db/prisma";
import type { CalendarExceptionMap } from "@/lib/work-schedule/calendar";

export type WorkCalendarRecord = {
  id: string;
  name: string;
  workDays: number;
  workHoursPerDay: number;
  createdAt: string;
  updatedAt: string;
};

export type WorkCalendarSummary = Pick<WorkCalendarRecord, "id" | "name" | "workDays" | "workHoursPerDay">;

export type WorkCalendarExceptionRecord = {
  id: string;
  workCalendarId: string;
  date: string;
  type: "HOLIDAY" | "WORK_DAY";
  description: string | null;
};

export async function getWorkCalendars(): Promise<WorkCalendarSummary[]> {
  const calendars = await prisma.workCalendar.findMany({
    select: {
      id: true,
      name: true,
      workDays: true,
      workHoursPerDay: true,
    },
    orderBy: { name: "asc" },
  });

  return calendars.map((calendar) => ({
    ...calendar,
    workHoursPerDay: Number(calendar.workHoursPerDay),
  }));
}

export async function getWorkCalendarById(id: string): Promise<WorkCalendarRecord | null> {
  const calendar = await prisma.workCalendar.findUnique({
    where: { id },
  });

  if (!calendar) return null;

  return {
    ...calendar,
    workHoursPerDay: Number(calendar.workHoursPerDay),
    createdAt: calendar.createdAt.toISOString(),
    updatedAt: calendar.updatedAt.toISOString(),
  };
}

export async function createWorkCalendar(input: { name: string; workDays?: number; workHoursPerDay?: number }): Promise<WorkCalendarRecord> {
  const calendar = await prisma.workCalendar.create({
    data: {
      name: input.name,
      workDays: input.workDays ?? 31,
      workHoursPerDay: input.workHoursPerDay ?? 8,
    },
  });

  return {
    ...calendar,
    workHoursPerDay: Number(calendar.workHoursPerDay),
    createdAt: calendar.createdAt.toISOString(),
    updatedAt: calendar.updatedAt.toISOString(),
  };
}

export async function updateWorkCalendar(
  id: string,
  input: { name?: string; workDays?: number; workHoursPerDay?: number },
): Promise<WorkCalendarRecord> {
  const calendar = await prisma.workCalendar.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.workDays !== undefined ? { workDays: input.workDays } : {}),
      ...(input.workHoursPerDay !== undefined ? { workHoursPerDay: input.workHoursPerDay } : {}),
    },
  });

  return {
    ...calendar,
    workHoursPerDay: Number(calendar.workHoursPerDay),
    createdAt: calendar.createdAt.toISOString(),
    updatedAt: calendar.updatedAt.toISOString(),
  };
}

export async function deleteWorkCalendar(id: string): Promise<void> {
  // Cascade delete handles project_work_calendars and exceptions automatically
  await prisma.workCalendar.delete({
    where: { id },
  });
}

// ── Exceptions ──

export async function getCalendarExceptions(workCalendarId: string): Promise<WorkCalendarExceptionRecord[]> {
  const exceptions = await prisma.workCalendarException.findMany({
    where: { workCalendarId },
    orderBy: { date: "asc" },
  });

  return exceptions.map((e) => ({
    id: e.id,
    workCalendarId: e.workCalendarId,
    date: e.date.toISOString().slice(0, 10),
    type: e.type as "HOLIDAY" | "WORK_DAY",
    description: e.description,
  }));
}

/** Build a CalendarExceptionMap from DB exception records (keyed by ISO date) */
export function buildExceptionMap(
  exceptions: Pick<WorkCalendarExceptionRecord, "date" | "type">[],
): CalendarExceptionMap {
  const map = new Map<string, "HOLIDAY" | "WORK_DAY">();
  for (const e of exceptions) {
    map.set(e.date, e.type);
  }
  return map;
}

export async function createCalendarException(input: {
  workCalendarId: string;
  date: string;
  type?: "HOLIDAY" | "WORK_DAY";
  description?: string;
}): Promise<WorkCalendarExceptionRecord> {
  const exception = await prisma.workCalendarException.create({
    data: {
      workCalendarId: input.workCalendarId,
      date: new Date(`${input.date}T00:00:00.000Z`),
      type: input.type ?? "HOLIDAY",
      description: input.description ?? null,
    },
  });

  return {
    id: exception.id,
    workCalendarId: exception.workCalendarId,
    date: exception.date.toISOString().slice(0, 10),
    type: exception.type as "HOLIDAY" | "WORK_DAY",
    description: exception.description,
  };
}

export async function updateCalendarException(
  id: string,
  input: { date?: string; type?: "HOLIDAY" | "WORK_DAY"; description?: string | null },
): Promise<WorkCalendarExceptionRecord> {
  const exception = await prisma.workCalendarException.update({
    where: { id },
    data: {
      ...(input.date !== undefined ? { date: new Date(`${input.date}T00:00:00.000Z`) } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    },
  });

  return {
    id: exception.id,
    workCalendarId: exception.workCalendarId,
    date: exception.date.toISOString().slice(0, 10),
    type: exception.type as "HOLIDAY" | "WORK_DAY",
    description: exception.description,
  };
}

export async function deleteCalendarException(id: string): Promise<void> {
  await prisma.workCalendarException.delete({
    where: { id },
  });
}
