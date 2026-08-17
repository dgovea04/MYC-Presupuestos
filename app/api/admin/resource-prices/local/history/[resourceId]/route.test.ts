import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const { requireSuperAdminSessionMock, resourceFindFirstMock, historyMock } = vi.hoisted(() => ({
  requireSuperAdminSessionMock: vi.fn(),
  resourceFindFirstMock: vi.fn(),
  historyMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireSuperAdminSession: requireSuperAdminSessionMock }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { resource: { findFirst: resourceFindFirstMock } } }));
vi.mock("@/lib/local-resource-pricing/service", () => ({ getLocalResourcePriceHistory: historyMock }));

import { GET } from "@/app/api/admin/resource-prices/local/history/[resourceId]/route";

describe("local resource price history route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-super-admin requests", async () => {
    requireSuperAdminSessionMock.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ resourceId: "resource-1" }) });
    expect(response.status).toBe(403);
    expect(resourceFindFirstMock).not.toHaveBeenCalled();
  });

  it("returns only the global resource history", async () => {
    requireSuperAdminSessionMock.mockResolvedValue({ user: { id: "super-admin-1" } });
    resourceFindFirstMock.mockResolvedValue({ id: "resource-1", code: "MAT-001", description: "Cemento", unit: "bol", currency: "PEN", unitPrice: new Prisma.Decimal("27.4500") });
    historyMock.mockResolvedValue([{ id: "history-1", batchId: "batch-1", versionLabel: "20260818-001", batchStatus: "PUBLISHED", oldPrice: "25.4500", newPrice: "27.4500", changedById: "super-admin-1", changedAt: "2026-08-18T00:00:00.000Z" }]);

    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ resourceId: "resource-1" }) });
    expect(response.status).toBe(200);
    expect(resourceFindFirstMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "resource-1", companyId: null } }));
    expect(historyMock).toHaveBeenCalledWith("resource-1");
    expect(await response.json()).toMatchObject({ resource: { unitPrice: "27.45" }, history: [{ versionLabel: "20260818-001" }] });
  });
});
