import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/data/budgets", () => ({
  getBudgetCatalogScopeById: vi.fn(),
}));

vi.mock("@/lib/data/partidas", () => ({
  getCatalogPartidas: vi.fn(),
}));

vi.mock("@/lib/data/resources", () => ({
  getResourcesByUser: vi.fn(),
}));

vi.mock("@/lib/db/serializers", () => ({
  decimalToNumber: vi.fn((value: number) => value),
}));

vi.mock("@/lib/platform/performance", () => ({
  measureAsync: vi.fn((_: string, callback: () => Promise<unknown>) => callback()),
}));

import { GET } from "@/app/api/budgets/[id]/editor-catalogs/route";
import { getAuthSession } from "@/lib/auth/session";
import { getBudgetCatalogScopeById } from "@/lib/data/budgets";
import { getCatalogPartidas } from "@/lib/data/partidas";
import { getResourcesByUser } from "@/lib/data/resources";

describe("budget editor catalogs route", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/budgets/budget-1/editor-catalogs"),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 404 when the budget is not accessible", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    vi.mocked(getBudgetCatalogScopeById).mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/budgets/budget-1/editor-catalogs"),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "No tienes permisos para ver este presupuesto" });
  });

  it("loads catalog data scoped to the budget project company", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    vi.mocked(getBudgetCatalogScopeById).mockResolvedValue({
      id: "budget-1",
      projectId: "project-1",
      project: {
        companyId: "company-1",
      },
    });
    vi.mocked(getResourcesByUser).mockResolvedValue([
      {
        id: "resource-1",
        companyId: "company-1",
        code: "MO-01",
        description: "Operario",
        category: "LABOR",
        iu: null,
        iuCurrent: null,
        subcategory: null,
        unit: "HH",
        unitPrice: 19.23,
        currency: "PEN",
        source: null,
      },
    ]);
    vi.mocked(getCatalogPartidas).mockResolvedValue([
      {
        id: "partida-1",
        description: "Concreto simple",
        unit: "m3",
        unitPrice: 350,
        currency: "PEN",
        performance: 1,
        apuRows: [],
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/budgets/budget-1/editor-catalogs"),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(200);
    expect(getResourcesByUser).toHaveBeenCalledWith("user-1", "company-1");
    expect(getCatalogPartidas).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({
      partidasCatalog: [
        expect.objectContaining({
          id: "partida-1",
          description: "Concreto simple",
        }),
      ],
      resourcesCatalog: [
        expect.objectContaining({
          id: "resource-1",
          companyId: "company-1",
          unitPrice: 19.23,
        }),
      ],
    });
  });
});
