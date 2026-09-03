import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import PDFDocument from "pdfkit";
import { extractDocument } from "./extractors";
import { runReviewJob, type ReviewPipelineClient, type RunReviewJobInput } from "./pipeline";

function client(): ReviewPipelineClient & { runs: Array<Record<string, unknown>>; evidence: Array<Record<string, unknown>>; links: Array<Record<string, unknown>>; findings: Array<Record<string, unknown>>; events: Array<Record<string, unknown>>; beforeTransaction?: (count: number) => void } {
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
  store.reviewEvidence = { findFirst: async ({ where }) => store.evidence.find((entry) => entry.documentVersionId === where.documentVersionId && entry.sourceHash === where.sourceHash) ?? null, upsert: async ({ create, update }) => { const existing = store.evidence.find((entry) => entry.documentVersionId === create.documentVersionId && entry.sourceHash === create.sourceHash); if (existing) return Object.assign(existing, update); const entry = { id: create.id ?? `evidence-${store.evidence.length + 1}`, ...create }; store.evidence.push(entry); return entry; } };
  store.entityLink = { findFirst: async ({ where }) => store.links.find((entry) => entry.budgetItemId === where.budgetItemId && entry.evidenceId === where.evidenceId) ?? null, upsert: async ({ create, update }) => { const existing = store.links.find((entry) => entry.id === create.id); if (existing) return Object.assign(existing, update); const entry = { id: create.id ?? `link-${store.links.length + 1}`, ...create }; store.links.push(entry); return entry; } };
  store.reviewFinding = { findFirst: async ({ where }) => store.findings.find((entry) => entry.reviewRunId === where.reviewRunId && entry.evidenceId === where.evidenceId && entry.findingType === where.findingType && entry.budgetItemId === where.budgetItemId) ?? null, upsert: async ({ create, update }) => { const existing = store.findings.find((entry) => entry.id === create.id); if (existing) return Object.assign(existing, update); const entry = { id: create.id ?? `finding-${store.findings.length + 1}`, ...create }; store.findings.push(entry); return entry; } };
  store.reviewAuditEvent = { create: async ({ data }) => { store.events.push(data); return data; } };
  store.budget = { findFirst: async ({ where }) => where.id === "budget-1" && (where.project as { companyId?: string } | undefined)?.companyId === "company-1" && where.projectId === "project-1" ? { id: "budget-1" } : null, findMany: async () => [{ id: "budget-1", parentBudgetId: null }] };
  store.budgetVersionSnapshot = { findFirst: async ({ where }) => where.budgetId === "budget-1" && where.companyId === "company-1" && where.projectId === "project-1" ? { id: "base-version-1", versionNumber: 1, snapshot: { items: [{ id: "item-1", budgetId: "budget-1" }] } } : null };
  store.project = { findFirst: async ({ where }) => where.id === "project-1" && where.companyId === "company-1" ? { id: "project-1" } : null };
  store.documentVersion = { findFirst: async ({ where }) => where.id === "version-1" && where.companyId === "company-1" && where.projectId === "project-1" ? { id: "version-1", projectDocumentId: "document-1" } : null };
  store.projectDocument = { findFirst: async ({ where }) => where.id === "document-1" && where.companyId === "company-1" && where.projectId === "project-1" ? { id: "document-1" } : null };
  store.budgetItem = { findFirst: async ({ where }) => where.id === "item-1" && where.budgetId === "budget-1" ? { id: "item-1" } : null };
  let transactionCount = 0;
  store.$transaction = async (callback) => { transactionCount += 1; store.beforeTransaction?.(transactionCount); return callback(store); };
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
  it("rejects a review when the selected documents have no extracted evidence", async () => {
    const database = client();
    await expect(runReviewJob({ ...input(), evidence: [] }, database)).rejects.toThrow("No extracted evidence is available");
    expect(database.runs).toHaveLength(0);
  });

  it("reuses an explicit idempotency key and conflicts on a changed request", async () => {
    const database = client();
    const request = { ...input(), idempotencyKey: "client-key-1" };
    const first = await runReviewJob(request, database);
    const second = await runReviewJob(request, database);
    expect(first).toMatchObject({ reviewRunId: second.reviewRunId, idempotencyKey: "client-key-1" });
    await expect(runReviewJob({ ...request, configuration: { ...request.configuration, tolerancePercent: "2" } }, database)).rejects.toThrow("Idempotency key");
  });
  it("persists the eight stages in order and publishes guarded findings", async () => {
    const database = client();
    const result = await runReviewJob(input(), database);
    expect(result.status).toBe("COMPLETED");
    expect(result.stages).toEqual(["validating", "extracting", "classifying", "identifying evidence", "matching", "rules", "prioritizing", "completed"]);
    expect(database.runs[0].progressJson).toMatchObject({ stage: "completed", percent: 100 });
    expect(database.findings).toHaveLength(1);
    expect(database.findings[0]).toMatchObject({ humanReviewRequired: true, automaticBudgetMutation: false });
    expect(database.evidence).toHaveLength(1);
    const persistedEvidenceIds = new Set(database.evidence.map((entry) => entry.id));
    expect(database.links.every((link) => persistedEvidenceIds.has(link.evidenceId))).toBe(true);
    expect(database.findings.every((finding) => persistedEvidenceIds.has(finding.evidenceId))).toBe(true);
    expect(database.findings[0].entityLinkId).toBe(database.links[0].id);
    expect(database.links.some((link) => link.id === database.findings[0].entityLinkId)).toBe(true);
  });

  it("runs on a parent budget while preserving child subbudget ownership on findings", async () => {
    const database = client();
    database.budget.findMany = async () => [
      { id: "budget-1", parentBudgetId: null },
      { id: "sub-budget-a", parentBudgetId: "budget-1" },
      { id: "sub-budget-b", parentBudgetId: "budget-1" },
    ];
    database.budgetItem.findFirst = async ({ where }) => ({ id: String(where.id) });
    database.budgetVersionSnapshot.findFirst = async ({ where }) => ({ id: `base-${String(where.budgetId)}`, versionNumber: 1, snapshot: { items: [{ id: String(where.budgetId === "sub-budget-a" ? "item-a" : "item-b"), budgetId: where.budgetId }] } });
    const result = await runReviewJob({
      ...input(),
      budgetItems: [
        { ...input().budgetItems[0], id: "item-a", budgetId: "sub-budget-a", code: "A-1" },
        { ...input().budgetItems[0], id: "item-b", budgetId: "sub-budget-b", code: "B-1" },
      ],
    }, database);
    expect(result.status).toBe("COMPLETED");
    expect(database.findings.map((finding) => finding.budgetId)).toEqual(expect.arrayContaining(["sub-budget-a", "sub-budget-b"]));
    expect(database.findings.every((finding) => finding.reviewRunId === result.reviewRunId)).toBe(true);
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
    database.documentVersion.findFirst = async () => null;
    await expect(runReviewJob({ ...input(), documentVersions: [{ id: "version-1", companyId: "other", projectId: "project-1" }] }, database)).rejects.toThrow("database");
    database.documentVersion.findFirst = async () => ({ id: "version-1", projectDocumentId: "document-1" });
    database.budgetItem.findFirst = async () => null;
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
    database.budget.findFirst = async () => null;
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

  it("does not let an expired worker checkpoint, audit, publish, or cancel", async () => {
    const database = client();
    await expect(runReviewJob({ ...input(), shouldCancel: () => { const progress = database.runs[0].progressJson as { lease: { expiresAt: string } }; progress.lease.expiresAt = new Date(0).toISOString(); return false; } }, database)).rejects.toThrow("lease");
    expect(database.runs[0].status).toBe("RUNNING");
    expect(database.events.some((event) => event.eventType === "REVIEW_STAGE_COMPLETED")).toBe(false);
  });

  it("does not publish stage results after another worker takes the lease", async () => {
    const database = client();
    database.beforeTransaction = (count) => {
      if (count === 7) {
        const run = database.runs[0];
        run.progressJson = { ...(run.progressJson as Record<string, unknown>), lease: { token: "new-worker", expiresAt: new Date(Date.now() + 60_000).toISOString() } };
      }
    };

    await expect(runReviewJob(input(), database)).rejects.toThrow("lease");
    expect(database.findings).toHaveLength(0);
    expect(database.events).toHaveLength(3);
  });

  it("uses database ownership, not caller references, for every scoped entity", async () => {
    const database = client();
    await expect(runReviewJob({ ...input(), budgetReference: { id: "budget-1", companyId: "company-1", projectId: "project-1" }, budgetId: "budget-other" }, database)).rejects.toThrow("Budget does not belong");
    database.documentVersion.findFirst = async () => null;
    await expect(runReviewJob({ ...input(), documentVersions: [{ id: "version-1", companyId: "other", projectId: "project-1" }] }, database)).rejects.toThrow("database");
  });

  it("creates and uses a base snapshot when a new budget has none", async () => {
    const database = client();
    database.budgetVersionSnapshot.findFirst = async () => null;
    database.budgetVersionSnapshot.create = async ({ data }) => ({ id: "auto-base-1", ...data });
    const result = await runReviewJob(input(), database);
    expect(result.status).toBe("COMPLETED");
    expect(database.findings[0]?.baseSnapshotId).toBe("auto-base-1");
  });

  it("persists PDF technical specification and APU components through the pipeline", async () => {
    const database = client();
    await runReviewJob({ ...input(), evidence: [{ ...input().evidence[0], technicalSpecification: "f'c 210", apuComponents: ["cemento", "arena"] }] }, database);
    expect(database.evidence[0]?.metadataJson).toMatchObject({ technicalSpec: "f'c 210", apuComponents: ["cemento", "arena"] });
  });

  it("evaluates missing documentation for every item without a primary match", async () => {
    const database = client();
    database.budgetItem.findFirst = async ({ where }) => ({ id: String(where.id) });
    const result = await runReviewJob({
      ...input(),
      configuration: { ...input().configuration, findingTypes: ["MISSING_DOCUMENTATION"] },
      budgetItems: [input().budgetItems[0], { ...input().budgetItems[0], id: "item-2", code: "B-2", description: "Instalación eléctrica" }],
      evidence: [{ ...input().evidence[0], id: "evidence-unrelated", code: "Z-9", description: "Documento de seguridad", confidence: "HIGH" }],
    }, database);
    expect(result.status).toBe("COMPLETED");
    expect(database.findings).toHaveLength(2);
    expect(database.findings.every((finding) => finding.findingType === "MISSING_DOCUMENTATION")).toBe(true);
    expect(database.findings.every((finding) => finding.evidenceId === database.evidence[0]?.id)).toBe(true);
  });

  it("evaluates quantity only against the best primary match for each item", async () => {
    const database = client();
    const result = await runReviewJob({
      ...input(),
      evidence: [
        { ...input().evidence[0], code: "A-1", description: "Concreto", quantity: new Decimal("12") },
        { ...input().evidence[0], id: "evidence-secondary", sourceHash: "source-secondary", code: undefined, description: "Concreto", quantity: new Decimal("15") },
      ],
    }, database);

    expect(result.status).toBe("COMPLETED");
    expect(database.findings).toHaveLength(1);
    expect(database.findings[0]?.comparisonJson).toMatchObject({ documentValue: "12" });
  });

  it("publishes UNIT_INCONSISTENCY from PDFKit evidence through matching", async () => {
    const document = new PDFDocument();
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    const finished = new Promise<Buffer>((resolve) => document.on("end", () => resolve(Buffer.concat(chunks))));
    document.text("A-1 CONCRETO 12 kg");
    document.end();
    const extracted = await extractDocument({ file: new File([await finished], "unit.pdf", { type: "application/pdf" }) });
    const item = extracted.items[0];
    if (!item?.metadata?.code || !item.metadata.description || !item.metadata.quantity || !item.metadata.unit) throw new Error("PDFKit fixture did not produce structured evidence");
    const database = client();
    const result = await runReviewJob({
      ...input(),
      configuration: { ...input().configuration, findingTypes: ["UNIT_INCONSISTENCY"] },
      budgetItems: [{ ...input().budgetItems[0], code: item.metadata.code, description: item.metadata.description, unit: "m3", quantity: new Decimal(item.metadata.quantity) }],
      evidence: [{ ...input().evidence[0], originalText: item.content, normalizedText: item.content, code: item.metadata.code, description: item.metadata.description, unit: item.metadata.unit, quantity: new Decimal(item.metadata.quantity), locationJson: { page: item.location?.page } }],
    }, database);
    expect(result.status).toBe("COMPLETED");
    expect(database.findings).toEqual(expect.arrayContaining([expect.objectContaining({ findingType: "UNIT_INCONSISTENCY" })]));
  });
});
