import { describe, expect, it, vi } from "vitest";
import { assignFinding } from "./assignments";

describe("finding assignments", () => {
  it("assigns a project member and records an audit event transactionally", async () => {
    const tx = {
      reviewFinding: { findFirst: vi.fn().mockResolvedValue({ id: "finding-1", companyId: "company-1", projectId: "project-1", updatedAt: new Date("2026-09-01T00:00:00Z") }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      projectMembership: { findFirst: vi.fn().mockResolvedValue({ userId: "assignee-1", role: "EDITOR" }) },
      reviewAuditEvent: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
    };
    const client = { $transaction: vi.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)) };
    await expect(assignFinding({ findingId: "finding-1", assigneeId: "assignee-1", actorUserId: "actor-1", companyId: "company-1", projectId: "project-1", expectedUpdatedAt: new Date("2026-09-01T00:00:00Z") }, client)).resolves.toMatchObject({ findingId: "finding-1", assignedToId: "assignee-1" });
    expect(tx.reviewAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: "FINDING_ASSIGNED" }) }));
  });

  it("rejects an assignee outside the project", async () => {
    const tx = { reviewFinding: { findFirst: vi.fn().mockResolvedValue({ id: "finding-1", companyId: "company-1", projectId: "project-1", updatedAt: new Date("2026-09-01T00:00:00Z") }) }, projectMembership: { findFirst: vi.fn().mockResolvedValue(null) }, reviewAuditEvent: { create: vi.fn() } };
    const client = { $transaction: vi.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)) };
    await expect(assignFinding({ findingId: "finding-1", assigneeId: "assignee-2", actorUserId: "actor-1", companyId: "company-1", projectId: "project-1", expectedUpdatedAt: new Date("2026-09-01T00:00:00Z") }, client)).rejects.toThrow("project member");
  });
});
