import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  budgetDelete: vi.fn(),
  budgetFindFirst: vi.fn(),
  budgetFindUnique: vi.fn(),
  budgetUpdate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    budget: {
      findFirst: mocks.budgetFindFirst,
      delete: mocks.budgetDelete,
      findUnique: mocks.budgetFindUnique,
      update: mocks.budgetUpdate,
    },
    $transaction: mocks.transaction,
  },
}));

import { deleteBudget } from "@/lib/data/budgets";

describe("deleteBudget", () => {
  beforeEach(() => {
    mocks.budgetDelete.mockReset();
    mocks.budgetFindFirst.mockReset();
    mocks.budgetFindUnique.mockReset();
    mocks.budgetUpdate.mockReset();
    mocks.transaction.mockReset();

    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        budget: {
          delete: mocks.budgetDelete,
          findUnique: mocks.budgetFindUnique,
          update: mocks.budgetUpdate,
        },
      }),
    );
  });

  it("deletes an accessible sub budget and refreshes its parent general budget totals", async () => {
    mocks.budgetFindFirst.mockResolvedValue({
      id: "sub-1",
      kind: "SUB_BUDGET",
      parentBudgetId: "general-1",
    });
    mocks.budgetFindUnique.mockResolvedValue({
      id: "general-1",
      childBudgets: [
        {
          totalDirectCost: new Prisma.Decimal("0.1"),
          totalGeneralExpenses: new Prisma.Decimal("0.2"),
          totalUtility: new Prisma.Decimal("0.3"),
          totalTax: new Prisma.Decimal("0.4"),
          totalAmount: new Prisma.Decimal("0.5"),
        },
        {
          totalDirectCost: new Prisma.Decimal("0.2"),
          totalGeneralExpenses: new Prisma.Decimal("0.3"),
          totalUtility: new Prisma.Decimal("0.4"),
          totalTax: new Prisma.Decimal("0.5"),
          totalAmount: new Prisma.Decimal("0.6"),
        },
      ],
    });

    await deleteBudget("sub-1", "user-1");

    expect(mocks.budgetDelete).toHaveBeenCalledWith({ where: { id: "sub-1" } });
    expect(mocks.budgetFindUnique).toHaveBeenCalledWith({
      where: { id: "general-1" },
      include: {
        childBudgets: {
          select: {
            totalDirectCost: true,
            totalGeneralExpenses: true,
            totalUtility: true,
            totalTax: true,
            totalAmount: true,
          },
        },
      },
    });
    expect(mocks.budgetUpdate).toHaveBeenCalledWith({
      where: { id: "general-1" },
      data: {
        totalDirectCost: new Prisma.Decimal("0.3"),
        totalGeneralExpenses: new Prisma.Decimal("0.5"),
        totalUtility: new Prisma.Decimal("0.7"),
        totalTax: new Prisma.Decimal("0.9"),
        totalAmount: new Prisma.Decimal("1.1"),
      },
    });
  });
});
