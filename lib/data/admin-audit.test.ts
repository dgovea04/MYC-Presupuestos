import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

import {
  ADMIN_AUDIT_EXPORT_PAGE_SIZE,
  ADMIN_AUDIT_PAGE_SIZE,
  listAdminAuditLogs,
  normalizeAdminAuditAction,
  normalizeAdminAuditPage,
  normalizeAdminAuditPageSize,
  normalizeAdminAuditQuery,
} from "@/lib/data/admin-audit";

describe("admin audit data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ count: 41n }])
      .mockResolvedValueOnce([
        {
          id: "audit-21",
          action: "USER_SUSPENDED",
          detail: "Prueba",
          targetEmail: "test@example.com",
          actorEmail: "admin@example.com",
          createdAt: new Date("2026-08-14T12:00:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([{ action: "USER_SUSPENDED" }, { action: "USER_REACTIVATED" }]);
  });

  it("normalizes search, action, page, and page-size inputs", () => {
    expect(normalizeAdminAuditQuery("  target@example.com  ")).toBe("target@example.com");
    expect(normalizeAdminAuditAction(" USER_SUSPENDED ")).toBe("USER_SUSPENDED");
    expect(normalizeAdminAuditPage(0)).toBe(1);
    expect(normalizeAdminAuditPageSize()).toBe(ADMIN_AUDIT_PAGE_SIZE);
    expect(normalizeAdminAuditPageSize(99999)).toBe(ADMIN_AUDIT_EXPORT_PAGE_SIZE);
  });

  it("returns filtered audit entries with bounded pagination", async () => {
    const result = await listAdminAuditLogs({ query: "test@example.com", action: "USER_SUSPENDED", page: 2, pageSize: 20 });

    expect(result.entries).toEqual([
      {
        id: "audit-21",
        action: "USER_SUSPENDED",
        detail: "Prueba",
        targetEmail: "test@example.com",
        actorEmail: "admin@example.com",
        createdAt: "2026-08-14T12:00:00.000Z",
      },
    ]);
    expect(result.pagination).toEqual({ page: 2, pageSize: 20, totalEntries: 41, totalPages: 3 });
    expect(result.actions).toEqual(["USER_SUSPENDED", "USER_REACTIVATED"]);
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(3);
  });
});
