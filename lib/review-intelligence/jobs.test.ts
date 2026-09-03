import { describe, expect, it } from "vitest";
import { getReviewProgress, requestReviewCancellation, type ReviewJobClient } from "./jobs";

function jobClient(): ReviewJobClient & { runs: Array<Record<string, unknown>> } {
  const database = { runs: [{ id: "run-1", companyId: "company-1", projectId: "project-1", budgetId: "budget-1", status: "RUNNING", updatedAt: new Date(Date.now() - 10_000), progressJson: { stage: "matching", completed: 4, total: 8, percent: 50 }, warningsJson: [] }] } as ReturnType<typeof jobClient>;
  database.reviewRun = {
    findUnique: async ({ where }) => database.runs.find((run) => run.id === where.id && run.companyId === where.companyId) ?? null,
    update: async ({ where, data }) => { const run = database.runs.find((entry) => entry.id === where.id)!; Object.assign(run, data); return run; },
    updateMany: async ({ where, data }) => { const run = database.runs.find((entry) => entry.id === where.id && (!where.status || typeof where.status === "string" && entry.status === where.status || typeof where.status === "object" && (where.status as { in?: unknown[] }).in?.includes(entry.status))); if (!run) return { count: 0 }; Object.assign(run, data); return { count: 1 }; },
    findMany: async () => database.runs,
  };
  return database;
}

describe("review jobs", () => {
  it("returns tenant-scoped progress and marks stale executions", async () => {
    const database = jobClient();
    const progress = await getReviewProgress("run-1", "company-1", database, { staleAfterMs: 1 });
    expect(progress.status).toBe("STALE");
    expect(progress.progress).toMatchObject({ stage: "matching", percent: 50 });
  });

  it("requests cancellation only for a tenant-owned active run", async () => {
    const database = jobClient();
    await requestReviewCancellation("run-1", "company-1", database);
    expect(database.runs[0]).toMatchObject({ status: "CANCEL_REQUESTED" });
    await expect(requestReviewCancellation("run-1", "other-company", database)).rejects.toThrow("not found");
  });

  it("calculates persisted metrics only from the run's document versions and descendants", async () => {
    const database = jobClient();
    database.budget = { findMany: async () => [{ id: "budget-1", parentBudgetId: null }, { id: "budget-child", parentBudgetId: "budget-1" }, { id: "other", parentBudgetId: null }] };
    database.budgetItem = { findMany: async () => [{ id: "item-1", budgetId: "budget-1" }, { id: "item-2", budgetId: "budget-child" }, { id: "item-other", budgetId: "other" }] };
    database.reviewRunDocumentVersion = { findMany: async ({ where }) => where.reviewRunId === "run-1" ? [{ documentVersionId: "version-in-scope" }] : [] };
    database.reviewEvidence = { findMany: async ({ where }) => where.documentVersionId.in.includes("version-in-scope") ? [{ id: "evidence-1", documentVersionId: "version-in-scope" }] : [] };
    database.entityLink = { findMany: async () => [{ budgetItemId: "item-1", evidenceId: "evidence-1" }] };
    database.reviewFinding = { findMany: async () => [{ budgetItemId: "item-1", status: "PENDING", findingType: "QUANTITY_MISMATCH" }, { budgetItemId: "item-2", status: "RESOLVED", findingType: "UNIT_INCONSISTENCY" }] };
    const progress = await getReviewProgress("run-1", "company-1", database);
    expect(progress.progress.metrics).toMatchObject({ analyzedItems: 2, evidenceCount: 1, linkedEvidenceCount: 1, coveragePercent: 50 });
  });
});
