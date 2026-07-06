import { describe, expect, it } from "vitest";
import {
  isWorkDay,
  countWorkDays,
  countCalendarDays,
  addWorkDays,
  nextWorkDay,
  getDayIndex,
  calendarDaysToWorkDays,
  workDaysToCalendarDays,
  parseIsoDate,
} from "./calendar";

describe("parseIsoDate", () => {
  it("parses a valid ISO date", () => {
    const date = parseIsoDate("2026-06-01");
    expect(date.getUTCFullYear()).toBe(2026);
    expect(date.getUTCMonth()).toBe(5); // June
    expect(date.getUTCDate()).toBe(1);
  });

  it("throws on invalid date", () => {
    expect(() => parseIsoDate("not-a-date")).toThrow("Fecha invalida");
  });
});

describe("getDayIndex", () => {
  // 2026-06-01 is a Monday
  it("returns 0 for Monday", () => {
    expect(getDayIndex(new Date("2026-06-01T00:00:00.000Z"))).toBe(0);
  });

  it("returns 1 for Tuesday", () => {
    expect(getDayIndex(new Date("2026-06-02T00:00:00.000Z"))).toBe(1);
  });

  it("returns 5 for Saturday", () => {
    expect(getDayIndex(new Date("2026-06-06T00:00:00.000Z"))).toBe(5);
  });

  it("returns 6 for Sunday", () => {
    expect(getDayIndex(new Date("2026-06-07T00:00:00.000Z"))).toBe(6);
  });
});

describe("isWorkDay", () => {
  const monFri = 31; // bits 0-4 = Mon-Fri

  it("returns true for a Monday with Mon-Fri bitmask", () => {
    expect(isWorkDay("2026-06-01", monFri)).toBe(true);
  });

  it("returns true for a Friday with Mon-Fri bitmask", () => {
    expect(isWorkDay("2026-06-05", monFri)).toBe(true);
  });

  it("returns false for Saturday with Mon-Fri bitmask", () => {
    expect(isWorkDay("2026-06-06", monFri)).toBe(false);
  });

  it("returns false for Sunday with Mon-Fri bitmask", () => {
    expect(isWorkDay("2026-06-07", monFri)).toBe(false);
  });

  it("works with Date objects", () => {
    const saturday = new Date("2026-06-06T00:00:00.000Z");
    expect(isWorkDay(saturday, monFri)).toBe(false);
    const monday = new Date("2026-06-01T00:00:00.000Z");
    expect(isWorkDay(monday, monFri)).toBe(true);
  });

  it("Mon-Sat bitmask (63) includes Saturday", () => {
    const monSat = 63; // bits 0-5 = Mon-Sat
    expect(isWorkDay("2026-06-06", monSat)).toBe(true);
    expect(isWorkDay("2026-06-07", monSat)).toBe(false);
  });

  it("7-day bitmask (127) includes all days", () => {
    const allDays = 127;
    expect(isWorkDay("2026-06-06", allDays)).toBe(true);
    expect(isWorkDay("2026-06-07", allDays)).toBe(true);
  });

  it("empty bitmask (0) returns false for all days", () => {
    expect(isWorkDay("2026-06-01", 0)).toBe(false);
  });
});

describe("countWorkDays", () => {
  const monFri = 31;

  it("counts 5 work days in a Mon-Fri week", () => {
    // Mon 2026-06-01 to Fri 2026-06-05
    expect(countWorkDays("2026-06-01", "2026-06-05", monFri)).toBe(5);
  });

  it("counts 0 work days on a weekend range", () => {
    // Sat 2026-06-06 to Sun 2026-06-07
    expect(countWorkDays("2026-06-06", "2026-06-07", monFri)).toBe(0);
  });

  it("counts work days across multiple weeks", () => {
    // Mon 2026-06-01 to Fri 2026-06-12 (10 work days)
    expect(countWorkDays("2026-06-01", "2026-06-12", monFri)).toBe(10);
  });

  it("returns 1 for a single work day range", () => {
    expect(countWorkDays("2026-06-01", "2026-06-01", monFri)).toBe(1);
  });

  it("returns 0 for a single non-work day range", () => {
    expect(countWorkDays("2026-06-06", "2026-06-06", monFri)).toBe(0);
  });

  it("Mon-Sat bitmask (63) counts 6 days per week", () => {
    const monSat = 63;
    expect(countWorkDays("2026-06-01", "2026-06-06", monSat)).toBe(6);
  });
});

