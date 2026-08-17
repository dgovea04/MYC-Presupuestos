import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const { requireSuperAdminSessionMock, resourceFindManyMock } = vi.hoisted(() => ({
  requireSuperAdminSessionMock: vi.fn(),
  resourceFindManyMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireSuperAdminSession: requireSuperAdminSessionMock }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { resource: { findMany: resourceFindManyMock } } }));

import { GET } from "@/app/api/admin/resource-prices/local/export/route";

describe("local resource price export route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects users without SUPER_ADMIN access", async () => {
    requireSuperAdminSessionMock.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/admin/resource-prices/local/export"));
    expect(response.status).toBe(403);
    expect(resourceFindManyMock).not.toHaveBeenCalled();
  });

  it("exports only global resources with a private dated filename", async () => {
    requireSuperAdminSessionMock.mockResolvedValue({ user: { id: "super-admin-1" } });
    resourceFindManyMock.mockResolvedValue([
      {
        id: "resource-1",
        code: "MAT-001",
        description: "Cemento",
        unit: "bol",
        currency: "PEN",
        unitPrice: new Prisma.Decimal("25.4500"),
        priceObservedAt: new Date("2026-08-18T00:00:00.000Z"),
        priceSource: "Lista MC",
        source: "Catalogo base",
      },
    ]);

    const response = await GET(new Request("http://localhost/api/admin/resource-prices/local/export"));
    expect(response.status).toBe(200);
    expect(resourceFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: null } }));
    expect(response.headers.get("Content-Disposition")).toMatch(/catalogo-precios-global-\d{4}-\d{2}-\d{2}\.xlsx/);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(100);
  });
});
