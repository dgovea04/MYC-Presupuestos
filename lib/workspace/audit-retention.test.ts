import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { workspaceAuditEvent: { deleteMany: mocks.deleteMany } },
}));

import {
  getWorkspaceAuditRetentionCutoff,
  purgeWorkspaceAuditEventsBefore,
  WORKSPACE_AUDIT_RETENTION_MONTHS,
} from "@/lib/workspace/audit-retention";

describe("workspace audit retention", () => {
  it("computes a cutoff 24 months before the given date", () => {
    const now = new Date("2026-08-21T12:00:00.000Z");
    const cutoff = getWorkspaceAuditRetentionCutoff(now);
    const expected = new Date(now.getTime() - WORKSPACE_AUDIT_RETENTION_MONTHS * 30 * 24 * 60 * 60 * 1000);

    expect(cutoff.toISOString()).toBe(expected.toISOString());
    expect(cutoff.getTime()).toBeLessThan(now.getTime());
  });

  it("purges events older than the cutoff and returns the count", async () => {
    mocks.deleteMany.mockReset().mockResolvedValue({ count: 5 });

    const result = await purgeWorkspaceAuditEventsBefore({ now: new Date("2026-08-21T12:00:00.000Z") });

    expect(result.purgedCount).toBe(5);
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: expect.any(Date) } },
    });
  });
});
