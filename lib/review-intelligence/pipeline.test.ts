import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { runReviewJob, type ReviewPipelineClient, type RunReviewJobInput } from "./pipeline";

function client(): ReviewPipelineClient & { runs: Array<Record<string, unknown>>; evidence: Array<Record<string, unknown>>; links: Array<Record<string, unknown>>; findings: Array<Record<string, unknown>>; events: Array<Record<string, unknown>> } {
  const store = { runs: [], evidence: [], links: [], findings: [], events: [] } as ReturnType<typeof client>;
  store.reviewRun = {
    findFirst: async ({ where }) => store.runs.find((run) => run.id === where.id || (run.budgetId === where.budgetId && run.companyId === where.companyId && run.projectId === where.projectId)) ?? null,
    findUnique: async ({ where }) => store.runs.find((run) => run.id === where.id || (run.id === (where.id_companyId_projectId as { id?: string } | undefined)?.id && run.companyId === (where.id_companyId_projectId as { companyId?: string } | undefined)?.companyId && run.projectId === (where.id_companyId_projectId as { projectId?: string } | undefined)?.projectId)) ?? null,
    findMany: async ({ where }) => store.runs.filter((run) => run.budgetId === where.budgetId && run.companyId === where.companyId && run.projectId === where.projectId),
    create: async ({ data }) => { if (store.runs.some((run) => run.id === data.id)) throw new Error("P2002"); const run = { id: data.id ?? `run-${store.runs.length + 1}`, ...data }; store.runs.push(run); return run; },
    update: async ({ where, data }) => { const run = store.runs.find((entry) => entry.id === where.id && (!where.status || entry.status === where.status))!; Object.assign(run, data); return run; },
    updateMany: async ({ where, data }) => { const compound = where.id_companyId_projectId as { id?: string; companyId?: string; projectId?: string } | undefined; const run = store.runs.find((entry) => (entry.id === where.id || entry.id === compound?.id) && (!where.status || typeof where.status === "string" && entry.status === where.status || typeof where.status === "object" && (where.status as { in?: unknown[] }).in?.includes(entry.status)) && (!where.progressJson || JSON.stringify(entry.progressJson) === JSON.stringify((where.progressJson as { equals?: unknown }).equals))); if (!run) return { count: 0 }; Object.assign(run, data); return { count: 1 }; },
  };
  store.reviewRunDocumentVersion = { upsert: async ({ create }) => create };
  store.reviewEvidence = { findFirst: async ({ where }) => store.evidence.find((entry) => entry.documentVersionId === where.documentVersionId && entry.sourceHash === where.sourceHash) ?? null, create: async ({ data }) => { if (store.evidence.some((entry) => entry.id === data.id)) throw new Error("P2002"); const entry = { id: data.id ?? `evidence-${store.evidence.length + 1}`, ...data }; store.evidence.push(entry); return entry; } };
  store.entityLink = { findFirst: async ({ where }) => store.links.find((entry) => entry.budgetItemId === where.budgetItemId && entry.evidenceId === where.evidenceId) ?? null, create: async ({ data }) => { if (store.links.some((entry) => entry.id === data.id)) throw new Error("P2002"); const entry = { id: data.id ?? `link-${store.links.length + 1}`, ...data }; store.links.push(entry); return entry; } };
  store.reviewFinding = { findFirst: async ({ where }) => store.findings.find((entry) => entry.reviewRunId === where.reviewRunId && entry.evidenceId === where.evidenceId && entry.findingType === where.findingType && entry.budgetItemId === where.budgetItemId) ?? null, create: async ({ data }) => { if (store.findings.some((entry) => entry.id === data.id)) throw new Error("P2002"); const entry = { id: data.id ?? `finding-${store.findings.length + 1}`, ...data }; store.findings.push(entry); return entry; } };
  store.reviewAuditEvent = { create: async ({ data }) => { store.events.push(data); return data; } };
  store.$transaction = async (callback) => callback(store);
  return store;
}

