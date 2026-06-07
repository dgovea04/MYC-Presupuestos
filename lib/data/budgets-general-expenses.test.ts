import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  budgetFindFirst: vi.fn(),
  budgetFindUnique: vi.fn(),
  budgetFindMany: vi.fn(),
  budgetUpdate: vi.fn(),
  generalExpenseGroupFindMany: vi.fn(),
  transaction: vi.fn(),
  ensureBudgetGeneralExpensesTemplate: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    budget: {
      findFirst: mocks.budgetFindFirst,
    },
    generalExpenseGroup: {
      findMany: mocks.generalExpenseGroupFindMany,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/general-expenses/template-seed", () => ({
  ensureBudgetGeneralExpensesTemplate: mocks.ensureBudgetGeneralExpensesTemplate,
}));

import { getBudgetGeneralExpenses } from "@/lib/data/budgets";

describe("getBudgetGeneralExpenses", () => {
  beforeEach(() => {
    mocks.budgetFindFirst.mockReset();
    mocks.budgetFindUnique.mockReset();
    mocks.budgetFindMany.mockReset();
    mocks.budgetUpdate.mockReset();
    mocks.generalExpenseGroupFindMany.mockReset();
    mocks.transaction.mockReset();
    mocks.ensureBudgetGeneralExpensesTemplate.mockReset();

    mocks.budgetFindFirst.mockResolvedValue({
      id: "budget-1",
      projectId: "project-1",
      name: "Presupuesto importado",
      currency: "PEN",
      totalDirectCost: new Prisma.Decimal(1000),
      totalUtility: new Prisma.Decimal(0),
      totalTax: new Prisma.Decimal(0),
      totalAmount: new Prisma.Decimal(0),
    });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        budget: {
          findUnique: mocks.budgetFindUnique,
          findMany: mocks.budgetFindMany,
          update: mocks.budgetUpdate,
        },
      }),
    );
  });

  it("does not create the general expenses template when merely reading an empty imported budget", async () => {
    mocks.generalExpenseGroupFindMany.mockResolvedValue([]);

    const result = await getBudgetGeneralExpenses("budget-1", "user-1");

    expect(result.groups).toEqual([]);
    expect(result.total).toBe(0);
    expect(mocks.ensureBudgetGeneralExpensesTemplate).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
