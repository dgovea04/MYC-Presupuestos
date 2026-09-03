import { describe, expect, it, vi } from "vitest";
import { markReviewRunStatus, readReviewRunStatus } from "./lifecycle";

const expectedUpdatedAt = new Date("2026-09-03T12:00:00.000Z");

function client(overrides: Record<string, unknown> = {}) {
  const reviewRun = {
    findFirst: vi.fn().mockResolvedValue({ id: "run-1", companyId: "company-1", projectId: "project-1", status: "COMPLETED", updatedAt: expectedUpdatedAt }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
  const reviewFinding = { count: vi.fn().mockResolvedValue(0) };
  const reviewAuditEvent = { create: vi.fn().mockResolvedValue({ id: "audit-1" }) };
  return { reviewRun, reviewFinding, reviewAuditEvent, $transaction: vi.fn(async (callback: (value: unknown) => Promise<unknown>) => callback({ reviewRun, reviewFinding, reviewAuditEvent })), ...overrides };
}

describe("review lifecycle", () => {
  it("moves a completed run to UNDER_REVIEW and records the actor audit", async () => {
    const database = client();
    await expect(markReviewRunStatus({ runId: "run-1", companyId: "company-1", userId: "user-1", role: "EDITOR", targetStatus: "UNDER_REVIEW", expectedUpdatedAt, correlationId: "corr-1" }, database as never)).resolves.toMatchObject({ status: "UNDER_REVIEW" });
    expect(database.reviewRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ updatedAt: expectedUpdatedAt, status: "COMPLETED" }), data: { status: "UNDER_REVIEW" } }));
    expect(database.reviewAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: "REVIEW_MARKED_UNDER_REVIEW", correlationId: "corr-1", actorUserId: "user-1", payloadJson: expect.objectContaining({ role: "EDITOR" }) }) }));
  });

  it("moves UNDER_REVIEW to REVIEWED only when no pending, in-review, or stale findings exist", async () => {
    const database = client();
    database.reviewRun.findFirst.mockResolvedValue({ id: "run-1", companyId: "company-1", projectId: "project-1", status: "UNDER_REVIEW", updatedAt: expectedUpdatedAt });
    await expect(markReviewRunStatus({ runId: "run-1", companyId: "company-1", userId: "user-1", role: "EDITOR", targetStatus: "REVIEWED", expectedUpdatedAt, correlationId: "corr-2" }, database as never)).resolves.toMatchObject({ status: "REVIEWED" });
    expect(database.reviewFinding.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: { in: ["PENDING", "IN_REVIEW", "STALE"] } }) }));
    expect(database.reviewAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: "REVIEW_MARKED_REVIEWED", correlationId: "corr-2" }) }));
  });

  it("blocks REVIEWED while findings remain unresolved and rejects optimistic concurrency conflicts", async () => {
    const database = client();
    database.reviewRun.findFirst.mockResolvedValue({ id: "run-1", companyId: "company-1", projectId: "project-1", status: "UNDER_REVIEW", updatedAt: expectedUpdatedAt });
    database.reviewFinding.count.mockResolvedValue(1);
    await expect(markReviewRunStatus({ runId: "run-1", companyId: "company-1", userId: "user-1", role: "EDITOR", targetStatus: "REVIEWED", expectedUpdatedAt, correlationId: "corr-3" }, database as never)).rejects.toThrow("pending or stale");
    database.reviewFinding.count.mockResolvedValue(0);
    database.reviewRun.updateMany.mockResolvedValue({ count: 0 });
    await expect(markReviewRunStatus({ runId: "run-1", companyId: "company-1", userId: "user-1", role: "EDITOR", targetStatus: "REVIEWED", expectedUpdatedAt, correlationId: "corr-4" }, database as never)).rejects.toThrow("changed");
  });

  it("reads lifecycle status without requiring editor access", async () => {
    const database = client();
    await expect(readReviewRunStatus({ runId: "run-1", companyId: "company-1" }, database as never)).resolves.toEqual(expect.objectContaining({ id: "run-1", status: "COMPLETED" }));
  });
});
