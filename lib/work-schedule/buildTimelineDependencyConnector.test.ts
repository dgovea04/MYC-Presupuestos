import { describe, expect, it } from "vitest";
import { buildTimelineDependencyConnector } from "@/components/budget/work-schedule/overview-view";

/** Helper: count V commands in an SVG path to distinguish break path (2 V's) from simple elbow (1 V) */
function countVerticalSegments(path: string): number {
  return path.split("V").length - 1;
}

describe("buildTimelineDependencyConnector", () => {
  const defaultLine = {
    line: {
      budgetItemId: "item-1",
      itemCode: "1",
      description: "Test",
      unit: "UND",
      quantity: 1,
      unitPrice: 100,
      partial: 100,
      subBudgetId: "sub-1",
      subBudgetName: "Sub",
      monthlyDistributions: [{ year: 2026, month: 3, percentage: 100 }],
    },
  };

  const DEFAULT_TIMELINE_DAY_WIDTH = 16;
  const DEFAULT_TIMELINE_DAY_GAP = 1;

  /** Computes start X for a day index: index * (dayWidth + dayGap) */
  function startX(index: number): number {
    return index * (DEFAULT_TIMELINE_DAY_WIDTH + DEFAULT_TIMELINE_DAY_GAP);
  }

  /** Computes end X for a day index: startX + dayWidth */
  function endX(index: number): number {
    return startX(index) + DEFAULT_TIMELINE_DAY_WIDTH;
  }

  describe("FS (Finish-to-Start) relationship", () => {
    it("uses break path when successor overlaps predecessor (delta = -2)", () => {
      // A day 1-10 (index 0-9), B day 8-15 (index 7-14)
      // B starts 2 days before A ends: delta = 7 - 9 = -2
      const path = buildTimelineDependencyConnector({
        predecessor: { ...defaultLine, top: 0, height: 40 },
        predecessorReference: { relation: "FS" },
        predecessorStartIndex: 0,
        predecessorEndIndex: 9,
        successor: { ...defaultLine, top: 60, height: 40 },
        successorStartIndex: 7,
        successorEndIndex: 14,
        timelineDayWidth: DEFAULT_TIMELINE_DAY_WIDTH,
        timelineDayGap: DEFAULT_TIMELINE_DAY_GAP,
      });

      // Break path should have 2 V segments (exit right, drop down, go left, then vertical to successor)
      expect(countVerticalSegments(path)).toBe(2);

      // The first horizontal segment should go RIGHT (increasing x), not through the predecessor bar
      const firstH = path.match(/H (\d+)/);
      expect(firstH).not.toBeNull();
      const firstHX = parseInt(firstH![1], 10);
      const sourceX = endX(9); // 9 * 17 + 16 = 169
      expect(firstHX).toBeGreaterThan(sourceX);
    });

    it("uses break path for same-day handoff (delta = 0)", () => {
      // A day 1-10 (index 0-9), B day 10-15 (index 9-14)
      // B starts same day A ends: delta = 9 - 9 = 0
      const path = buildTimelineDependencyConnector({
        predecessor: { ...defaultLine, top: 0, height: 40 },
        predecessorReference: { relation: "FS" },
        predecessorStartIndex: 0,
        predecessorEndIndex: 9,
        successor: { ...defaultLine, top: 60, height: 40 },
        successorStartIndex: 9,
        successorEndIndex: 14,
        timelineDayWidth: DEFAULT_TIMELINE_DAY_WIDTH,
        timelineDayGap: DEFAULT_TIMELINE_DAY_GAP,
      });

      expect(countVerticalSegments(path)).toBe(2);
    });

    it("uses break path for next-day handoff (delta = 1)", () => {
      // A day 1-10 (index 0-9), B day 11-15 (index 10-14)
      // B starts 1 day after A ends: delta = 10 - 9 = 1
      const path = buildTimelineDependencyConnector({
        predecessor: { ...defaultLine, top: 0, height: 40 },
        predecessorReference: { relation: "FS" },
        predecessorStartIndex: 0,
        predecessorEndIndex: 9,
        successor: { ...defaultLine, top: 60, height: 40 },
        successorStartIndex: 10,
        successorEndIndex: 14,
        timelineDayWidth: DEFAULT_TIMELINE_DAY_WIDTH,
        timelineDayGap: DEFAULT_TIMELINE_DAY_GAP,
      });

      expect(countVerticalSegments(path)).toBe(2);
    });

    it("uses simple elbow path for sequential with gap (delta >= 2)", () => {
      // A day 1-10 (index 0-9), B day 13-15 (index 12-14)
      // B starts 3 days after A ends: delta = 12 - 9 = 3
      const path = buildTimelineDependencyConnector({
        predecessor: { ...defaultLine, top: 0, height: 40 },
        predecessorReference: { relation: "FS" },
        predecessorStartIndex: 0,
        predecessorEndIndex: 9,
        successor: { ...defaultLine, top: 60, height: 40 },
        successorStartIndex: 12,
        successorEndIndex: 14,
        timelineDayWidth: DEFAULT_TIMELINE_DAY_WIDTH,
        timelineDayGap: DEFAULT_TIMELINE_DAY_GAP,
      });

      // Simple elbow has 1 V segment
      expect(countVerticalSegments(path)).toBe(1);

      // The first horizontal segment should go RIGHT (increasing x) since there's no overlap
      const firstH = path.match(/H (\d+)/);
      expect(firstH).not.toBeNull();
      const firstHX = parseInt(firstH![1], 10);
      const sourceX = endX(9); // predecessor end X
      expect(firstHX).toBeGreaterThan(sourceX);
    });
  });

  describe("SS (Start-to-Start) relationship", () => {
    it("uses break path when successor starts before predecessor (overlap)", () => {
      // SS overlap: B (starts at index 3) starts before A (starts at index 5): delta = 3 - 5 = -2
      const path = buildTimelineDependencyConnector({
        predecessor: { ...defaultLine, top: 0, height: 40 },
        predecessorReference: { relation: "SS" },
        predecessorStartIndex: 5,
        predecessorEndIndex: 14,
        successor: { ...defaultLine, top: 60, height: 40 },
        successorStartIndex: 3,
        successorEndIndex: 10,
        timelineDayWidth: DEFAULT_TIMELINE_DAY_WIDTH,
        timelineDayGap: DEFAULT_TIMELINE_DAY_GAP,
      });

      expect(countVerticalSegments(path)).toBe(2);
    });

    it("uses break path for same-day SS handoff (delta = 0)", () => {
      const path = buildTimelineDependencyConnector({
        predecessor: { ...defaultLine, top: 0, height: 40 },
        predecessorReference: { relation: "SS" },
        predecessorStartIndex: 5,
        predecessorEndIndex: 14,
        successor: { ...defaultLine, top: 60, height: 40 },
        successorStartIndex: 5,
        successorEndIndex: 10,
        timelineDayWidth: DEFAULT_TIMELINE_DAY_WIDTH,
        timelineDayGap: DEFAULT_TIMELINE_DAY_GAP,
      });

      expect(countVerticalSegments(path)).toBe(2);
    });

    it("uses simple elbow path for SS with positive gap (delta >= 2)", () => {
      const path = buildTimelineDependencyConnector({
        predecessor: { ...defaultLine, top: 0, height: 40 },
        predecessorReference: { relation: "SS" },
        predecessorStartIndex: 5,
        predecessorEndIndex: 14,
        successor: { ...defaultLine, top: 60, height: 40 },
        successorStartIndex: 7,
        successorEndIndex: 10,
        timelineDayWidth: DEFAULT_TIMELINE_DAY_WIDTH,
        timelineDayGap: DEFAULT_TIMELINE_DAY_GAP,
      });

      expect(countVerticalSegments(path)).toBe(1);
    });
  });

  describe("FF (Finish-to-Finish) relationship", () => {
    it("uses break path when successor finishes before predecessor (overlap)", () => {
      // A ends at index 14, B ends at index 12: delta = 12 - 14 = -2
      const path = buildTimelineDependencyConnector({
        predecessor: { ...defaultLine, top: 0, height: 40 },
        predecessorReference: { relation: "FF" },
        predecessorStartIndex: 0,
        predecessorEndIndex: 14,
        successor: { ...defaultLine, top: 60, height: 40 },
        successorStartIndex: 0,
        successorEndIndex: 12,
        timelineDayWidth: DEFAULT_TIMELINE_DAY_WIDTH,
        timelineDayGap: DEFAULT_TIMELINE_DAY_GAP,
      });

      expect(countVerticalSegments(path)).toBe(2);
    });

    it("uses simple elbow for FF with gap (delta >= 2)", () => {
      const path = buildTimelineDependencyConnector({
        predecessor: { ...defaultLine, top: 0, height: 40 },
        predecessorReference: { relation: "FF" },
        predecessorStartIndex: 0,
        predecessorEndIndex: 14,
        successor: { ...defaultLine, top: 60, height: 40 },
        successorStartIndex: 0,
        successorEndIndex: 16,
        timelineDayWidth: DEFAULT_TIMELINE_DAY_WIDTH,
        timelineDayGap: DEFAULT_TIMELINE_DAY_GAP,
      });

      expect(countVerticalSegments(path)).toBe(1);
    });
  });

  describe("SF (Start-to-Finish) relationship", () => {
    it("uses break path when successor finishes before predecessor starts (overlap)", () => {
      // A starts at index 5, B finishes at index 3: delta = 3 - 5 = -2
      const path = buildTimelineDependencyConnector({
        predecessor: { ...defaultLine, top: 0, height: 40 },
        predecessorReference: { relation: "SF" },
        predecessorStartIndex: 5,
        predecessorEndIndex: 14,
        successor: { ...defaultLine, top: 60, height: 40 },
        successorStartIndex: 0,
        successorEndIndex: 3,
        timelineDayWidth: DEFAULT_TIMELINE_DAY_WIDTH,
        timelineDayGap: DEFAULT_TIMELINE_DAY_GAP,
      });

      expect(countVerticalSegments(path)).toBe(2);
    });

    it("uses simple elbow for SF with gap (delta >= 2)", () => {
      const path = buildTimelineDependencyConnector({
        predecessor: { ...defaultLine, top: 0, height: 40 },
        predecessorReference: { relation: "SF" },
        predecessorStartIndex: 5,
        predecessorEndIndex: 14,
        successor: { ...defaultLine, top: 60, height: 40 },
        successorStartIndex: 0,
        successorEndIndex: 7,
        timelineDayWidth: DEFAULT_TIMELINE_DAY_WIDTH,
        timelineDayGap: DEFAULT_TIMELINE_DAY_GAP,
      });

      expect(countVerticalSegments(path)).toBe(1);
    });
  });
});
