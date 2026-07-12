import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/data/budgets", () => ({
  getBudgetHeaderById: vi.fn(),
}));

vi.mock("@/lib/data/activity-events", () => ({
  getBudgetTemplateCreationTraceability: vi.fn(),
}));

import { GET } from "@/app/api/budgets/[id]/template-traceability/route";
import { getAuthSession } from "@/lib/auth/session";
import { getBudgetHeaderById } from "@/lib/data/budgets";
import { getBudgetTemplateCreationTraceability } from "@/lib/data/activity-events";

describe("budget template traceability route", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/budgets/budget-1/template-traceability"),
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
    vi.mocked(getBudgetHeaderById).mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/budgets/budget-1/template-traceability"),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "No tienes permisos para ver este presupuesto" });
  });

  it("returns template traceability for an accessible budget", async () => {
    const traceability = {
      title: "Presupuesto creado desde plantilla",
      detail: "Arquitectura desde Base tecnica",
      href: "/budgets/budget-1",
      createdAt: new Date("2026-05-29T22:30:00.000Z"),
    };

    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    vi.mocked(getBudgetHeaderById).mockResolvedValue({
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
    });
    vi.mocked(getBudgetTemplateCreationTraceability).mockResolvedValue(traceability);

    const response = await GET(
      new Request("http://localhost/api/budgets/budget-1/template-traceability"),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(200);
    expect(getBudgetTemplateCreationTraceability).toHaveBeenCalledWith({ userId: "user-1", budgetId: "budget-1" });
    await expect(response.json()).resolves.toEqual({
      traceability: {
        ...traceability,
        createdAt: traceability.createdAt.toISOString(),
      },
    });
  });
});
