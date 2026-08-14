import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRawMock = vi.hoisted(() => vi.fn());
const executeRawMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $queryRaw: queryRawMock,
    $executeRaw: executeRawMock,
  },
}));

import { anonymizeAdminAuditLogsBefore, getAdminAuditRetentionCutoff } from "@/lib/data/admin-audit-retention";

describe("admin audit retention", () => {
  beforeEach(() => {
    queryRawMock.mockReset();
    executeRawMock.mockReset();
  });

  it("calculates a 90-day cutoff and records the anonymization operation", async () => {
    const now = new Date("2026-08-14T12:00:00.000Z");
    queryRawMock.mockResolvedValueOnce([{ id: "event-1" }, { id: "event-2" }]);
    executeRawMock.mockResolvedValue(1);

    expect(getAdminAuditRetentionCutoff(now).toISOString()).toBe("2026-05-16T12:00:00.000Z");
    await expect(
      anonymizeAdminAuditLogsBefore({ actorUserId: "admin-1", actorEmail: "admin@example.com", now }),
    ).resolves.toMatchObject({ anonymizedCount: 2, cutoff: getAdminAuditRetentionCutoff(now) });
    expect(queryRawMock).toHaveBeenCalledOnce();
    expect(executeRawMock).toHaveBeenCalledOnce();
  });

  it("is idempotent when no old records remain", async () => {
    queryRawMock.mockResolvedValueOnce([]);
    executeRawMock.mockResolvedValue(1);

    await expect(
      anonymizeAdminAuditLogsBefore({
        actorUserId: "admin-1",
        actorEmail: "admin@example.com",
        now: new Date("2026-08-14T12:00:00.000Z"),
      }),
    ).resolves.toMatchObject({ anonymizedCount: 0 });
  });
});
