import { describe, expect, test } from "vitest";

import { aggregateMetradoSheetsByMonth } from "@/lib/data/metrados";

describe("aggregateMetradoSheetsByMonth", () => {
  test("returns empty when there are no sheets", () => {
    expect(aggregateMetradoSheetsByMonth([])).toEqual([]);
  });

  test("groups a single sheet into its creation month", () => {
    const result = aggregateMetradoSheetsByMonth([
      { createdAt: new Date("2026-06-15T10:00:00Z") },
    ]);

    expect(result).toEqual([
      { year: 2026, month: 6, sheetCount: 1 },
    ]);
  });

  test("counts multiple sheets in the same month", () => {
    const result = aggregateMetradoSheetsByMonth([
      { createdAt: new Date("2026-06-01T08:00:00Z") },
      { createdAt: new Date("2026-06-15T14:30:00Z") },
      { createdAt: new Date("2026-06-30T23:59:59Z") },
    ]);

    expect(result).toEqual([
      { year: 2026, month: 6, sheetCount: 3 },
    ]);
  });

  test("separates sheets into different months sorted descending", () => {
    const result = aggregateMetradoSheetsByMonth([
      { createdAt: new Date("2026-01-10T00:00:00Z") },
      { createdAt: new Date("2026-03-20T00:00:00Z") },
      { createdAt: new Date("2025-11-05T00:00:00Z") },
      { createdAt: new Date("2026-03-15T00:00:00Z") },
    ]);

    expect(result).toEqual([
      { year: 2026, month: 3, sheetCount: 2 },
      { year: 2026, month: 1, sheetCount: 1 },
      { year: 2025, month: 11, sheetCount: 1 },
    ]);
  });

  test("skips sheets without a createdAt date", () => {
    const result = aggregateMetradoSheetsByMonth([
      { createdAt: new Date("2026-06-01T00:00:00Z") },
      { createdAt: null },
      { createdAt: undefined },
      { createdAt: new Date("2026-07-01T00:00:00Z") },
    ]);

    expect(result).toEqual([
      { year: 2026, month: 7, sheetCount: 1 },
      { year: 2026, month: 6, sheetCount: 1 },
    ]);
  });

  test("handles ISO string dates", () => {
    const result = aggregateMetradoSheetsByMonth([
      { createdAt: "2026-06-15T10:00:00.000Z" },
      { createdAt: "2026-06-20T14:00:00.000Z" },
    ]);

    expect(result).toEqual([
      { year: 2026, month: 6, sheetCount: 2 },
    ]);
  });

  test("sorts years in descending order, then months in descending order", () => {
    const result = aggregateMetradoSheetsByMonth([
      { createdAt: new Date("2025-01-01T00:00:00Z") },
      { createdAt: new Date("2027-06-01T00:00:00Z") },
      { createdAt: new Date("2026-03-01T00:00:00Z") },
      { createdAt: new Date("2027-01-01T00:00:00Z") },
      { createdAt: new Date("2025-12-01T00:00:00Z") },
    ]);

    expect(result).toEqual([
      { year: 2027, month: 6, sheetCount: 1 },
      { year: 2027, month: 1, sheetCount: 1 },
      { year: 2026, month: 3, sheetCount: 1 },
      { year: 2025, month: 12, sheetCount: 1 },
      { year: 2025, month: 1, sheetCount: 1 },
    ]);
  });

  test("handles edge case of months spanning year boundary", () => {
    const result = aggregateMetradoSheetsByMonth([
      { createdAt: new Date("2025-12-31T23:59:59Z") },
      { createdAt: new Date("2026-01-01T00:00:00Z") },
    ]);

    expect(result).toEqual([
      { year: 2026, month: 1, sheetCount: 1 },
      { year: 2025, month: 12, sheetCount: 1 },
    ]);
  });
});