const input = (): RunReviewJobInput => ({
  companyId: "company-1", projectId: "project-1", budgetId: "budget-1", createdById: "user-1",
  documentVersionIds: ["version-1"], documentVersions: [{ id: "version-1", companyId: "company-1", projectId: "project-1" }], budgetReference: { id: "budget-1", companyId: "company-1", projectId: "project-1" }, rulesVersion: "review-rules-v1",
  configuration: { maxFiles: 1, maxPdfPages: 300, maxFileSizeMb: 50, maxXlsxSheets: 20, tolerancePercent: "1", findingTypes: ["QUANTITY_MISMATCH"] },
  budgetItems: [{ id: "item-1", budgetId: "budget-1", companyId: "company-1", projectId: "project-1", code: "A-1", description: "Concreto", unit: "m3", quantity: new Decimal("10"), unitPrice: new Decimal("100") }],
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
    const result = await runReviewJob({ ...input(), configuration: { ...input().configuration, findingTypes: ["MISSING_DOCUMENTATION"] }, extractionWarnings: [{ code: "EXTRACTION_PROCESSING", message: "processing incomplete", source: "version-1" }], evidence: [{ ...input().evidence[0], id: "evidence-affected", description: "Otra partida", confidence: "LOW" }] }, database);
    expect(result.status).toBe("COMPLETED_WITH_WARNINGS");
    expect(result.warnings).toEqual([{ code: "EXTRACTION_PROCESSING", message: "processing incomplete", source: "version-1" }]);
    expect(database.findings).toHaveLength(0);
  });

  it("cooperatively cancels before publishing later stages", async () => {
    const database = client();
    const result = await runReviewJob({ ...input(), shouldCancel: () => true }, database);
    expect(result.status).toBe("CANCELLED");
    expect(database.runs[0].progressJson).toMatchObject({ stage: "validating" });
    expect(database.findings).toHaveLength(0);
  });

  it("converges concurrent same-key requests to one persisted run", async () => {
    const database = client();
    const [first, second] = await Promise.all([runReviewJob(input(), database), runReviewJob(input(), database)]);
    expect(first.reviewRunId).toBe(second.reviewRunId);
    expect(database.runs).toHaveLength(1);
  });

  it("rejects a different input while another run for the budget is active", async () => {
    const database = client();
    database.runs.push({ id: "active-run", companyId: "company-1", projectId: "project-1", budgetId: "budget-1", status: "RUNNING", progressJson: { checkpoints: [] }, warningsJson: [] });
    await expect(runReviewJob({ ...input(), configuration: { ...input().configuration, tolerancePercent: "2" } }, database)).rejects.toThrow("active review run");
  });

  it("resumes a failed run at its failed checkpoint without duplicating results", async () => {
    const database = client();
    let fail = true;
    const failingInput = { ...input(), shouldCancel: async () => { if (fail) { fail = false; throw new Error("rules unavailable"); } return false; } };
    await expect(runReviewJob(failingInput, database)).rejects.toThrow("rules unavailable");
    const resumed = await runReviewJob(failingInput, database);
    expect(resumed.status).toBe("COMPLETED_WITH_WARNINGS");
    expect(database.runs).toHaveLength(1);
    expect(database.findings).toHaveLength(1);
  });

  it("also resumes a stale run for the same input", async () => {
    const database = client();
    const staleInput = { ...input(), shouldCancel: () => { throw new Error("temporary failure"); } };
    await expect(runReviewJob(staleInput, database)).rejects.toThrow("temporary failure");
    database.runs[0].status = "STALE";
    const resumed = await runReviewJob({ ...staleInput, shouldCancel: () => false }, database);
    expect(resumed.status).toBe("COMPLETED_WITH_WARNINGS");
    expect(database.runs).toHaveLength(1);
  });

  it("persists every stage with counts, correlation, and audit events", async () => {
    const database = client();
    await runReviewJob(input(), database);
    const checkpoints = (database.runs[0].progressJson as { checkpoints: Array<Record<string, unknown>> }).checkpoints;
    expect(checkpoints).toHaveLength(8);
    expect(checkpoints.every((entry) => typeof entry.correlationId === "string" && typeof entry.count === "number" && entry.status === "COMPLETED")).toBe(true);
    expect(database.events).toHaveLength(8);
  });

  it("rejects cross-tenant document versions and budget items", async () => {
    const database = client();
    await expect(runReviewJob({ ...input(), documentVersions: [{ id: "version-1", companyId: "other", projectId: "project-1" }] }, database)).rejects.toThrow("does not belong");
    await expect(runReviewJob({ ...input(), budgetItems: [{ ...input().budgetItems[0], companyId: "other" }] }, database)).rejects.toThrow("does not belong");
  });

  it("records a failed stage and warning before rethrowing", async () => {
    const database = client();
    const failing = { ...input(), shouldCancel: () => { throw new Error("boom"); } };
    await expect(runReviewJob(failing, database)).rejects.toThrow("boom");
    expect(database.runs[0].status).toBe("FAILED");
    expect(database.runs[0].warningsJson).toEqual(expect.arrayContaining([expect.objectContaining({ code: "STAGE_FAILED" })]));
  });

  it("does not overwrite a cancellation committed by another actor", async () => {
    const database = client();
    const result = await runReviewJob({ ...input(), shouldCancel: () => { database.runs[0].status = "CANCELLED"; return true; } }, database);
    expect(result.status).toBe("CANCELLED");
    expect(database.runs[0].status).toBe("CANCELLED");
  });

  it("claims a RUNNING run so only one concurrent worker executes stages", async () => {
    const database = client();
    let executions = 0;
    const gated = { ...input(), shouldCancel: async () => { executions += 1; await new Promise((resolve) => setTimeout(resolve, 1)); return false; } };
    const results = await Promise.all([runReviewJob(gated, database), runReviewJob(gated, database)]);
    expect(results[0].reviewRunId).toBe(results[1].reviewRunId);
    expect(executions).toBe(8);
    expect(database.events).toHaveLength(8);
  });

  it("requires the exact document version set and budget ownership before creating a run", async () => {
    const database = client();
    await expect(runReviewJob({ ...input(), documentVersionIds: ["version-1", "version-2"] }, database)).rejects.toThrow("exact");
    await expect(runReviewJob({ ...input(), budgetReference: { id: "budget-1", companyId: "other", projectId: "project-1" } }, database)).rejects.toThrow("Budget does not belong");
    expect(database.runs).toHaveLength(0);
  });

  it("deduplicates concurrent result insertion by stable evidence, link, and finding keys", async () => {
    const database = client();
    await Promise.all([runReviewJob(input(), database), runReviewJob(input(), database)]);
    expect(database.evidence).toHaveLength(1);
    expect(database.links).toHaveLength(1);
    expect(database.findings).toHaveLength(1);
  });
});