describe("countCalendarDays", () => {
  it("counts 5 days between Mon and Fri", () => {
    expect(countCalendarDays("2026-06-01", "2026-06-05")).toBe(5);
  });

  it("counts 7 days in a full week", () => {
    expect(countCalendarDays("2026-06-01", "2026-06-07")).toBe(7);
  });

  it("returns 1 for a single day range", () => {
    expect(countCalendarDays("2026-06-01", "2026-06-01")).toBe(1);
  });

  it("counts across months", () => {
    // 2026-06-29 (Mon) to 2026-07-03 (Fri) = 5 days
    expect(countCalendarDays("2026-06-29", "2026-07-03")).toBe(5);
  });
});

describe("addWorkDays", () => {
  const monFri = 31;

  it("adds 1 work day: Monday → Tuesday", () => {
    expect(addWorkDays("2026-06-01", 1, monFri)).toBe("2026-06-02");
  });

  it("skips weekend: Friday + 1 = Monday", () => {
    expect(addWorkDays("2026-06-05", 1, monFri)).toBe("2026-06-08");
  });

  it("skips weekend: Friday + 0 = Friday", () => {
    expect(addWorkDays("2026-06-05", 0, monFri)).toBe("2026-06-05");
  });

  it("adds 5 work days: Monday → next Monday", () => {
    expect(addWorkDays("2026-06-01", 5, monFri)).toBe("2026-06-08");
  });

  it("adds 0 work days: same date", () => {
    expect(addWorkDays("2026-06-01", 0, monFri)).toBe("2026-06-01");
  });

  it("Mon-Sat: Saturday + 1 = Monday", () => {
    const monSat = 63;
    expect(addWorkDays("2026-06-05", 1, monSat)).toBe("2026-06-06"); // Fri→Sat
    expect(addWorkDays("2026-06-06", 1, monSat)).toBe("2026-06-08"); // Sat→Mon
  });
});

describe("nextWorkDay", () => {
  const monFri = 31;

  it("returns same date if it's a work day", () => {
    expect(nextWorkDay("2026-06-01", monFri)).toBe("2026-06-01"); // Monday
  });

  it("returns next Monday if given Saturday", () => {
    expect(nextWorkDay("2026-06-06", monFri)).toBe("2026-06-08");
  });

  it("returns next Monday if given Sunday", () => {
    expect(nextWorkDay("2026-06-07", monFri)).toBe("2026-06-08");
  });
});

describe("calendarDaysToWorkDays", () => {
  const monFri = 31; // 5 work days per week

  it("converts 7 calendar days to 5 work days", () => {
    expect(calendarDaysToWorkDays(7, monFri)).toBe(5);
  });

  it("converts 14 calendar days to 10 work days", () => {
    expect(calendarDaysToWorkDays(14, monFri)).toBe(10);
  });

  it("handles rounding: 1 day → 1 work day", () => {
    expect(calendarDaysToWorkDays(1, monFri)).toBe(1);
  });

  it("returns calendar days when bitmask is 0", () => {
    expect(calendarDaysToWorkDays(10, 0)).toBe(10);
  });
});

describe("workDaysToCalendarDays", () => {
  const monFri = 31; // 5 work days per week

  it("converts 5 work days to 7 calendar days", () => {
    expect(workDaysToCalendarDays(5, monFri)).toBe(7);
  });

  it("converts 10 work days to 14 calendar days", () => {
    expect(workDaysToCalendarDays(10, monFri)).toBe(14);
  });

  it("converts 1 work day to 2 calendar days (rounds up for weekend gap)", () => {
    expect(workDaysToCalendarDays(1, monFri)).toBe(2);
  });

  it("converts 1 work day to 1 calendar day with 7-day week", () => {
    expect(workDaysToCalendarDays(1, 127)).toBe(1);
  });

  it("returns work days when bitmask is 0", () => {
    expect(workDaysToCalendarDays(10, 0)).toBe(10);
  });
});
