import { describe, expect, it, vi } from "vitest";
import { changeFingerprint, getBudgetPatchStalenessChanges, markReviewRunsStale, markStaleForChange, reviewStalenessChangeKinds } from "./staleness";

function clientForRuns() {
  const runs = [
    { id: "run-running", status: "RUNNING", progressJson: { stage: "rules", results: ["finding-1"] } },
    { id: "run-completed", status: "COMPLETED", progressJson: { stage: "completed", results: ["finding-2"] } },
  ];
  return {
    runs,
    reviewRun: {
      findMany: vi.fn().mockResolvedValue(runs),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    reviewAuditEvent: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
  };
}

describe("review staleness", () => {
  it("marks affected runs stale and appends an audit event without removing persisted results", async () => {
    const client = clientForRuns();

    await expect(markStaleForChange({
      companyId: "company-1",
      projectId: "project-1",
      budgetId: "budget-1",
      kind: "budget-item-quantity",
      id: "item-1",
      payload: { before: "10", after: "12" },
      actorUserId: "user-1",
    }, client)).resolves.toBe(2);

    expect(client.reviewRun.updateMany).toHaveBeenCalledTimes(2);
    expect(client.reviewRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "run-running", status: "RUNNING" }),
      data: expect.objectContaining({ status: "STALE", progressJson: expect.objectContaining({ results: ["finding-1"] }) }),
    }));
    expect(client.reviewAuditEvent.create).toHaveBeenCalledTimes(2);
    expect(client.reviewAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        reviewRunId: "run-running",
        actorUserId: "user-1",
        eventType: "REVIEW_RUN_STALE",
        payloadJson: expect.objectContaining({ previousStatus: "RUNNING", newStatus: "STALE", kind: "budget-item-quantity" }),
      }),
    }));
  });

  it("uses the same fingerprint and audit correlation for an identical change", async () => {
    const client = clientForRuns();
    const input = { companyId: "company-1", projectId: "project-1", kind: "tolerance", id: "budget-1", payload: { tolerancePercent: "1.00" } } as const;
    const fingerprint = changeFingerprint({ kind: input.kind, id: input.id, payload: input.payload });

    await markStaleForChange(input, client);

    const update = client.reviewRun.updateMany.mock.calls[0]?.[0];
    const audit = client.reviewAuditEvent.create.mock.calls[0]?.[0];
    expect(update.data.progressJson.staleFingerprint).toBe(fingerprint);
    expect(audit.data.correlationId).toBe(fingerprint);
  });

  it("exposes the complete V0 invalidation vocabulary", () => {
    expect(reviewStalenessChangeKinds).toEqual(expect.arrayContaining([
      "budget-item-quantity",
      "budget-item-unit",
      "budget-item-description",
      "budget-item-apu",
      "document-replacement",
      "document-classification",
      "review-rules",
      "review-tolerance",
    ]));
  });

  it("preserves the cooperative cancellation contract", async () => {
    const client = clientForRuns();
    client.runs.push({ id: "run-cancel-requested", status: "CANCEL_REQUESTED", progressJson: { stage: "rules" } });
    client.reviewRun.findMany.mockResolvedValue(client.runs);

    await markStaleForChange({ companyId: "company-1", projectId: "project-1", kind: "review-rules", id: "rules-v2", payload: { version: "v2" } }, client);

    expect(client.reviewRun.updateMany).toHaveBeenCalledTimes(2);
    expect(client.reviewRun.updateMany.mock.calls.some(([call]) => call.where.id === "run-cancel-requested")).toBe(false);
  });

  it("classifies budget editor changes into field-specific invalidations", () => {
    const changes = getBudgetPatchStalenessChanges({
      items: {
        update: [{ id: "item-1", changes: { quantity: "12", unit: "m2", description: "Losa", apu: { id: "apu-1" } } }],
      },
      tolerancePercent: "2.00",
      rulesVersion: "review-rules-v2",
    });

    expect(changes.map((change) => change.kind)).toEqual(expect.arrayContaining([
      "budget-item-quantity",
      "budget-item-unit",
      "budget-item-description",
      "budget-item-apu",
      "review-tolerance",
      "review-rules",
    ]));
    expect(changes.filter((change) => change.id === "item-1")).toHaveLength(4);
  });
});
