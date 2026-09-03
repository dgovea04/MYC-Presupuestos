import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
import { listFindings, recordFindingDecision, type FindingFilters } from "@/lib/review-intelligence/findings";

function findingRow(updatedAt = new Date("2026-09-02T12:00:00.000Z")) {
  return { id: "finding-1", companyId: "company-1", projectId: "project-1", budgetId: "budget-1", reviewRunId: "run-1", budgetItemId: "item-1", entityLinkId: null, evidenceId: "evidence-1", findingType: "QUANTITY_MISMATCH", status: "OPEN", severity: "HIGH", priority: "0.900000", confidence: "HIGH", score: "0.900000", potentialImpact: "100.000000", ruleKey: "rule-1", comparisonJson: {}, humanReviewRequired: true, automaticBudgetMutation: false, createdAt: updatedAt, updatedAt, budgetItem: { id: "item-1", code: "01.01", description: "Item", unit: "m2", quantity: "1", unitPrice: "2" }, evidence: { id: "evidence-1", documentVersionId: "version-1", evidenceType: "QUANTITY", originalText: "1", normalizedText: null, locationJson: {}, unit: "m2", extractionMethod: "xlsx", confidence: "HIGH", sourceHash: "hash" }, entityLink: null, decisions: [] };
}

describe("review findings service", () => {
  it("uses the run tenant/project/budget scope and required priority ordering", async () => {
    const reviewRunFindFirst = vi.fn().mockResolvedValue({ id: "run-1", projectId: "project-1", budgetId: "budget-1" });
    const reviewFindingFindMany = vi.fn().mockResolvedValue([findingRow(), findingRow()]);
    const client = { reviewRun: { findFirst: reviewRunFindFirst }, reviewFinding: { findMany: reviewFindingFindMany } } as never;
    const filters: FindingFilters = { companyId: "company-1", reviewRunId: "run-1", page: 1, pageSize: 1 };
    const result = await listFindings(filters, client);
    expect(result.hasNextPage).toBe(true);
    expect(reviewRunFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "run-1", companyId: "company-1" } }));
    expect(reviewFindingFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: "company-1", projectId: "project-1", budgetId: "budget-1", reviewRunId: "run-1", status: undefined, findingType: undefined, severity: undefined, confidence: undefined }, orderBy: [{ priority: "desc" }, { potentialImpact: "desc" }, { confidence: "desc" }, { budgetItem: { code: "asc" } }, { id: "asc" }] }));
  });

  it("creates an append-only decision and audit event after optimistic concurrency succeeds", async () => {
    const tx = { reviewFinding: { findFirst: vi.fn().mockResolvedValue({ id: "finding-1", companyId: "company-1", projectId: "project-1", budgetId: "budget-1", reviewRunId: "run-1", status: "OPEN", updatedAt: new Date("2026-09-02T12:00:00.000Z") }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) }, findingDecision: { create: vi.fn().mockResolvedValue({ id: "decision-1", findingId: "finding-1", resolution: "ACCEPTED", note: null, expectedUpdatedAt: new Date("2026-09-02T12:00:00.000Z"), createdAt: new Date("2026-09-02T12:01:00.000Z") }) }, reviewAuditEvent: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) } };
    const client = { $transaction: vi.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)), reviewFinding: tx.reviewFinding, findingDecision: tx.findingDecision, reviewAuditEvent: tx.reviewAuditEvent } as never;
    const result = await recordFindingDecision({ findingId: "finding-1", companyId: "company-1", userId: "user-1", resolution: "ACCEPTED", expectedUpdatedAt: new Date("2026-09-02T12:00:00.000Z") }, client);
    expect(result.id).toBe("decision-1");
    expect(tx.findingDecision.create).toHaveBeenCalledOnce();
    expect(tx.reviewAuditEvent.create).toHaveBeenCalledOnce();
  });
});
