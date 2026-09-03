import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
vi.stubEnv("NEXTAUTH_SECRET", "test-review-secret");
import { getFinding, listFindings, recordFindingDecision, validateReviewLink, viewReviewEvidence, type FindingFilters } from "@/lib/review-intelligence/findings";

function findingRow(updatedAt = new Date("2026-09-02T12:00:00.000Z")) {
  return { id: "finding-1", companyId: "company-1", projectId: "project-1", budgetId: "budget-1", reviewRunId: "run-1", budgetItemId: "item-1", entityLinkId: null, evidenceId: "evidence-1", findingType: "QUANTITY_MISMATCH", status: "PENDING", severity: "HIGH", priority: "0.900000", confidence: "HIGH", score: "0.900000", potentialImpact: "100.000000", ruleKey: "rule-1", comparisonJson: {}, humanReviewRequired: true, automaticBudgetMutation: false, createdAt: updatedAt, updatedAt, budgetItem: { id: "item-1", code: "01.01", description: "Item", unit: "m2", quantity: "1", unitPrice: "2" }, evidence: { id: "evidence-1", documentVersionId: "version-1", evidenceType: "QUANTITY", originalText: "1", normalizedText: null, locationJson: {}, unit: "m2", extractionMethod: "xlsx", confidence: "HIGH", sourceHash: "hash" }, entityLink: null, decisions: [] };
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
    const tx = { reviewFinding: { findFirst: vi.fn().mockResolvedValue({ id: "finding-1", companyId: "company-1", projectId: "project-1", budgetId: "budget-1", reviewRunId: "run-1", status: "PENDING", updatedAt: new Date("2026-09-02T12:00:00.000Z") }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) }, reviewRun: { findFirst: vi.fn().mockResolvedValue({ id: "run-1", status: "COMPLETED" }) }, findingDecision: { create: vi.fn().mockResolvedValue({ id: "decision-1", findingId: "finding-1", resolution: "CONFIRMED_ISSUE", note: null, expectedUpdatedAt: new Date("2026-09-02T12:00:00.000Z"), createdAt: new Date("2026-09-02T12:01:00.000Z") }) }, reviewAuditEvent: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) } };
    const client = { $transaction: vi.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)), reviewFinding: tx.reviewFinding, reviewRun: tx.reviewRun, findingDecision: tx.findingDecision, reviewAuditEvent: tx.reviewAuditEvent } as never;
    const result = await recordFindingDecision({ findingId: "finding-1", companyId: "company-1", userId: "user-1", resolution: "CONFIRMED_ISSUE", expectedUpdatedAt: new Date("2026-09-02T12:00:00.000Z"), role: "EDITOR", correlationId: "corr-1" }, client);
    expect(result.id).toBe("decision-1");
    expect(tx.findingDecision.create).toHaveBeenCalledOnce();
    expect(tx.reviewAuditEvent.create).toHaveBeenCalledOnce();
    expect(tx.reviewAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ correlationId: "corr-1", payloadJson: expect.objectContaining({ role: "EDITOR", newStatus: "RESOLVED" }) }) }));
  });

  it("exposes the complete decision history in finding detail", async () => {
    const row = { ...findingRow(), decisions: [
      { id: "decision-2", userId: "user-2", resolution: "FALSE_POSITIVE", note: "No aplica", expectedUpdatedAt: new Date("2026-09-02T12:02:00.000Z"), createdAt: new Date("2026-09-02T12:03:00.000Z") },
      { id: "decision-1", userId: "user-1", resolution: "CONFIRMED_ISSUE", note: null, expectedUpdatedAt: new Date("2026-09-02T12:00:00.000Z"), createdAt: new Date("2026-09-02T12:01:00.000Z") },
    ] };
    const client = { reviewFinding: { findFirst: vi.fn().mockResolvedValue(row) } } as never;
    const result = await getFinding("finding-1", "company-1", client);
    expect(result.decisionHistory).toHaveLength(2);
  });

  it("rejects decisions for stale runs unless explicitly reconfirmed", async () => {
    const tx = { reviewFinding: { findFirst: vi.fn().mockResolvedValue({ id: "finding-1", companyId: "company-1", projectId: "project-1", budgetId: "budget-1", reviewRunId: "run-1", status: "PENDING", updatedAt: new Date("2026-09-02T12:00:00.000Z") }) }, reviewRun: { findFirst: vi.fn().mockResolvedValue({ id: "run-1", status: "STALE" }) } };
    const client = { $transaction: vi.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)), reviewFinding: tx.reviewFinding, reviewRun: tx.reviewRun } as never;
    await expect(recordFindingDecision({ findingId: "finding-1", companyId: "company-1", userId: "user-1", resolution: "VALID_AS_IS", expectedUpdatedAt: new Date("2026-09-02T12:00:00.000Z") }, client)).rejects.toThrow("reconfirmation");
  });

  it("rejects temporary URL generation when no signing secret is configured", async () => {
    vi.stubEnv("NEXTAUTH_SECRET", undefined);
    vi.stubEnv("AUTH_SECRET", undefined);
    vi.stubEnv("REVIEW_EVIDENCE_SIGNING_SECRET", undefined);
    const client = { reviewFinding: { findFirst: vi.fn().mockResolvedValue(findingRow()) } } as never;
    await expect(getFinding("finding-1", "company-1", client)).rejects.toThrow("signing secret");
    vi.stubEnv("NEXTAUTH_SECRET", "test-review-secret");
  });

  it("requires a post-correction version reference", async () => {
    await expect(recordFindingDecision({ findingId: "finding-1", companyId: "company-1", userId: "user-1", role: "EDITOR", correlationId: "corr-1", resolution: "CORRECTED", expectedUpdatedAt: new Date("2026-09-02T12:00:00.000Z") }, {} as never)).rejects.toThrow("post-correction");
  });

  it("rejects an invented correction document version inside the finding scope", async () => {
    const tx = { reviewFinding: { findFirst: vi.fn().mockResolvedValue({ id: "finding-1", companyId: "company-1", projectId: "project-1", budgetId: "budget-1", budgetItemId: "item-1", reviewRunId: "run-1", status: "PENDING", updatedAt: new Date("2026-09-02T12:00:00.000Z") }) }, reviewRun: { findFirst: vi.fn().mockResolvedValue({ id: "run-1", status: "COMPLETED" }) }, reviewEvidence: { findFirst: vi.fn().mockResolvedValue({ documentVersionId: "version-1", documentVersion: { versionNumber: 1 } }) }, reviewRunDocumentVersion: { findFirst: vi.fn().mockResolvedValue(null) } };
    const client = { $transaction: vi.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)), reviewFinding: tx.reviewFinding, reviewRun: tx.reviewRun, reviewEvidence: tx.reviewEvidence, reviewRunDocumentVersion: tx.reviewRunDocumentVersion } as never;
    await expect(recordFindingDecision({ findingId: "finding-1", companyId: "company-1", userId: "user-1", role: "EDITOR", correlationId: "corr-1", resolution: "CORRECTED", correctionVersionId: "invented-version", expectedUpdatedAt: new Date("2026-09-02T12:00:00.000Z") }, client)).rejects.toThrow("version");
  });

  it("audits link validation and evidence viewing with correlation and role", async () => {
    const linkTx = { entityLink: { findFirst: vi.fn().mockResolvedValue({ id: "link-1", projectId: "project-1", budgetId: "budget-1", budgetItemId: "item-1", evidenceId: "evidence-1", validationStatus: "PENDING" }), update: vi.fn().mockResolvedValue({ id: "link-1", validationStatus: "CONFIRMED", validatedById: "user-1", validatedAt: new Date() }) }, reviewAuditEvent: { create: vi.fn().mockResolvedValue({ id: "audit-link" }) } };
    const linkClient = { $transaction: vi.fn(async (callback: (value: typeof linkTx) => Promise<unknown>) => callback(linkTx)), entityLink: linkTx.entityLink, reviewAuditEvent: linkTx.reviewAuditEvent } as never;
    await validateReviewLink({ linkId: "link-1", companyId: "company-1", userId: "user-1", role: "EDITOR", correlationId: "corr-link", validationStatus: "CONFIRMED" }, linkClient);
    expect(linkTx.reviewAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ correlationId: "corr-link", payloadJson: expect.objectContaining({ role: "EDITOR" }) }) }));
    const expiresAt = Date.now() + 60_000;
    const token = `${expiresAt}.${createHmac("sha256", "test-review-secret").update(`evidence-1.${expiresAt}`).digest("base64url")}`;
    const evidenceClient = { reviewEvidence: { findFirst: vi.fn().mockResolvedValue({ id: "evidence-1", projectId: "project-1", documentVersionId: "version-1", evidenceType: "QUANTITY", originalText: "1", normalizedText: null, locationJson: {}, unit: "m2", extractionMethod: "xlsx", confidence: "HIGH", sourceHash: "hash" }) }, reviewAuditEvent: { create: vi.fn().mockResolvedValue({ id: "audit-view" }) } } as never;
    await viewReviewEvidence({ evidenceId: "evidence-1", companyId: "company-1", userId: "user-1", role: "VIEWER", correlationId: "corr-view", token }, evidenceClient);
    expect(evidenceClient.reviewAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ correlationId: "corr-view", payloadJson: expect.objectContaining({ role: "VIEWER" }) }) }));
  });

  it("filters persisted discipline and child budgets by parentBudgetId", async () => {
    const reviewRunFindFirst = vi.fn().mockResolvedValue({ id: "run-1", projectId: "project-1", budgetId: "child-budget" });
    const reviewFindingFindMany = vi.fn().mockResolvedValue([]);
    const client = { reviewRun: { findFirst: reviewRunFindFirst }, reviewFinding: { findMany: reviewFindingFindMany } } as never;
    await listFindings({ companyId: "company-1", reviewRunId: "run-1", page: 1, pageSize: 25, discipline: "Estructuras", subbudget: "parent-budget" }, client);
    expect(reviewFindingFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ discipline: "Estructuras", budget: { id: "child-budget", projectId: "project-1", parentBudgetId: "parent-budget" } }) }));
  });
});
