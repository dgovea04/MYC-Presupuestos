import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSuperAdminSessionMock } = vi.hoisted(() => ({ requireSuperAdminSessionMock: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ requireSuperAdminSession: requireSuperAdminSessionMock }));

import { GET } from "@/app/api/admin/resource-prices/local/template/route";

describe("local resource price template route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects users without SUPER_ADMIN access", async () => {
    requireSuperAdminSessionMock.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/admin/resource-prices/local/template"));
    expect(response.status).toBe(403);
  });

  it("returns a private xlsx template for SUPER_ADMIN", async () => {
    requireSuperAdminSessionMock.mockResolvedValue({ user: { id: "super-admin-1" } });
    const response = await GET(new Request("http://localhost/api/admin/resource-prices/local/template"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("spreadsheetml.sheet");
    expect(response.headers.get("Content-Disposition")).toContain("plantilla-precios-insumos.xlsx");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(100);
  });
});
