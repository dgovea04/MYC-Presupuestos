import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BudgetInput } from "@/lib/validations/budget";

const mocks = vi.hoisted(() => ({
  assertWithinPlanLimit: vi.fn(),
  budgetCreate: vi.fn(),
  budgetFindFirst: vi.fn(),
  getUserSettings: vi.fn(),
  projectFindFirst: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    budget: {
      create: mocks.budgetCreate,
      findFirst: mocks.budgetFindFirst,
    },
    project: {
      findFirst: mocks.projectFindFirst,
    },
  },
}));

vi.mock("@/lib/data/settings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/data/settings")>("@/lib/data/settings");

  return {
    ...actual,
    getUserSettings: mocks.getUserSettings,
  };
});

vi.mock("@/lib/billing/entitlements", () => ({
  assertWithinPlanLimit: mocks.assertWithinPlanLimit,
}));

import { createBudget } from "@/lib/data/budgets";

describe("createBudget", () => {
  beforeEach(() => {
    mocks.assertWithinPlanLimit.mockReset();
    mocks.budgetCreate.mockReset();
    mocks.budgetFindFirst.mockReset();
    mocks.getUserSettings.mockReset();
    mocks.projectFindFirst.mockReset();

    mocks.projectFindFirst.mockResolvedValue({ id: "project-1" });
    mocks.getUserSettings.mockResolvedValue({
      defaultCurrency: "PEN",
      currencyDecimals: 2,
      dateFormat: "DD_MM_YYYY",
      defaultViewMode: "modern",
      excelShowFieldBorders: true,
      excelRowHeight: 24,
      defaultIgvRate: 0.19,
      defaultGeneralExpensesRate: 0.125,
      defaultUtilityRate: 0.075,
      defaultSubBudgetNames: ["Estructuras"],
    });
    mocks.budgetCreate.mockResolvedValue({ id: "budget-1", name: "Presupuesto General" });
  });

  it("uses user settings rates when a new budget request omits base percentages", async () => {
    await createBudget("user-1", {
      projectId: "project-1",
      kind: "GENERAL",
      name: "Presupuesto General",
      currency: "PEN",
    } as Partial<BudgetInput> as BudgetInput);

    expect(mocks.budgetCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        igvRate: 0.19,
        generalExpensesRate: 0.125,
        utilityRate: 0.075,
      }),
    });
  });
});
