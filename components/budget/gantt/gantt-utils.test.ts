import { describe, expect, it } from "vitest";
import {
  addIsoDays,
  clampDateToTimeline,
  computeDraggedBarDates,
  computeResizedBarDates,
  diffInDays,
  formatDateLabel,
  pixelsToDays,
} from "./gantt-utils";

describe("gantt-utils", () => {
  describe("addIsoDays", () => {
    it("adds days correctly", () => {
      expect(addIsoDays("2026-01-01", 0)).toBe("2026-01-01");
      expect(addIsoDays("2026-01-01", 5)).toBe("2026-01-06");
      expect(addIsoDays("2026-01-31", 1)).toBe("2026-02-01");
    });

    it("subtracts days correctly", () => {
      expect(addIsoDays("2026-01-10", -3)).toBe("2026-01-07");
      expect(addIsoDays("2026-01-01", -1)).toBe("2025-12-31");
    });
  });

  describe("diffInDays", () => {
    it("returns 0 for same date", () => {
      expect(diffInDays("2026-03-12", "2026-03-12")).toBe(0);
    });

    it("returns positive difference", () => {
      expect(diffInDays("2026-03-12", "2026-03-15")).toBe(3);
    });

    it("returns negative difference when reversed", () => {
      expect(diffInDays("2026-03-15", "2026-03-12")).toBe(-3);
    });
  });

  describe("pixelsToDays", () => {
    it("converts pixels to days rounded", () => {
      expect(pixelsToDays(0, 24)).toBe(0);
      expect(pixelsToDays(24, 24)).toBe(1);
      expect(pixelsToDays(36, 24)).toBe(2); // rounds up
      expect(pixelsToDays(11, 24)).toBe(0); // rounds down
    });

    it("returns 0 for invalid column width", () => {
      expect(pixelsToDays(100, 0)).toBe(0);
      expect(pixelsToDays(100, -5)).toBe(0);
    });
  });

  describe("clampDateToTimeline", () => {
    it("clamps to timeline start", () => {
      expect(clampDateToTimeline("2026-01-01", "2026-01-05", "2026-01-31")).toBe("2026-01-05");
    });

    it("clamps to timeline end", () => {
      expect(clampDateToTimeline("2026-02-10", "2026-01-05", "2026-01-31")).toBe("2026-01-31");
    });

    it("returns date when inside range", () => {
      expect(clampDateToTimeline("2026-01-15", "2026-01-05", "2026-01-31")).toBe("2026-01-15");
    });

    it("returns date when no bounds", () => {
      expect(clampDateToTimeline("2026-01-15", null, null)).toBe("2026-01-15");
    });
  });

  describe("computeDraggedBarDates", () => {
    it("shifts start and end by delta days maintaining duration", () => {
      const result = computeDraggedBarDates(
        "2026-03-10",
        "2026-03-14",
        5,
        48, // 2 days in px with column width 24
        24,
        null,
        null,
      );
      expect(result.startDate).toBe("2026-03-12");
      expect(result.endDate).toBe("2026-03-16");
      expect(result.durationDays).toBe(5);
    });

    it("clamps start to timeline boundary and shortens duration if needed", () => {
      const result = computeDraggedBarDates(
        "2026-03-10",
        "2026-03-14",
        5,
        -240, // -10 days, would go before timeline start
        24,
        "2026-03-05",
        null,
      );
      expect(result.startDate).toBe("2026-03-05");
      expect(result.endDate).toBe("2026-03-09");
      expect(result.durationDays).toBe(5);
    });

    it("clamps end to timeline boundary and shortens duration if needed", () => {
      const result = computeDraggedBarDates(
        "2026-03-10",
        "2026-03-14",
        5,
        240, // +10 days, would exceed timeline end
        24,
        null,
        "2026-03-17",
      );
      // start gets clamped to timeline end because start + duration would exceed it
      expect(result.startDate).toBe("2026-03-17");
      expect(result.endDate).toBe("2026-03-17");
      expect(result.durationDays).toBe(1);
    });
  });

  describe("computeResizedBarDates", () => {
    it("resizes left edge earlier", () => {
      const result = computeResizedBarDates(
        "2026-03-10",
        "2026-03-14",
        5,
        -48, // 2 days earlier
        24,
        "resizing-left",
        null,
        null,
      );
      expect(result.startDate).toBe("2026-03-08");
      expect(result.endDate).toBe("2026-03-14");
      expect(result.durationDays).toBe(7);
    });

    it("resizes left edge later shortening duration", () => {
      const result = computeResizedBarDates(
        "2026-03-10",
        "2026-03-14",
        5,
        48, // 2 days later
        24,
        "resizing-left",
        null,
        null,
      );
      expect(result.startDate).toBe("2026-03-12");
      expect(result.endDate).toBe("2026-03-14");
      expect(result.durationDays).toBe(3);
    });

    it("prevents left edge from passing end (minimum 1 day)", () => {
      const result = computeResizedBarDates(
        "2026-03-10",
        "2026-03-14",
        5,
        96, // 4 days later
        24,
        "resizing-left",
        null,
        null,
      );
      expect(result.startDate).toBe("2026-03-14");
      expect(result.endDate).toBe("2026-03-14");
      expect(result.durationDays).toBe(1);
    });

    it("resizes right edge later", () => {
      const result = computeResizedBarDates(
        "2026-03-10",
        "2026-03-14",
        5,
        48, // 2 days later
        24,
        "resizing-right",
        null,
        null,
      );
      expect(result.startDate).toBe("2026-03-10");
      expect(result.endDate).toBe("2026-03-16");
      expect(result.durationDays).toBe(7);
    });

    it("resizes right edge earlier shortening duration", () => {
      const result = computeResizedBarDates(
        "2026-03-10",
        "2026-03-14",
        5,
        -48, // 2 days earlier
        24,
        "resizing-right",
        null,
        null,
      );
      expect(result.startDate).toBe("2026-03-10");
      expect(result.endDate).toBe("2026-03-12");
      expect(result.durationDays).toBe(3);
    });

    it("prevents right edge from passing start (minimum 1 day)", () => {
      const result = computeResizedBarDates(
        "2026-03-10",
        "2026-03-14",
        5,
        -96, // 4 days earlier
        24,
        "resizing-right",
        null,
        null,
      );
      expect(result.startDate).toBe("2026-03-10");
      expect(result.endDate).toBe("2026-03-10");
      expect(result.durationDays).toBe(1);
    });
  });

  describe("formatDateLabel", () => {
    it("formats date in Spanish locale", () => {
      const label = formatDateLabel("2026-03-12");
      expect(label).toContain("12");
      expect(label.toLowerCase()).toContain("mar");
    });
  });
});
