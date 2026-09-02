import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { runReviewJob, type ReviewPipelineClient, type RunReviewJobInput } from "./pipeline";

function client(): ReviewPipelineClient & { runs: Array<Record<string, unknown>>; evidence: Array<Record<string, unknown>>; links: Array<Record<string, unknown>>; findings: Array<Record<string, unknown>>; events: Array<Record<string, unknown>> } {
  const store = { runs: [], evidence: [], links: [], findings: [], events: [] } as ReturnType<typeof client>;
  store.reviewRun = {
    findFirst: async ({ where }) => store.runs.find((run) => run.budgetId === where.budgetId && run.companyId === where.companyId && run.projectId === where.projectId && run.configurationJson && (run.configurationJson as { idempotencyKey?: string }).idempotencyKey === where.idempotencyKey) ?? null,
    findUnique: async ({ where }) => store.runs.find((run) => run.id === where.id && run.companyId === where.companyId && run.projectId === where.projectId) ?? null,
    findMany: async ({ where }) => store.runs.filter((run) => run.budgetId === where.budgetId && run.companyId === where.companyId && run.projectId === where.projectId),
    create: async ({ data }) => { const run = { id: `run-${store.runs.length + 1}`, ...data }; store.runs.push(run); return run; },
    update: async ({ where, data }) => { const run = store.runs.find((entry) => entry.id === where.id)!; Object.assign(run, data); return run; },
  };
  store.reviewRunDocumentVersion = { upsert: async ({ create }) => create };
  store.reviewEvidence = { findFirst: async ({ where }) => store.evidence.find((entry) => entry.documentVersionId === where.documentVersionId && entry.sourceHash === where.sourceHash) ?? null, create: async ({ data }) => { const entry = { id: `evidence-${store.evidence.length + 1}`, ...data }; store.evidence.push(entry); return entry; } };
  store.entityLink = { findFirst: async ({ where }) => store.links.find((entry) => entry.budgetItemId === where.budgetItemId && entry.evidenceId === where.evidenceId) ?? null, create: async ({ data }) => { const entry = { id: `link-${store.links.length + 1}`, ...data }; store.links.push(entry); return entry; } };
  store.reviewFinding = { findFirst: async ({ where }) => store.findings.find((entry) => entry.reviewRunId === where.reviewRunId && entry.evidenceId === where.evidenceId && entry.findingType === where.findingType && entry.budgetItemId === where.budgetItemId) ?? null, create: async ({ data }) => { const entry = { id: `finding-${store.findings.length + 1}`, ...data }; store.findings.push(entry); return entry; } };
  store.reviewAuditEvent = { create: async ({ data }) => { store.events.push(data); return data; } };
  store.$transaction = async (callback) => callback(store);
  return store;
}

const input = (): RunReviewJobInput => ({
  companyId: "company-1", projectId: "project-1", budgetId: "budget-1", createdById: "user-1",
  documentVersionIds: ["version-1"], rulesVersion: "review-rules-v1",
  configuration: { maxFiles: 1, maxPdfPages: 300, maxFileSizeMb: 50, maxXlsxSheets: 20, tolerancePercent: "1", findingTypes: ["QUANTITY_MISMATCH"] },
  budgetItems: [{ id: "item-1", budgetId: "budget-1", code: "A-1", description: "Concreto", unit: "m3", quantity: new Decimal("10"), unitPrice: new Decimal("100") }],
  evidence: [{ id: "evidence-source-1", documentVersionId: "version-1", primary: true, originalText: "Concreto 12 m3", normalizedText: "Concreto 12 m3", sourceHash: "source-1", evidenceType: "QUANTITY", quantity: new Decimal("12"), unit: "m3", confidence: "HIGH", locationJson: { sheet: "Hoja 1", range: "A1" } }],
});

describe("runReviewJob", () => {
  it("persists the eight stages in order and publishes guarded findings", async () => {
    const database = client();
    const result = await runReviewJob(input(), database);
    expect(result.status).toBe("COMPLETED");
    expect(result.stages).toEqual(["validating", "extracting", "classifying", "identifying evidence", "matching", "rules", "prioritizing", "completed"]);
    expect(database.runs[0].progressJson).toMatchObject({ stage: "completed", percent: 100 });
    expect(database.findings).toHaveLength(1);
    expect(database.findings[0]).toMatchObject({ humanReviewRequired: true, automaticBudgetMutation: false });
    expect(database.evidence).toHaveLength(1);
  });

  it("retries idempotently without duplicating evidence, links, or findings", async () => {
    const database = client();
    const first = await runReviewJob(input(), database);
    const second = await runReviewJob(input(), database);
    expect(second.reviewRunId).toBe(first.reviewRunId);
    expect(database.runs).toHaveLength(1);
    expect(database.evidence).toHaveLength(1);
    expect(database.links).toHaveLength(1);
    expect(database.findings).toHaveLength(1);
  });

  it("completes with warnings and suppresses absence findings for affected evidence", async () => {
    const database = client();
    const result = await runReviewJob({ ...input(), extractionWarnings: [{ code: "PDF_LOCATION_UNAVAILABLE", message: "location unavailable", source: "version-1" }], evidence: [] }, database);
    expect(result.status).toBe("COMPLETED_WITH_WARNINGS");
    expect(result.warnings).toEqual([{ code: "PDF_LOCATION_UNAVAILABLE", message: "location unavailable", source: "version-1" }]);
    expect(database.findings).toHaveLength(0);
  });

  it("cooperatively cancels before publishing later stages", async () => {
    const database = client();
    const result = await runReviewJob({ ...input(), shouldCancel: () => true }, database);
    expect(result.status).toBe("CANCELLED");
    expect(database.runs[0].progressJson).toMatchObject({ stage: "validating" });
    expect(database.findings).toHaveLength(0);
  });
});
