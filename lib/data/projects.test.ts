import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { DEFAULT_INITIAL_SUB_BUDGET_NAMES } from "@/types/settings";

const mocks = vi.hoisted(() => ({
  companyFindFirst: vi.fn(),
  transaction: vi.fn(),
  projectFindFirst: vi.fn(),
  projectCreate: vi.fn(),
  budgetCreate: vi.fn(),
  budgetCreateMany: vi.fn(),
  budgetFindMany: vi.fn(),
  budgetFindUnique: vi.fn(),
  budgetUpdate: vi.fn(),
  getUserSettings: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    company: {
      findFirst: mocks.companyFindFirst,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/data/settings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/data/settings")>("@/lib/data/settings");

  return {
    ...actual,
    getUserSettings: mocks.getUserSettings,
  };
});

import { defaultUserSettings } from "@/lib/data/settings";
import { createProject, getProjectById } from "@/lib/data/projects";

describe("project data", () => {
  beforeEach(() => {
    mocks.companyFindFirst.mockReset();
    mocks.transaction.mockReset();
    mocks.projectFindFirst.mockReset();
    mocks.projectCreate.mockReset();
    mocks.budgetCreate.mockReset();
    mocks.budgetCreateMany.mockReset();
    mocks.budgetFindMany.mockReset();
    mocks.budgetFindUnique.mockReset();
    mocks.budgetUpdate.mockReset();
    mocks.getUserSettings.mockReset();

    mocks.companyFindFirst.mockResolvedValue({ id: "company-1" });
    mocks.projectCreate.mockResolvedValue({ id: "project-1", name: "Proyecto 1" });
    mocks.budgetCreate.mockResolvedValue({ id: "budget-general-1" });
    mocks.budgetCreateMany.mockResolvedValue({ count: 4 });
    mocks.budgetFindUnique.mockResolvedValue({
      id: "budget-general-1",
      childBudgets: [],
    });
    mocks.budgetUpdate.mockResolvedValue({
      id: "budget-general-1",
      name: "Presupuesto General",
    });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        project: {
          create: mocks.projectCreate,
          findFirst: mocks.projectFindFirst,
        },
        budget: {
          create: mocks.budgetCreate,
          createMany: mocks.budgetCreateMany,
          findMany: mocks.budgetFindMany,
          findUnique: mocks.budgetFindUnique,
          update: mocks.budgetUpdate,
        },
      }),
    );
  });

  it("uses the user's default currency for the general and default sub budgets", async () => {
    mocks.getUserSettings.mockResolvedValue({
      defaultCurrency: "USD",
      currencyDecimals: 2,
      defaultIgvRate: 0.19,
      defaultGeneralExpensesRate: 0.11,
      defaultUtilityRate: 0.09,
      defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
    });

    await createProject("user-1", {
      companyId: "company-1",
      name: "Proyecto 1",
      clientName: "",
      location: "",
      projectType: "",
      startDate: "",
      endDate: "",
      status: "PLANNING",
    });

    expect(mocks.getUserSettings).toHaveBeenCalledWith("user-1");
    expect(mocks.budgetCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: "project-1",
        kind: "GENERAL",
        name: "Presupuesto General",
        currency: "USD",
        igvRate: 0.19,
        generalExpensesRate: 0.11,
        utilityRate: 0.09,
      }),
    });
    expect(mocks.budgetCreateMany).toHaveBeenCalledTimes(1);
    expect(mocks.budgetCreateMany.mock.calls[0]?.[0]).toEqual({
      data: [
        expect.objectContaining({
          projectId: "project-1",
          parentBudgetId: "budget-general-1",
          kind: "SUB_BUDGET",
          name: DEFAULT_INITIAL_SUB_BUDGET_NAMES[0],
          currency: "USD",
          igvRate: 0.19,
          generalExpensesRate: 0.11,
          utilityRate: 0.09,
        }),
        expect.objectContaining({
          projectId: "project-1",
          parentBudgetId: "budget-general-1",
          kind: "SUB_BUDGET",
          name: DEFAULT_INITIAL_SUB_BUDGET_NAMES[1],
          currency: "USD",
          igvRate: 0.19,
          generalExpensesRate: 0.11,
          utilityRate: 0.09,
        }),
        expect.objectContaining({
          projectId: "project-1",
          parentBudgetId: "budget-general-1",
          kind: "SUB_BUDGET",
          name: DEFAULT_INITIAL_SUB_BUDGET_NAMES[2],
          currency: "USD",
          igvRate: 0.19,
          generalExpensesRate: 0.11,
          utilityRate: 0.09,
        }),
        expect.objectContaining({
          projectId: "project-1",
          parentBudgetId: "budget-general-1",
          kind: "SUB_BUDGET",
          name: DEFAULT_INITIAL_SUB_BUDGET_NAMES[3],
          currency: "USD",
          igvRate: 0.19,
          generalExpensesRate: 0.11,
          utilityRate: 0.09,
        }),
      ],
    });
  });

  it("uses configured initial sub budget names from user settings", async () => {
    const customSubBudgetNames = ["Obra", "Diseño", "Instalaciones"];
    mocks.getUserSettings.mockResolvedValue({
      defaultCurrency: "PEN",
      currencyDecimals: 2,
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.1,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: customSubBudgetNames,
    });

    await createProject("user-custom", {
      companyId: "company-1",
      name: "Proyecto custom",
      clientName: "",
      location: "",
      projectType: "",
      startDate: "",
      endDate: "",
      status: "PLANNING",
    });

    expect(mocks.budgetCreateMany.mock.calls[0]?.[0]).toEqual({
      data: [
        expect.objectContaining({
          name: customSubBudgetNames[0],
        }),
        expect.objectContaining({
          name: customSubBudgetNames[1],
        }),
        expect.objectContaining({
          name: customSubBudgetNames[2],
        }),
      ],
    });
  });

  it("uses the central settings default currency when user settings normalize to defaults", async () => {
    mocks.getUserSettings.mockResolvedValue(defaultUserSettings);

    await createProject("user-2", {
      companyId: "company-1",
      name: "Proyecto 2",
      clientName: "",
      location: "",
      projectType: "",
      startDate: "",
      endDate: "",
      status: "PLANNING",
    });

    expect(mocks.budgetCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        currency: defaultUserSettings.defaultCurrency,
        igvRate: defaultUserSettings.defaultIgvRate,
        generalExpensesRate: defaultUserSettings.defaultGeneralExpensesRate,
        utilityRate: defaultUserSettings.defaultUtilityRate,
      }),
    });
    expect(mocks.budgetCreateMany.mock.calls[0]?.[0]).toEqual({
      data: [
        expect.objectContaining({
          currency: defaultUserSettings.defaultCurrency,
          igvRate: defaultUserSettings.defaultIgvRate,
          generalExpensesRate: defaultUserSettings.defaultGeneralExpensesRate,
          utilityRate: defaultUserSettings.defaultUtilityRate,
        }),
        expect.objectContaining({
          currency: defaultUserSettings.defaultCurrency,
          igvRate: defaultUserSettings.defaultIgvRate,
          generalExpensesRate: defaultUserSettings.defaultGeneralExpensesRate,
          utilityRate: defaultUserSettings.defaultUtilityRate,
        }),
        expect.objectContaining({
          currency: defaultUserSettings.defaultCurrency,
          igvRate: defaultUserSettings.defaultIgvRate,
          generalExpensesRate: defaultUserSettings.defaultGeneralExpensesRate,
          utilityRate: defaultUserSettings.defaultUtilityRate,
        }),
        expect.objectContaining({
          currency: defaultUserSettings.defaultCurrency,
          igvRate: defaultUserSettings.defaultIgvRate,
          generalExpensesRate: defaultUserSettings.defaultGeneralExpensesRate,
          utilityRate: defaultUserSettings.defaultUtilityRate,
        }),
      ],
    });
  });

  it("uses the user's default currency when missing budgets are recreated on project read", async () => {
    const recreatedBudgets = [
      {
        id: "budget-general-1",
        projectId: "project-1",
        parentBudgetId: null,
        kind: "GENERAL",
        name: "Presupuesto General",
        currency: "USD",
        igvRate: 0.2,
        generalExpensesRate: 0.12,
        utilityRate: 0.1,
      },
      {
        id: "budget-sub-1",
        projectId: "project-1",
        parentBudgetId: "budget-general-1",
        kind: "SUB_BUDGET",
        name: DEFAULT_INITIAL_SUB_BUDGET_NAMES[0],
        currency: "USD",
        igvRate: 0.2,
        generalExpensesRate: 0.12,
        utilityRate: 0.1,
      },
      {
        id: "budget-sub-2",
        projectId: "project-1",
        parentBudgetId: "budget-general-1",
        kind: "SUB_BUDGET",
        name: DEFAULT_INITIAL_SUB_BUDGET_NAMES[1],
        currency: "USD",
        igvRate: 0.2,
        generalExpensesRate: 0.12,
        utilityRate: 0.1,
      },
      {
        id: "budget-sub-3",
        projectId: "project-1",
        parentBudgetId: "budget-general-1",
        kind: "SUB_BUDGET",
        name: DEFAULT_INITIAL_SUB_BUDGET_NAMES[2],
        currency: "USD",
        igvRate: 0.2,
        generalExpensesRate: 0.12,
        utilityRate: 0.1,
      },
      {
        id: "budget-sub-4",
        projectId: "project-1",
        parentBudgetId: "budget-general-1",
        kind: "SUB_BUDGET",
        name: DEFAULT_INITIAL_SUB_BUDGET_NAMES[3],
        currency: "USD",
        igvRate: 0.2,
        generalExpensesRate: 0.12,
        utilityRate: 0.1,
      },
    ];

    mocks.getUserSettings.mockResolvedValue({
      defaultCurrency: "USD",
      currencyDecimals: 2,
      defaultIgvRate: 0.2,
      defaultGeneralExpensesRate: 0.12,
      defaultUtilityRate: 0.1,
      defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
    });
    mocks.projectFindFirst.mockResolvedValue({
      id: "project-1",
      companyId: "company-1",
      name: "Proyecto 1",
      company: {
        id: "company-1",
        userId: "user-3",
      },
    });
    mocks.budgetFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce(recreatedBudgets);
    mocks.budgetCreate
      .mockResolvedValueOnce(recreatedBudgets[0])
      .mockResolvedValueOnce(recreatedBudgets[1])
      .mockResolvedValueOnce(recreatedBudgets[2])
      .mockResolvedValueOnce(recreatedBudgets[3])
      .mockResolvedValueOnce(recreatedBudgets[4]);

    const project = await getProjectById("project-1", "user-3");

    expect(mocks.getUserSettings).toHaveBeenCalledWith("user-3");
    expect(mocks.budgetCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "project-1",
          kind: "GENERAL",
          name: "Presupuesto General",
          currency: "USD",
          igvRate: 0.2,
          generalExpensesRate: 0.12,
          utilityRate: 0.1,
        }),
      }),
    );
    expect(mocks.budgetCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "project-1",
          parentBudgetId: "budget-general-1",
          kind: "SUB_BUDGET",
          name: DEFAULT_INITIAL_SUB_BUDGET_NAMES[0],
          currency: "USD",
          igvRate: 0.2,
          generalExpensesRate: 0.12,
          utilityRate: 0.1,
        }),
      }),
    );
    expect(mocks.budgetCreate).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        data: expect.objectContaining({
          name: DEFAULT_INITIAL_SUB_BUDGET_NAMES[1],
          currency: "USD",
          igvRate: 0.2,
          generalExpensesRate: 0.12,
          utilityRate: 0.1,
        }),
      }),
    );
    expect(mocks.budgetCreate).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        data: expect.objectContaining({
          name: DEFAULT_INITIAL_SUB_BUDGET_NAMES[2],
          currency: "USD",
          igvRate: 0.2,
          generalExpensesRate: 0.12,
          utilityRate: 0.1,
        }),
      }),
    );
    expect(mocks.budgetCreate).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({
        data: expect.objectContaining({
          name: DEFAULT_INITIAL_SUB_BUDGET_NAMES[3],
          currency: "USD",
          igvRate: 0.2,
          generalExpensesRate: 0.12,
          utilityRate: 0.1,
        }),
      }),
    );
    expect(project).toEqual(
      expect.objectContaining({
        id: "project-1",
        budgets: recreatedBudgets,
      }),
    );
  });

  it("recreates missing child budgets from the persisted general budget context", async () => {
    const existingGeneralBudget = {
      id: "budget-general-1",
      projectId: "project-1",
      parentBudgetId: null,
      kind: "GENERAL",
      name: "Presupuesto General",
      currency: "PEN",
      igvRate: 0.18,
      generalExpensesRate: 0.1,
      utilityRate: 0.08,
    };
    const existingSubBudget = {
      id: "budget-sub-1",
      projectId: "project-1",
      parentBudgetId: "budget-general-1",
      kind: "SUB_BUDGET",
      name: DEFAULT_INITIAL_SUB_BUDGET_NAMES[0],
      currency: "PEN",
      igvRate: 0.18,
      generalExpensesRate: 0.1,
      utilityRate: 0.08,
    };
    const recreatedBudgets = [
      existingGeneralBudget,
      existingSubBudget,
      {
        id: "budget-sub-2",
        projectId: "project-1",
        parentBudgetId: "budget-general-1",
        kind: "SUB_BUDGET",
        name: DEFAULT_INITIAL_SUB_BUDGET_NAMES[1],
        currency: "PEN",
        igvRate: 0.18,
        generalExpensesRate: 0.1,
        utilityRate: 0.08,
      },
      {
        id: "budget-sub-3",
        projectId: "project-1",
        parentBudgetId: "budget-general-1",
        kind: "SUB_BUDGET",
        name: DEFAULT_INITIAL_SUB_BUDGET_NAMES[2],
        currency: "PEN",
        igvRate: 0.18,
        generalExpensesRate: 0.1,
        utilityRate: 0.08,
      },
      {
        id: "budget-sub-4",
        projectId: "project-1",
        parentBudgetId: "budget-general-1",
        kind: "SUB_BUDGET",
        name: DEFAULT_INITIAL_SUB_BUDGET_NAMES[3],
        currency: "PEN",
        igvRate: 0.18,
        generalExpensesRate: 0.1,
        utilityRate: 0.08,
      },
    ];

    mocks.getUserSettings.mockResolvedValue({
      defaultCurrency: "USD",
      currencyDecimals: 2,
      defaultIgvRate: 0.2,
      defaultGeneralExpensesRate: 0.12,
      defaultUtilityRate: 0.1,
      defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
    });
    mocks.projectFindFirst.mockResolvedValue({
      id: "project-1",
      companyId: "company-1",
      name: "Proyecto historico",
      company: {
        id: "company-1",
        userId: "user-4",
      },
    });
    mocks.budgetFindMany.mockResolvedValueOnce([existingGeneralBudget, existingSubBudget]).mockResolvedValueOnce(
      recreatedBudgets,
    );
    mocks.budgetCreate
      .mockResolvedValueOnce(recreatedBudgets[2])
      .mockResolvedValueOnce(recreatedBudgets[3])
      .mockResolvedValueOnce(recreatedBudgets[4]);

    const project = await getProjectById("project-1", "user-4");

    expect(mocks.budgetCreate).toHaveBeenCalledTimes(3);
    expect(mocks.budgetCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "project-1",
          parentBudgetId: "budget-general-1",
          kind: "SUB_BUDGET",
          name: DEFAULT_INITIAL_SUB_BUDGET_NAMES[1],
          currency: "PEN",
          igvRate: 0.18,
          generalExpensesRate: 0.1,
          utilityRate: 0.08,
        }),
      }),
    );
    expect(mocks.budgetCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          name: DEFAULT_INITIAL_SUB_BUDGET_NAMES[2],
          currency: "PEN",
          igvRate: 0.18,
          generalExpensesRate: 0.1,
          utilityRate: 0.08,
        }),
      }),
    );
    expect(mocks.budgetCreate).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        data: expect.objectContaining({
          name: DEFAULT_INITIAL_SUB_BUDGET_NAMES[3],
          currency: "PEN",
          igvRate: 0.18,
          generalExpensesRate: 0.1,
          utilityRate: 0.08,
        }),
      }),
    );
    expect(project).toEqual(
      expect.objectContaining({
        id: "project-1",
        budgets: recreatedBudgets,
      }),
    );
  });

  it("refreshes general budget totals with Decimal-safe sums", async () => {
    const existingBudgets = [
      {
        id: "budget-general-1",
        projectId: "project-1",
        parentBudgetId: null,
        kind: "GENERAL",
        name: "Presupuesto General",
        currency: "PEN",
        igvRate: 0.18,
        generalExpensesRate: 0.1,
        utilityRate: 0.08,
      },
      {
        id: "budget-sub-1",
        projectId: "project-1",
        parentBudgetId: "budget-general-1",
        kind: "SUB_BUDGET",
        name: DEFAULT_INITIAL_SUB_BUDGET_NAMES[0],
        currency: "PEN",
        igvRate: 0.18,
        generalExpensesRate: 0.1,
        utilityRate: 0.08,
      },
      {
        id: "budget-sub-2",
        projectId: "project-1",
        parentBudgetId: "budget-general-1",
        kind: "SUB_BUDGET",
        name: DEFAULT_INITIAL_SUB_BUDGET_NAMES[1],
        currency: "PEN",
        igvRate: 0.18,
        generalExpensesRate: 0.1,
        utilityRate: 0.08,
      },
      {
        id: "budget-sub-3",
        projectId: "project-1",
        parentBudgetId: "budget-general-1",
        kind: "SUB_BUDGET",
        name: DEFAULT_INITIAL_SUB_BUDGET_NAMES[2],
        currency: "PEN",
        igvRate: 0.18,
        generalExpensesRate: 0.1,
        utilityRate: 0.08,
      },
      {
        id: "budget-sub-4",
        projectId: "project-1",
        parentBudgetId: "budget-general-1",
        kind: "SUB_BUDGET",
        name: DEFAULT_INITIAL_SUB_BUDGET_NAMES[3],
        currency: "PEN",
        igvRate: 0.18,
        generalExpensesRate: 0.1,
        utilityRate: 0.08,
      },
    ];

    mocks.getUserSettings.mockResolvedValue(defaultUserSettings);
    mocks.projectFindFirst.mockResolvedValue({
      id: "project-1",
      companyId: "company-1",
      name: "Proyecto 1",
      company: {
        id: "company-1",
        userId: "user-5",
      },
    });
    mocks.budgetFindMany.mockResolvedValueOnce(existingBudgets).mockResolvedValueOnce(existingBudgets);
    mocks.budgetFindUnique.mockResolvedValue({
      id: "budget-general-1",
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

    await getProjectById("project-1", "user-5");

    const updateCall = mocks.budgetUpdate.mock.calls.at(-1)?.[0];
    expect(updateCall).toBeDefined();
    expect(updateCall).toEqual(
      expect.objectContaining({
        where: { id: "budget-general-1" },
      }),
    );
    expect(updateCall?.data.totalDirectCost).toBeInstanceOf(Prisma.Decimal);
    expect(updateCall?.data.totalGeneralExpenses).toBeInstanceOf(Prisma.Decimal);
    expect(updateCall?.data.totalUtility).toBeInstanceOf(Prisma.Decimal);
    expect(updateCall?.data.totalTax).toBeInstanceOf(Prisma.Decimal);
    expect(updateCall?.data.totalAmount).toBeInstanceOf(Prisma.Decimal);
    expect(updateCall?.data.totalDirectCost.toString()).toBe("0.3");
    expect(updateCall?.data.totalGeneralExpenses.toString()).toBe("0.5");
    expect(updateCall?.data.totalUtility.toString()).toBe("0.7");
    expect(updateCall?.data.totalTax.toString()).toBe("0.9");
    expect(updateCall?.data.totalAmount.toString()).toBe("1.1");
  });
});
