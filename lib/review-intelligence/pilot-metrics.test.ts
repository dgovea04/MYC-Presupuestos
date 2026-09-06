import { describe, expect, it } from "vitest";
import { calculateReviewPilotMetrics } from "./pilot-metrics";

describe("calculateReviewPilotMetrics", () => {
  it("calcula KPIs de ejecución, cobertura y resolución dentro de la ventana", () => {
    const result = calculateReviewPilotMetrics({
      runs: [
        { status: "REVIEWED", createdAt: new Date("2026-09-01"), startedAt: new Date("2026-09-01T00:00:00Z"), finishedAt: new Date("2026-09-01T00:02:00Z"), coveragePercent: 80 },
        { status: "COMPLETED_WITH_WARNINGS", createdAt: new Date("2026-09-02"), startedAt: new Date("2026-09-02T00:00:00Z"), finishedAt: new Date("2026-09-02T00:01:00Z"), coveragePercent: 60 },
        { status: "FAILED", createdAt: new Date("2026-09-03"), startedAt: null, finishedAt: null, coveragePercent: 0 },
      ],
      findings: [
        { findingType: "QUANTITY_MISMATCH", status: "RESOLVED", createdAt: new Date("2026-09-01") },
        { findingType: "QUANTITY_MISMATCH", status: "RESOLVED", createdAt: new Date("2026-09-01") },
        { findingType: "MISSING_DOCUMENTATION", status: "PENDING", createdAt: new Date("2026-09-02") },
      ],
      decisions: [
        { resolution: "CONFIRMED_ISSUE", createdAt: new Date("2026-09-01") },
        { resolution: "FALSE_POSITIVE", createdAt: new Date("2026-09-02") },
      ],
      window: { from: new Date("2026-09-01"), to: new Date("2026-09-03T23:59:59Z") },
    });

    expect(result).toEqual({
      window: { from: "2026-09-01T00:00:00.000Z", to: "2026-09-03T23:59:59.000Z" },
      runs: { total: 3, completed: 2, reviewed: 1, failed: 1, completionRatePercent: 67, reviewCompletionRatePercent: 50, averageDurationSeconds: 90 },
      coverage: { averagePercent: 47 },
      findings: { total: 3, byType: { QUANTITY_MISMATCH: 2, MISSING_DOCUMENTATION: 1 }, byStatus: { RESOLVED: 2, PENDING: 1 } },
      humanReview: { decisions: 2, confirmedIssues: 1, falsePositives: 1, resolutionRatePercent: 67, falsePositiveRatePercent: 50 },
      limitations: ["No hay datos de ahorro de tiempo ni dataset dorado asociado a esta ejecución."],
    });
  });
});
