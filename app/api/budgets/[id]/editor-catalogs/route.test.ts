import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/data/budgets", () => ({
  getBudgetById: vi.fn(),
}));

vi.mock("@/lib/data/partidas", () => ({
  getCatalogPartidas: vi.fn(),
}));

vi.mock("@/lib/data/projects", () => ({
  getProjectBudgetOverviewById: vi.fn(),
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
import { getBudgetById } from "@/lib/data/budgets";
import { getCatalogPartidas } from "@/lib/data/partidas";
import { getProjectBudgetOverviewById } from "@/lib/data/projects";
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
    vi.mocked(getBudgetById).mockResolvedValue(null);

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
    vi.mocked(getBudgetById).mockResolvedValue({
      id: "budget-1",
      projectId: "project-1",
      parentBudgetId: null,
      kind: "SUB_BUDGET",
      name: "Estructuras",
      currency: "PEN",
      igvRate: 0.18,
      generalExpensesRate: 0.1,
      utilityRate: 0.08,
      totalDirectCost: 0,
      totalGeneralExpenses: 0,
      totalUtility: 0,
      totalTax: 0,
      totalAmount: 0,
      levels: [],
      items: [],
    });
    vi.mocked(getProjectBudgetOverviewById).mockResolvedValue({
      id: "project-1",
      companyId: "company-1",
      name: "Proyecto Demo",
      clientName: "Cliente Demo",
      updatedAt: new Date("2026-05-11T00:00:00.000Z"),
      budgets: [],
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
