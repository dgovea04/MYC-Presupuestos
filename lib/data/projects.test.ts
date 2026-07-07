import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { DEFAULT_INITIAL_SUB_BUDGET_NAMES } from "@/types/settings";

const mocks = vi.hoisted(() => ({
  companyFindFirst: vi.fn(),
  transaction: vi.fn(),
  projectFindFirst: vi.fn(),
  projectFindMany: vi.fn(),
  projectCreate: vi.fn(),
  budgetCreate: vi.fn(),
  budgetCreateMany: vi.fn(),
  budgetFindMany: vi.fn(),
  budgetFindUnique: vi.fn(),
  budgetUpdate: vi.fn(),
  budgetLevelCreate: vi.fn(),
  budgetItemCreate: vi.fn(),
  apuCreate: vi.fn(),
  apuResourceCreate: vi.fn(),
  generalExpenseCreate: vi.fn(),
  generalExpenseGroupCreate: vi.fn(),
  generalExpenseTitleCreate: vi.fn(),
  generalExpenseItemCreate: vi.fn(),
  footerRowCreate: vi.fn(),
  polynomialFormulaCreate: vi.fn(),
  polynomialMonomialCreate: vi.fn(),
  polynomialComponentCreate: vi.fn(),
  workScheduleCreate: vi.fn(),
  valuationCreate: vi.fn(),
  adjustmentCreate: vi.fn(),
  getUserSettings: vi.fn(),
  assertWithinPlanLimit: vi.fn(),
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

vi.mock("@/lib/billing/entitlements", () => ({
  assertWithinPlanLimit: mocks.assertWithinPlanLimit,
}));

import { defaultUserSettings } from "@/lib/data/settings";

const defaultSubBudgetNames = [...DEFAULT_INITIAL_SUB_BUDGET_NAMES];
const TEST_USER_ID = "user-1";
import * as projectData from "@/lib/data/projects";

const { createProject, duplicateProject, getProjectById } = projectData;

function createDuplicationSourceProject() {
  const sourceProjectId = "project-source";
  const generalBudgetId = "budget-general-source";
  const subBudgetId = "budget-sub-source";
  const levelId = "level-source";
  const itemId = "item-source";
  const apuId = "apu-source";
  const apuResourceId = "apu-resource-source";
  const groupId = "group-source";
  const titleId = "title-source";
  const expenseItemId = "expense-item-source";
  const footerRowId = "footer-row-source";
  const formulaId = "formula-source";
  const monomialId = "monomial-source";

  return {
    id: sourceProjectId,
    companyId: "company-1",
    name: "Hospital Norte",
    clientName: "Cliente 1",
    location: "Piura",
    projectType: "Edificacion",
    startDate: new Date("2026-01-10T00:00:00.000Z"),
    endDate: new Date("2026-06-20T00:00:00.000Z"),
    status: "IN_PROGRESS",
    budgets: [
      {
        id: generalBudgetId,
        projectId: sourceProjectId,
        parentBudgetId: null,
        kind: "GENERAL",
        name: "Presupuesto General",
        currency: "PEN",
        igvRate: new Prisma.Decimal("0.18"),
        generalExpensesRate: new Prisma.Decimal("0.10"),
        utilityRate: new Prisma.Decimal("0.08"),
        totalDirectCost: new Prisma.Decimal("1000"),
        totalGeneralExpenses: new Prisma.Decimal("100"),
        totalUtility: new Prisma.Decimal("80"),
        totalTax: new Prisma.Decimal("212.4"),
        totalAmount: new Prisma.Decimal("1392.4"),
        levels: [],
        items: [],
        generalExpenses: [],
        generalExpenseGroups: [],
        footerRows: [],
        workSchedule: { id: "schedule-source" },
        valuations: [{ id: "valuation-source" }],
      },
      {
        id: subBudgetId,
        projectId: sourceProjectId,
        parentBudgetId: generalBudgetId,
        kind: "SUB_BUDGET",
        name: "Estructuras",
        currency: "PEN",
        igvRate: new Prisma.Decimal("0.18"),
        generalExpensesRate: new Prisma.Decimal("0.10"),
        utilityRate: new Prisma.Decimal("0.08"),
        totalDirectCost: new Prisma.Decimal("1000"),
        totalGeneralExpenses: new Prisma.Decimal("100"),
        totalUtility: new Prisma.Decimal("80"),
        totalTax: new Prisma.Decimal("212.4"),
        totalAmount: new Prisma.Decimal("1392.4"),
        levels: [
          {
            id: levelId,
            budgetId: subBudgetId,
            parentId: null,
            type: "TITLE",
            code: "01",
            name: "Obras provisionales",
            sortOrder: 0,
          },
        ],
        items: [
          {
            id: itemId,
            budgetId: subBudgetId,
            levelId,
            code: "01.01",
            description: "Trazo y replanteo",
            unit: "m2",
            quantity: new Prisma.Decimal("10"),
            unitPrice: new Prisma.Decimal("25"),
            partial: new Prisma.Decimal("250"),
            sortOrder: 0,
            apu: {
              id: apuId,
              budgetItemId: itemId,
              name: "Trazo y replanteo",
              unit: "m2",
              performance: new Prisma.Decimal("1"),
              totalUnitCost: new Prisma.Decimal("25"),
              resources: [
                {
                  id: apuResourceId,
                  apuId,
                  resourceId: "resource-1",
                  resourceType: "LABOR",
                  crew: new Prisma.Decimal("1"),
                  quantity: new Prisma.Decimal("2"),
                  unitPrice: new Prisma.Decimal("12.5"),
                  subtotal: new Prisma.Decimal("25"),
                },
              ],
            },
          },
        ],
        generalExpenses: [
          {
            id: "general-expense-source",
            budgetId: subBudgetId,
            name: "Movilidad",
            type: "FIXED",
            amount: new Prisma.Decimal("1500"),
            percentage: null,
          },
        ],
        generalExpenseGroups: [
          {
            id: groupId,
            budgetId: subBudgetId,
            name: "Gastos fijos",
            kind: "FIXED",
            sortOrder: 0,
            titles: [
              {
                id: titleId,
                groupId,
                code: "1",
                name: "Personal tecnico",
                category: "STANDARD",
                sortOrder: 0,
                items: [
                  {
                    id: expenseItemId,
                    titleId,
                    code: "1.1",
                    description: "Residente",
                    category: "STANDARD",
                    unit: "mes",
                    quantityDescription: "1 x 6",
                    quantity: new Prisma.Decimal("6"),
                    participationPercentage: new Prisma.Decimal("0"),
                    unitPrice: new Prisma.Decimal("3000"),
                    sortOrder: 0,
                  },
                ],
              },
            ],
          },
        ],
        footerRows: [
          {
            id: footerRowId,
            budgetId: subBudgetId,
            variable: "K",
            description: "Coeficiente",
            formula: "CD + GG + U",
            manualValue: new Prisma.Decimal("0"),
            iu: "39",
            highlight: true,
            sortOrder: 0,
          },
        ],
        workSchedule: { id: "schedule-sub-source" },
        valuations: [{ id: "valuation-sub-source" }],
      },
    ],
    polynomialFormulas: [
      {
        id: formulaId,
        projectId: sourceProjectId,
        budgetId: subBudgetId,
        name: "Formula base",
        baseMonth: 1,
        baseYear: 2026,
        totalBaseAmount: new Prisma.Decimal("250"),
        status: "VALID",
        monomials: [
          {
            id: monomialId,
            formulaId,
            code: "M1",
            name: "Mano de obra",
            costGroupKey: "LABOR",
            amount: new Prisma.Decimal("250"),
            coefficient: new Prisma.Decimal("1.000"),
            baseIndexCode: "47",
            baseIndexName: "Mano de obra",
            baseIndexValue: new Prisma.Decimal("500.000"),
            adjustmentIndexCode: null,
            adjustmentIndexName: null,
            adjustmentIndexValue: null,
            sortOrder: 0,
            components: [
              {
                id: "component-source",
                monomialId,
                budgetItemId: itemId,
                apuResourceId,
                resourceType: "LABOR",
                amount: new Prisma.Decimal("250"),
              },
            ],
          },
        ],
        valuations: [{ id: "formula-valuation-source" }],
        adjustments: [{ id: "adjustment-source" }],
      },
    ],
  };
}

function wireDuplicationTransactionMocks() {
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      project: {
        create: mocks.projectCreate,
        findFirst: mocks.projectFindFirst,
        findMany: mocks.projectFindMany,
      },
      budget: {
        create: mocks.budgetCreate,
        createMany: mocks.budgetCreateMany,
        findMany: mocks.budgetFindMany,
        findUnique: mocks.budgetFindUnique,
        update: mocks.budgetUpdate,
      },
      budgetLevel: {
        create: mocks.budgetLevelCreate,
      },
      budgetItem: {
        create: mocks.budgetItemCreate,
      },
      apu: {
        create: mocks.apuCreate,
      },
      apuResource: {
        create: mocks.apuResourceCreate,
      },
      generalExpense: {
        create: mocks.generalExpenseCreate,
      },
      generalExpenseGroup: {
        create: mocks.generalExpenseGroupCreate,
      },
      generalExpenseTitle: {
        create: mocks.generalExpenseTitleCreate,
      },
      generalExpenseItem: {
        create: mocks.generalExpenseItemCreate,
      },
      budgetFooterRow: {
        create: mocks.footerRowCreate,
      },
      polynomialFormula: {
        create: mocks.polynomialFormulaCreate,
      },
      polynomialMonomial: {
        create: mocks.polynomialMonomialCreate,
      },
      polynomialMonomialComponent: {
        create: mocks.polynomialComponentCreate,
      },
      workSchedule: {
        create: mocks.workScheduleCreate,
      },
      valuation: {
        create: mocks.valuationCreate,
      },
      polynomialAdjustment: {
        create: mocks.adjustmentCreate,
      },
    }),
  );
}

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
    mocks.assertWithinPlanLimit.mockReset();

    mocks.companyFindFirst.mockResolvedValue({ id: "company-1" });
    mocks.assertWithinPlanLimit.mockResolvedValue(undefined);
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
        totalDirectCost: 0,
        totalGeneralExpenses: 0,
        totalUtility: 0,
        totalTax: 0,
        totalAmount: 0,
        createdAt: null,
        updatedAt: null,
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
        totalDirectCost: 0,
        totalGeneralExpenses: 0,
        totalUtility: 0,
        totalTax: 0,
        totalAmount: 0,
        createdAt: null,
        updatedAt: null,
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
        totalDirectCost: 0,
        totalGeneralExpenses: 0,
        totalUtility: 0,
        totalTax: 0,
        totalAmount: 0,
        createdAt: null,
        updatedAt: null,
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
        totalDirectCost: 0,
        totalGeneralExpenses: 0,
        totalUtility: 0,
        totalTax: 0,
        totalAmount: 0,
        createdAt: null,
        updatedAt: null,
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
        totalDirectCost: 0,
        totalGeneralExpenses: 0,
        totalUtility: 0,
        totalTax: 0,
        totalAmount: 0,
        createdAt: null,
        updatedAt: null,
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
      totalDirectCost: 0,
      totalGeneralExpenses: 0,
      totalUtility: 0,
      totalTax: 0,
      totalAmount: 0,
      createdAt: null,
      updatedAt: null,
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
      totalDirectCost: 0,
      totalGeneralExpenses: 0,
      totalUtility: 0,
      totalTax: 0,
      totalAmount: 0,
      createdAt: null,
      updatedAt: null,
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
        totalDirectCost: 0,
        totalGeneralExpenses: 0,
        totalUtility: 0,
        totalTax: 0,
        totalAmount: 0,
        createdAt: null,
        updatedAt: null,
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
        totalDirectCost: 0,
        totalGeneralExpenses: 0,
        totalUtility: 0,
        totalTax: 0,
        totalAmount: 0,
        createdAt: null,
        updatedAt: null,
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
        totalDirectCost: 0,
        totalGeneralExpenses: 0,
        totalUtility: 0,
        totalTax: 0,
        totalAmount: 0,
        createdAt: null,
        updatedAt: null,
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

  it("returns a serializable project payload for client forms", async () => {
    const existingBudgetsRaw = [
      {
        id: "budget-general-1",
        projectId: "project-1",
        parentBudgetId: null,
        kind: "GENERAL",
        name: "Presupuesto General",
        currency: "PEN",
        igvRate: new Prisma.Decimal("0.18"),
        generalExpensesRate: new Prisma.Decimal("0.10"),
        utilityRate: new Prisma.Decimal("0.08"),
        totalDirectCost: new Prisma.Decimal("1392.4"),
        totalGeneralExpenses: new Prisma.Decimal("139.24"),
        totalUtility: new Prisma.Decimal("111.39"),
        totalTax: new Prisma.Decimal("295.42"),
        totalAmount: new Prisma.Decimal("1938.45"),
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-02T00:00:00.000Z"),
      },
      {
        id: "budget-sub-1",
        projectId: "project-1",
        parentBudgetId: "budget-general-1",
        kind: "SUB_BUDGET",
        name: DEFAULT_INITIAL_SUB_BUDGET_NAMES[0],
        currency: "PEN",
        igvRate: new Prisma.Decimal("0.18"),
        generalExpensesRate: new Prisma.Decimal("0.10"),
        utilityRate: new Prisma.Decimal("0.08"),
        totalDirectCost: new Prisma.Decimal("1000"),
        totalGeneralExpenses: new Prisma.Decimal("100"),
        totalUtility: new Prisma.Decimal("80"),
        totalTax: new Prisma.Decimal("212.4"),
        totalAmount: new Prisma.Decimal("1392.4"),
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-02T00:00:00.000Z"),
      },
      {
        id: "budget-sub-2",
        projectId: "project-1",
        parentBudgetId: "budget-general-1",
        kind: "SUB_BUDGET",
        name: DEFAULT_INITIAL_SUB_BUDGET_NAMES[1],
        currency: "PEN",
        igvRate: new Prisma.Decimal("0.18"),
        generalExpensesRate: new Prisma.Decimal("0.10"),
        utilityRate: new Prisma.Decimal("0.08"),
        totalDirectCost: new Prisma.Decimal("0"),
        totalGeneralExpenses: new Prisma.Decimal("0"),
        totalUtility: new Prisma.Decimal("0"),
        totalTax: new Prisma.Decimal("0"),
        totalAmount: new Prisma.Decimal("0"),
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-02T00:00:00.000Z"),
      },
      {
        id: "budget-sub-3",
        projectId: "project-1",
        parentBudgetId: "budget-general-1",
        kind: "SUB_BUDGET",
        name: DEFAULT_INITIAL_SUB_BUDGET_NAMES[2],
        currency: "PEN",
        igvRate: new Prisma.Decimal("0.18"),
        generalExpensesRate: new Prisma.Decimal("0.10"),
        utilityRate: new Prisma.Decimal("0.08"),
        totalDirectCost: new Prisma.Decimal("0"),
        totalGeneralExpenses: new Prisma.Decimal("0"),
        totalUtility: new Prisma.Decimal("0"),
        totalTax: new Prisma.Decimal("0"),
        totalAmount: new Prisma.Decimal("0"),
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-02T00:00:00.000Z"),
      },
      {
        id: "budget-sub-4",
        projectId: "project-1",
        parentBudgetId: "budget-general-1",
        kind: "SUB_BUDGET",
        name: DEFAULT_INITIAL_SUB_BUDGET_NAMES[3],
        currency: "PEN",
        igvRate: new Prisma.Decimal("0.18"),
        generalExpensesRate: new Prisma.Decimal("0.10"),
        utilityRate: new Prisma.Decimal("0.08"),
        totalDirectCost: new Prisma.Decimal("0"),
        totalGeneralExpenses: new Prisma.Decimal("0"),
        totalUtility: new Prisma.Decimal("0"),
        totalTax: new Prisma.Decimal("0"),
        totalAmount: new Prisma.Decimal("0"),
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-02T00:00:00.000Z"),
      },
    ];

    const expectedBudgets = existingBudgetsRaw.map((budget) => ({
      id: budget.id,
      projectId: budget.projectId,
      parentBudgetId: budget.parentBudgetId,
      kind: budget.kind,
      name: budget.name,
      currency: budget.currency,
      igvRate: budget.igvRate.toNumber(),
      generalExpensesRate: budget.generalExpensesRate.toNumber(),
      utilityRate: budget.utilityRate.toNumber(),
      totalDirectCost: budget.totalDirectCost.toNumber(),
      totalGeneralExpenses: budget.totalGeneralExpenses.toNumber(),
      totalUtility: budget.totalUtility.toNumber(),
      totalTax: budget.totalTax.toNumber(),
      totalAmount: budget.totalAmount.toNumber(),
      createdAt: budget.createdAt.toISOString(),
      updatedAt: budget.updatedAt.toISOString(),
    }));

    mocks.getUserSettings.mockResolvedValue(defaultUserSettings);
    mocks.projectFindFirst.mockResolvedValue({
      id: "project-1",
      companyId: "company-1",
      name: "Proyecto serializable",
      clientName: "Cliente serializable",
      location: "Lima",
      projectType: "Edificacion",
      startDate: new Date("2026-01-05T00:00:00.000Z"),
      endDate: new Date("2026-03-07T00:00:00.000Z"),
      status: "IN_PROGRESS",
      projectCalendars: [
        {
          workCalendarId: "calendar-1",
          workCalendar: {
            id: "calendar-1",
            name: "Lun-Vie",
            workDays: 31,
            workHoursPerDay: new Prisma.Decimal("8"),
            exceptions: [
              {
                id: "exception-1",
                date: new Date("2026-02-14T00:00:00.000Z"),
                type: "HOLIDAY",
                description: "Mantenimiento",
              },
            ],
          },
        },
      ],
    });
    mocks.budgetFindMany.mockResolvedValueOnce(existingBudgetsRaw).mockResolvedValueOnce(existingBudgetsRaw);
    mocks.budgetFindUnique.mockResolvedValue({
      id: "budget-general-1",
      childBudgets: [],
    });

    const project = await getProjectById("project-1", "user-serializable");

    expect(project).toEqual({
      id: "project-1",
      companyId: "company-1",
      name: "Proyecto serializable",
      clientName: "Cliente serializable",
      location: "Lima",
      projectType: "Edificacion",
      startDate: "2026-01-05T00:00:00.000Z",
      endDate: "2026-03-07T00:00:00.000Z",
      status: "IN_PROGRESS",
      budgets: expectedBudgets,
      workCalendarId: "calendar-1",
    });
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

  describe("project duplication", () => {
    beforeEach(() => {
      mocks.projectFindMany.mockReset();
      mocks.budgetLevelCreate.mockReset();
      mocks.budgetItemCreate.mockReset();
      mocks.apuCreate.mockReset();
      mocks.apuResourceCreate.mockReset();
      mocks.generalExpenseCreate.mockReset();
      mocks.generalExpenseGroupCreate.mockReset();
      mocks.generalExpenseTitleCreate.mockReset();
      mocks.generalExpenseItemCreate.mockReset();
      mocks.footerRowCreate.mockReset();
      mocks.polynomialFormulaCreate.mockReset();
      mocks.polynomialMonomialCreate.mockReset();
      mocks.polynomialComponentCreate.mockReset();
      mocks.workScheduleCreate.mockReset();
      mocks.valuationCreate.mockReset();
      mocks.adjustmentCreate.mockReset();

      wireDuplicationTransactionMocks();
    });

    it("duplicates a project's technical structure and skips operational history", async () => {
      const sourceProject = createDuplicationSourceProject();

      mocks.projectFindFirst.mockResolvedValue(sourceProject);
      mocks.projectFindMany.mockResolvedValue([{ name: "Hospital Norte (copia)" }]);
      mocks.projectCreate.mockResolvedValue({
        id: "project-copy-2",
        name: "Hospital Norte (copia 2)",
      });
      mocks.budgetCreate
        .mockResolvedValueOnce({
          id: "budget-general-copy",
          projectId: "project-copy-2",
          parentBudgetId: null,
        })
        .mockResolvedValueOnce({
          id: "budget-sub-copy",
          projectId: "project-copy-2",
          parentBudgetId: "budget-general-copy",
        });
      mocks.budgetLevelCreate.mockResolvedValue({ id: "level-copy" });
      mocks.budgetItemCreate.mockResolvedValue({ id: "item-copy" });
      mocks.apuCreate.mockResolvedValue({ id: "apu-copy" });
      mocks.apuResourceCreate.mockResolvedValue({ id: "apu-resource-copy" });
      mocks.generalExpenseCreate.mockResolvedValue({ id: "general-expense-copy" });
      mocks.generalExpenseGroupCreate.mockResolvedValue({ id: "group-copy" });
      mocks.generalExpenseTitleCreate.mockResolvedValue({ id: "title-copy" });
      mocks.generalExpenseItemCreate.mockResolvedValue({ id: "expense-item-copy" });
      mocks.footerRowCreate.mockResolvedValue({ id: "footer-row-copy" });
      mocks.polynomialFormulaCreate.mockResolvedValue({ id: "formula-copy" });
      mocks.polynomialMonomialCreate.mockResolvedValue({ id: "monomial-copy" });
      mocks.polynomialComponentCreate.mockResolvedValue({ id: "component-copy" });

      const duplicated = await duplicateProject("project-source", "user-1");

      expect(duplicated.name).toBe("Hospital Norte (copia 2)");
      expect(mocks.projectCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: "company-1",
          name: "Hospital Norte (copia 2)",
          clientName: "Cliente 1",
          location: "Piura",
          projectType: "Edificacion",
          status: "IN_PROGRESS",
        }),
      });
      expect(mocks.budgetCreate).toHaveBeenCalledTimes(2);
      expect(mocks.budgetCreate).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: "project-copy-2",
            parentBudgetId: null,
            kind: "GENERAL",
            name: "Presupuesto General",
          }),
        }),
      );
      expect(mocks.budgetCreate).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: "project-copy-2",
            parentBudgetId: "budget-general-copy",
            kind: "SUB_BUDGET",
            name: "Estructuras",
          }),
        }),
      );
      expect(mocks.budgetLevelCreate).toHaveBeenCalledTimes(1);
      expect(mocks.budgetLevelCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          budgetId: "budget-sub-copy",
          parentId: null,
          code: "01",
        }),
      });
      expect(mocks.budgetItemCreate).toHaveBeenCalledTimes(1);
      expect(mocks.budgetItemCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          budgetId: "budget-sub-copy",
          levelId: "level-copy",
          code: "01.01",
        }),
      });
      expect(mocks.apuCreate).toHaveBeenCalledTimes(1);
      expect(mocks.apuCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          budgetItemId: "item-copy",
          name: "Trazo y replanteo",
        }),
      });
      expect(mocks.apuResourceCreate).toHaveBeenCalledTimes(1);
      expect(mocks.apuResourceCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          apuId: "apu-copy",
          resourceId: "resource-1",
        }),
      });
      expect(mocks.generalExpenseCreate).toHaveBeenCalledTimes(1);
      expect(mocks.generalExpenseCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          budgetId: "budget-sub-copy",
          name: "Movilidad",
          type: "FIXED",
          amount: new Prisma.Decimal("1500"),
          percentage: null,
        }),
      });
      expect(mocks.generalExpenseGroupCreate).toHaveBeenCalledTimes(1);
      expect(mocks.generalExpenseGroupCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          budgetId: "budget-sub-copy",
          name: "Gastos fijos",
        }),
      });
      expect(mocks.generalExpenseTitleCreate).toHaveBeenCalledTimes(1);
      expect(mocks.generalExpenseTitleCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          groupId: "group-copy",
          code: "1",
        }),
      });
      expect(mocks.generalExpenseItemCreate).toHaveBeenCalledTimes(1);
      expect(mocks.generalExpenseItemCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          titleId: "title-copy",
          code: "1.1",
        }),
      });
      expect(mocks.footerRowCreate).toHaveBeenCalledTimes(1);
      expect(mocks.footerRowCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          budgetId: "budget-sub-copy",
          variable: "K",
          iu: "39",
        }),
      });
      expect(mocks.polynomialFormulaCreate).toHaveBeenCalledTimes(1);
      expect(mocks.polynomialFormulaCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: "project-copy-2",
          budgetId: "budget-sub-copy",
          name: "Formula base",
        }),
      });
      expect(mocks.polynomialMonomialCreate).toHaveBeenCalledTimes(1);
      expect(mocks.polynomialMonomialCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          formulaId: "formula-copy",
          code: "M1",
        }),
      });
      expect(mocks.polynomialComponentCreate).toHaveBeenCalledTimes(1);
      expect(mocks.polynomialComponentCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          monomialId: "monomial-copy",
          budgetItemId: "item-copy",
          apuResourceId: "apu-resource-copy",
        }),
      });
      expect(mocks.workScheduleCreate).not.toHaveBeenCalled();
      expect(mocks.valuationCreate).not.toHaveBeenCalled();
      expect(mocks.adjustmentCreate).not.toHaveBeenCalled();
    });

    it("rejects duplication when the source project does not belong to the user", async () => {
      mocks.projectFindFirst.mockResolvedValue(null);

      await expect(duplicateProject("project-unknown", "user-2")).rejects.toThrow(
        "No tienes permisos para duplicar este proyecto",
      );
      expect(mocks.projectCreate).not.toHaveBeenCalled();
      expect(mocks.budgetCreate).not.toHaveBeenCalled();
      expect(mocks.budgetLevelCreate).not.toHaveBeenCalled();
      expect(mocks.budgetItemCreate).not.toHaveBeenCalled();
      expect(mocks.apuCreate).not.toHaveBeenCalled();
      expect(mocks.apuResourceCreate).not.toHaveBeenCalled();
      expect(mocks.generalExpenseCreate).not.toHaveBeenCalled();
      expect(mocks.generalExpenseGroupCreate).not.toHaveBeenCalled();
      expect(mocks.generalExpenseTitleCreate).not.toHaveBeenCalled();
      expect(mocks.generalExpenseItemCreate).not.toHaveBeenCalled();
      expect(mocks.footerRowCreate).not.toHaveBeenCalled();
      expect(mocks.polynomialFormulaCreate).not.toHaveBeenCalled();
      expect(mocks.polynomialMonomialCreate).not.toHaveBeenCalled();
      expect(mocks.polynomialComponentCreate).not.toHaveBeenCalled();
      expect(mocks.workScheduleCreate).not.toHaveBeenCalled();
      expect(mocks.valuationCreate).not.toHaveBeenCalled();
      expect(mocks.adjustmentCreate).not.toHaveBeenCalled();
    });

    it("uses the base copy suffix when no duplicate names exist", async () => {
      mocks.projectFindFirst.mockResolvedValue({
        id: "project-source",
        companyId: "company-1",
        name: "Colegio Sur",
        clientName: "",
        location: "",
        projectType: "",
        startDate: null,
        endDate: null,
        status: "PLANNING",
        budgets: [],
        polynomialFormulas: [],
      });
      mocks.projectFindMany.mockResolvedValue([]);
      mocks.projectCreate.mockResolvedValue({
        id: "project-copy",
        name: "Colegio Sur (copia)",
      });

      await duplicateProject("project-source", "user-1");

      expect(mocks.projectFindMany).toHaveBeenCalledWith({
        where: {
          companyId: "company-1",
          name: {
            startsWith: "Colegio Sur (copia",
          },
        },
        select: { name: true },
      });
      expect(mocks.projectCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: "company-1",
          name: "Colegio Sur (copia)",
          status: "PLANNING",
        }),
      });
    });

    it("chooses the next numeric suffix when base and numbered copies already exist", async () => {
      mocks.projectFindFirst.mockResolvedValue({
        id: "project-source",
        companyId: "company-1",
        name: "Colegio Sur",
        clientName: "",
        location: "",
        projectType: "",
        startDate: null,
        endDate: null,
        status: "PLANNING",
        budgets: [],
        polynomialFormulas: [],
      });
      mocks.projectFindMany.mockResolvedValue([
        { name: "Colegio Sur (copia)" },
        { name: "Colegio Sur (copia 2)" },
      ]);
      mocks.projectCreate.mockResolvedValue({
        id: "project-copy-3",
        name: "Colegio Sur (copia 3)",
      });

      await duplicateProject("project-source", "user-1");

      expect(mocks.projectFindMany).toHaveBeenCalledWith({
        where: {
          companyId: "company-1",
          name: {
            startsWith: "Colegio Sur (copia",
          },
        },
        select: { name: true },
      });
      expect(mocks.projectCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: "company-1",
          name: "Colegio Sur (copia 3)",
          status: "PLANNING",
        }),
      });
    });
  });

  describe("getProjectsByUser batch-read optimization", () => {
    function buildCompleteBudgetStructure(projectId: string, generalBudgetId: string) {
      return defaultSubBudgetNames.map((name, index) => ({
        id: `budget-sub-${projectId}-${index}`,
        projectId,
        parentBudgetId: generalBudgetId,
        kind: "SUB_BUDGET" as const,
        name,
        currency: "PEN",
        igvRate: new Prisma.Decimal("0.18"),
        generalExpensesRate: new Prisma.Decimal("0.10"),
        utilityRate: new Prisma.Decimal("0.08"),
        totalDirectCost: new Prisma.Decimal("0"),
        totalGeneralExpenses: new Prisma.Decimal("0"),
        totalUtility: new Prisma.Decimal("0"),
        totalTax: new Prisma.Decimal("0"),
        totalAmount: new Prisma.Decimal("0"),
      }));
    }

    function buildGeneralBudget(projectId: string) {
      return {
        id: `budget-general-${projectId}`,
        projectId,
        parentBudgetId: null,
        kind: "GENERAL" as const,
        name: "Presupuesto General",
        currency: "PEN",
        igvRate: new Prisma.Decimal("0.18"),
        generalExpensesRate: new Prisma.Decimal("0.10"),
        utilityRate: new Prisma.Decimal("0.08"),
        totalDirectCost: new Prisma.Decimal("0"),
        totalGeneralExpenses: new Prisma.Decimal("0"),
        totalUtility: new Prisma.Decimal("0"),
        totalTax: new Prisma.Decimal("0"),
        totalAmount: new Prisma.Decimal("0"),
      };
    }

    function wireGetProjectsByUserTransaction(options: {
      projects: Array<{ id: string; name: string; companyId: string }>;
    }) {
      mocks.transaction.mockImplementation(async (callback: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const tx = {
          project: {
            findMany: mocks.projectFindMany,
            findFirst: mocks.projectFindFirst,
            create: mocks.projectCreate,
          },
          budget: {
            findMany: mocks.budgetFindMany,
            findUnique: mocks.budgetFindUnique,
            create: mocks.budgetCreate,
            createMany: mocks.budgetCreateMany,
            update: mocks.budgetUpdate,
          },
        };

        const processedProjects = options.projects.map((project) => ({
          ...project,
          company: { name: "Test Co" },
          status: "PLANNING",
          updatedAt: new Date(),
        }));

        mocks.projectFindMany.mockResolvedValueOnce(processedProjects);

        return callback(tx);
      });
    }

    it("batch-reads budgets in one query and returns projects with pre-fetched budgets on the fast path", async () => {
      const project1Id = "proj-1";
      const project2Id = "proj-2";
      const general1 = buildGeneralBudget(project1Id);
      const subs1 = buildCompleteBudgetStructure(project1Id, general1.id);
      const general2 = buildGeneralBudget(project2Id);
      const subs2 = buildCompleteBudgetStructure(project2Id, general2.id);
      const allBudgets = [general1, ...subs1, general2, ...subs2];

      mocks.getUserSettings.mockResolvedValue(defaultUserSettings);

      wireGetProjectsByUserTransaction({
        projects: [
          { id: project1Id, name: "Proyecto 1", companyId: "company-1" },
          { id: project2Id, name: "Proyecto 2", companyId: "company-1" },
        ],
      });

      mocks.budgetFindMany.mockResolvedValueOnce(allBudgets);

      const result = await projectData.getProjectsByUser(TEST_USER_ID);

      // Batch query was called once with all project IDs
      expect(mocks.budgetFindMany).toHaveBeenCalledTimes(1);
      expect(mocks.budgetFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: { in: [project1Id, project2Id] } },
        }),
      );

      // No writes occurred — fast path was taken
      expect(mocks.budgetCreate).not.toHaveBeenCalled();
      expect(mocks.budgetUpdate).not.toHaveBeenCalled();

      // Both projects returned with their budgets
      expect(result).toHaveLength(2);
      expect(result[0]!.id).toBe(project1Id);
      expect(result[0]!.budgets).toHaveLength(defaultSubBudgetNames.length + 1); // general + subs
      expect(result[1]!.id).toBe(project2Id);
      expect(result[1]!.budgets).toHaveLength(defaultSubBudgetNames.length + 1);
    });

    it("falls back to ensureProjectBudgetStructure when a project lacks a general budget", async () => {
      const project1Id = "proj-complete";
      const project2Id = "proj-missing";
      const general1 = buildGeneralBudget(project1Id);
      const subs1 = buildCompleteBudgetStructure(project1Id, general1.id);
      // Project 2 has sub-budgets but no general budget
      const orphanSubs = buildCompleteBudgetStructure(project2Id, "budget-general-proj-missing");
      const allBudgets = [general1, ...subs1, ...orphanSubs];

      mocks.getUserSettings.mockResolvedValue(defaultUserSettings);

      wireGetProjectsByUserTransaction({
        projects: [
          { id: project1Id, name: "Proyecto Completo", companyId: "company-1" },
          { id: project2Id, name: "Proyecto Incompleto", companyId: "company-1" },
        ],
      });

      mocks.budgetFindMany.mockResolvedValueOnce(allBudgets); // batch read

      // prepare mocks for the slow-path repair (ensureProjectBudgetStructure for project 2)
      const repairedGeneral = buildGeneralBudget(project2Id);
      const repairedSubs = buildCompleteBudgetStructure(project2Id, repairedGeneral.id);
      const repairedAll = [repairedGeneral, ...repairedSubs];

      mocks.budgetCreate.mockResolvedValue(repairedGeneral);
      mocks.budgetFindMany.mockResolvedValueOnce(orphanSubs); // ensureProjectBudgetStructure: initial read (still missing general)
      mocks.budgetFindMany.mockResolvedValueOnce(repairedAll); // ensureProjectBudgetStructure: final re-read (after repair)
      mocks.budgetFindUnique.mockResolvedValue({
        id: repairedGeneral.id,
        childBudgets: repairedSubs.map((sub) => ({
          totalDirectCost: sub.totalDirectCost,
          totalGeneralExpenses: sub.totalGeneralExpenses,
          totalUtility: sub.totalUtility,
          totalTax: sub.totalTax,
          totalAmount: sub.totalAmount,
        })),
      });

      const result = await projectData.getProjectsByUser(TEST_USER_ID);

      // Batch query was called
      expect(mocks.budgetFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: { in: [project1Id, project2Id] } },
        }),
      );

      // Slow path creates the missing general budget
      expect(mocks.budgetCreate).toHaveBeenCalled();

      // Both projects returned with budgets
      expect(result).toHaveLength(2);
    });

    it("returns empty array when user has no projects", async () => {
      mocks.getUserSettings.mockResolvedValue(defaultUserSettings);

      mocks.transaction.mockImplementation(async (callback: (tx: Record<string, unknown>) => Promise<unknown>) => {
        mocks.projectFindMany.mockResolvedValueOnce([]);
        return callback({
          project: { findMany: mocks.projectFindMany },
          budget: { findMany: mocks.budgetFindMany },
        });
      });

      const result = await projectData.getProjectsByUser(TEST_USER_ID);

      expect(result).toEqual([]);
      // Batch budget query is never called when there are no projects
      expect(mocks.budgetFindMany).not.toHaveBeenCalled();
    });

    it("falls back when a sub-budget has wrong parentBudgetId", async () => {
      const projectId = "proj-mislinked";
      const general = buildGeneralBudget(projectId);
      const subs = buildCompleteBudgetStructure(projectId, general.id);
      // Corrupt the first sub-budget's parentBudgetId
      subs[0] = { ...subs[0]!, parentBudgetId: "wrong-parent-id" };
      const allBudgets = [general, ...subs];

      mocks.getUserSettings.mockResolvedValue(defaultUserSettings);

      wireGetProjectsByUserTransaction({
        projects: [{ id: projectId, name: "Proyecto Mal Linkeado", companyId: "company-1" }],
      });

      mocks.budgetFindMany.mockResolvedValueOnce(allBudgets); // batch read

      // Repair mocks
      const repairedSubs = buildCompleteBudgetStructure(projectId, general.id);
      const repairedAll = [general, ...repairedSubs];
      mocks.budgetUpdate.mockResolvedValue(repairedSubs[0]);
      mocks.budgetFindMany.mockResolvedValueOnce(allBudgets); // ensureProjectBudgetStructure: initial read (still has wrong parent)
      mocks.budgetFindMany.mockResolvedValueOnce(repairedAll); // ensureProjectBudgetStructure: final re-read (after repair)
      mocks.budgetFindUnique.mockResolvedValue({
        id: general.id,
        childBudgets: repairedSubs.map((sub) => ({
          totalDirectCost: sub.totalDirectCost,
          totalGeneralExpenses: sub.totalGeneralExpenses,
          totalUtility: sub.totalUtility,
          totalTax: sub.totalTax,
          totalAmount: sub.totalAmount,
        })),
      });

      const result = await projectData.getProjectsByUser(TEST_USER_ID);

      // Budget update was called to fix the parent linkage
      expect(mocks.budgetUpdate).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });
});
