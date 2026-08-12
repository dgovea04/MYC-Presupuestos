import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/data/budgets", () => ({
  getBudgetHeaderById: vi.fn(),
}));

import { GET } from "@/app/api/budgets/[id]/kind/route";
import { getAuthSession } from "@/lib/auth/session";
import { getBudgetHeaderById } from "@/lib/data/budgets";

describe("budget kind route", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/budgets/budget-1/kind"), {
      params: Promise.resolve({ id: "budget-1" }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 404 when the budget is not accessible", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      expires: new Date().toISOString(),
      user: { id: "user-1" },
    });
    vi.mocked(getBudgetHeaderById).mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/budgets/budget-1/kind"), {
      params: Promise.resolve({ id: "budget-1" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Budget not found" });
  });

  it("returns only the budget kind for an accessible budget", async () => {
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

    const response = await GET(new Request("http://localhost/api/budgets/budget-1/kind"), {
      params: Promise.resolve({ id: "budget-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ kind: "SUB_BUDGET" });
  });
});
