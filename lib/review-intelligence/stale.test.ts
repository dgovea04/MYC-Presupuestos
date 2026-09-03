import { describe, expect, it, vi } from "vitest";
import { changeFingerprint, markReviewRunsStale, markStaleForChange } from "./stale";

describe("review stale invalidation", () => {
  it("marks only active or completed runs for the affected project/budget", async () => {
    const client = { reviewRun: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) }, budget: { findFirst: vi.fn().mockResolvedValueOnce({ id: "b", parentBudgetId: "parent" }).mockResolvedValueOnce({ id: "parent", parentBudgetId: null }) } };
    await expect(markReviewRunsStale({ companyId: "c", projectId: "p", budgetId: "b", fingerprint: "f" }, client)).resolves.toBe(2);
    expect(client.reviewRun.updateMany).toHaveBeenCalledWith({ where: expect.objectContaining({ companyId: "c", projectId: "p", budgetId: { in: ["b", "parent"] }, status: { in: expect.arrayContaining(["RUNNING", "COMPLETED"]) } }), data: { status: "STALE", progressJson: { staleFingerprint: "f" } } });
  });

  it("uses stable fingerprints for each change kind and payload", async () => {
    const client = { reviewRun: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } };
    const first = changeFingerprint({ kind: "classification", id: "doc", payload: "PLAN" });
    const second = changeFingerprint({ kind: "classification", id: "doc", payload: "APU" });
    expect(first).not.toBe(second);
    await markStaleForChange({ companyId: "c", projectId: "p", kind: "classification", id: "doc", payload: "PLAN" }, client);
    expect(client.reviewRun.updateMany.mock.calls[0]?.[0].data.progressJson.staleFingerprint).toBe(first);
  });
});
