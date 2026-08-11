import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  budgetFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    budget: {
      findMany: mocks.budgetFindMany,
    },
  },
}));

import { getBudgetsByUser } from "@/lib/data/budgets";

describe("getBudgetsByUser", () => {
  beforeEach(() => {
    mocks.budgetFindMany.mockReset();
  });

  it("normalizes cached date strings back into Date instances", async () => {
    mocks.budgetFindMany.mockResolvedValue([
      {
        id: "budget-1",
        projectId: "project-1",
        parentBudgetId: null,
        kind: "GENERAL",
        name: "Presupuesto General",
        currency: "PEN",
        igvRate: 0.18,
        generalExpensesRate: 0.1,
        utilityRate: 0.08,
        totalDirectCost: 100,
        totalGeneralExpenses: 10,
        totalUtility: 8,
        totalTax: 21.24,
        totalAmount: 139.24,
        state: "DRAFT",
        createdAt: "2026-06-01T12:00:00.000Z",
        updatedAt: "2026-06-25T15:30:00.000Z",
        project: {
          id: "project-1",
          companyId: "company-1",
          name: "Proyecto Demo",
          clientName: null,
          location: null,
          projectType: null,
          startDate: null,
          endDate: null,
          status: "PLANNING",
          createdAt: "2026-05-20T10:00:00.000Z",
          updatedAt: "2026-06-25T15:30:00.000Z",
        },
      },
    ]);

    const budgets = await getBudgetsByUser("user-1");

    expect(budgets[0]?.updatedAt).toBeInstanceOf(Date);
    expect(budgets[0]?.createdAt).toBeInstanceOf(Date);
    expect(budgets[0]?.project.updatedAt).toBeInstanceOf(Date);
    expect(budgets[0]?.project.createdAt).toBeInstanceOf(Date);
    expect(budgets[0]?.updatedAt.toISOString()).toBe("2026-06-25T15:30:00.000Z");
  });

  it("filters general budgets by the active workspace company when provided", async () => {
    mocks.budgetFindMany.mockResolvedValue([]);

    await getBudgetsByUser("user-1", "company-active");

    expect(mocks.budgetFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          kind: "GENERAL",
          project: expect.objectContaining({
            companyId: "company-active",
            company: {
              memberships: {
                some: {
                  userId: "user-1",
                  status: "ACTIVE",
                },
              },
            },
          }),
        }),
      }),
    );
  });
});
