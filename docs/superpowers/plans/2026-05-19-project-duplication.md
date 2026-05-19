# Project Duplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Duplicar` project action that clones a project's editable technical budgeting structure while resetting schedules, valuations, adjustments, and report history.

**Architecture:** The feature will live primarily in the project data layer as a transactional duplication service. A dedicated API route will expose the operation, and the projects table will call it with the same optimistic refresh/error pattern used by the existing CRUD actions.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, Vitest, React, existing UI primitives

---

### Task 1: Expand the project data-layer test scaffold for duplication

**Files:**
- Modify: `lib/data/projects.test.ts`
- Test: `lib/data/projects.test.ts`

- [ ] **Step 1: Write the failing test for a deep project duplicate**

```ts
it("duplicates a project's technical structure and skips operational history", async () => {
  const sourceProject = {
    id: "project-source",
    companyId: "company-1",
    name: "Hospital Norte",
    clientName: "Cliente 1",
    location: "Piura",
    projectType: "Edificacion",
    startDate: new Date("2026-01-10T00:00:00.000Z"),
    endDate: new Date("2026-06-20T00:00:00.000Z"),
    status: "IN_PROGRESS",
  };

  const sourceGraph = {
    ...sourceProject,
    budgets: [
      {
        id: "budget-general-source",
        projectId: "project-source",
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
        id: "budget-sub-source",
        projectId: "project-source",
        parentBudgetId: "budget-general-source",
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
            id: "level-source",
            budgetId: "budget-sub-source",
            parentId: null,
            type: "TITLE",
            code: "01",
            name: "Obras provisionales",
            sortOrder: 0,
          },
        ],
        items: [
          {
            id: "item-source",
            budgetId: "budget-sub-source",
            levelId: "level-source",
            code: "01.01",
            description: "Trazo y replanteo",
            unit: "m2",
            quantity: new Prisma.Decimal("10"),
            unitPrice: new Prisma.Decimal("25"),
            partial: new Prisma.Decimal("250"),
            sortOrder: 0,
            apu: {
              id: "apu-source",
              budgetItemId: "item-source",
              name: "Trazo y replanteo",
              unit: "m2",
              performance: new Prisma.Decimal("1"),
              totalUnitCost: new Prisma.Decimal("25"),
              resources: [
                {
                  id: "apu-resource-source",
                  apuId: "apu-source",
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
        generalExpenses: [],
        generalExpenseGroups: [
          {
            id: "group-source",
            budgetId: "budget-sub-source",
            name: "Gastos fijos",
            kind: "FIXED",
            sortOrder: 0,
            titles: [
              {
                id: "title-source",
                groupId: "group-source",
                code: "1",
                name: "Personal tecnico",
                category: "STANDARD",
                sortOrder: 0,
                items: [
                  {
                    id: "expense-item-source",
                    titleId: "title-source",
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
            id: "footer-row-source",
            budgetId: "budget-sub-source",
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
        id: "formula-source",
        projectId: "project-source",
        budgetId: "budget-sub-source",
        name: "Formula base",
        baseMonth: 1,
        baseYear: 2026,
        totalBaseAmount: new Prisma.Decimal("250"),
        status: "VALID",
        monomials: [
          {
            id: "monomial-source",
            formulaId: "formula-source",
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
                monomialId: "monomial-source",
                budgetItemId: "item-source",
                apuResourceId: "apu-resource-source",
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

  mocks.projectFindFirst.mockResolvedValue(sourceGraph);
  mocks.projectFindMany.mockResolvedValue([{ name: "Hospital Norte (copia)" }]);

  const duplicated = await duplicateProject("project-source", "user-1");

  expect(duplicated.name).toBe("Hospital Norte (copia 2)");
  expect(mocks.projectCreate).toHaveBeenCalled();
  expect(mocks.budgetCreate).toHaveBeenCalledTimes(2);
  expect(mocks.budgetLevelCreate).toHaveBeenCalledTimes(1);
  expect(mocks.budgetItemCreate).toHaveBeenCalledTimes(1);
  expect(mocks.apuCreate).toHaveBeenCalledTimes(1);
  expect(mocks.apuResourceCreate).toHaveBeenCalledTimes(1);
  expect(mocks.generalExpenseGroupCreate).toHaveBeenCalledTimes(1);
  expect(mocks.generalExpenseTitleCreate).toHaveBeenCalledTimes(1);
  expect(mocks.generalExpenseItemCreate).toHaveBeenCalledTimes(1);
  expect(mocks.footerRowCreate).toHaveBeenCalledTimes(1);
  expect(mocks.polynomialFormulaCreate).toHaveBeenCalledTimes(1);
  expect(mocks.polynomialMonomialCreate).toHaveBeenCalledTimes(1);
  expect(mocks.polynomialComponentCreate).toHaveBeenCalledTimes(1);
  expect(mocks.workScheduleCreate).not.toHaveBeenCalled();
  expect(mocks.valuationCreate).not.toHaveBeenCalled();
  expect(mocks.adjustmentCreate).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Add the extra mocks the failing test needs**

```ts
const mocks = vi.hoisted(() => ({
  companyFindFirst: vi.fn(),
  projectFindFirst: vi.fn(),
  projectFindMany: vi.fn(),
  projectCreate: vi.fn(),
  projectUpdate: vi.fn(),
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
  transaction: vi.fn(),
  getUserSettings: vi.fn(),
}));
```

- [ ] **Step 3: Wire the mocked transaction client so the duplication test can run**

```ts
mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
  callback({
    project: {
      create: mocks.projectCreate,
      findFirst: mocks.projectFindFirst,
      findMany: mocks.projectFindMany,
      update: mocks.projectUpdate,
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
  }),
);
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm run test -- lib/data/projects.test.ts`

Expected: FAIL because `duplicateProject` does not exist yet or because the duplication path is incomplete.

- [ ] **Step 5: Commit**

```bash
git add lib/data/projects.test.ts
git commit -m "test: cover deep project duplication behavior"
```

### Task 2: Add ownership and naming-edge tests for duplication

**Files:**
- Modify: `lib/data/projects.test.ts`
- Test: `lib/data/projects.test.ts`

- [ ] **Step 1: Write the failing unauthorized test**

```ts
it("rejects duplication when the source project does not belong to the user", async () => {
  mocks.projectFindFirst.mockResolvedValue(null);

  await expect(duplicateProject("project-unknown", "user-2")).rejects.toThrow(
    "No tienes permisos para duplicar este proyecto",
  );
});
```

- [ ] **Step 2: Write the failing naming test for the first available copy**

```ts
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

  expect(mocks.projectCreate).toHaveBeenCalledWith({
    data: expect.objectContaining({
      name: "Colegio Sur (copia)",
    }),
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test -- lib/data/projects.test.ts`

Expected: FAIL because the new authorization and naming rules are not implemented yet.

- [ ] **Step 4: Commit**

```bash
git add lib/data/projects.test.ts
git commit -m "test: cover duplicate project ownership and naming"
```

### Task 3: Implement the duplication service in the project data layer

**Files:**
- Modify: `lib/data/projects.ts`
- Test: `lib/data/projects.test.ts`

- [ ] **Step 1: Add the new export and helper signatures**

```ts
export async function duplicateProject(sourceProjectId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const sourceProject = await tx.project.findFirst({
      where: {
        id: sourceProjectId,
        company: {
          userId,
        },
      },
      include: {
        budgets: {
          include: {
            levels: true,
            items: {
              include: {
                apu: {
                  include: {
                    resources: true,
                  },
                },
              },
            },
            generalExpenses: true,
            generalExpenseGroups: {
              include: {
                titles: {
                  include: {
                    items: true,
                  },
                },
              },
            },
            footerRows: true,
          },
          orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
        },
        polynomialFormulas: {
          include: {
            monomials: {
              include: {
                components: true,
              },
              orderBy: {
                sortOrder: "asc",
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!sourceProject) {
      throw new Error("No tienes permisos para duplicar este proyecto");
    }

    const nextName = await resolveDuplicateProjectName(tx, sourceProject.companyId, sourceProject.name);
    return createDuplicatedProjectGraph(tx, sourceProject, nextName);
  });
}

async function resolveDuplicateProjectName(
  tx: Prisma.TransactionClient,
  companyId: string,
  sourceName: string,
) {
  const baseName = `${sourceName} (copia)`;
  const siblings = await tx.project.findMany({
    where: {
      companyId,
      name: {
        startsWith: baseName,
      },
    },
    select: {
      name: true,
    },
  });

  if (siblings.length === 0) {
    return baseName;
  }

  let suffix = 2;
  let candidate = `${sourceName} (copia ${suffix})`;
  const taken = new Set(siblings.map((project) => project.name));

  while (taken.has(candidate)) {
    suffix += 1;
    candidate = `${sourceName} (copia ${suffix})`;
  }

  return candidate;
}
```

- [ ] **Step 2: Add the minimal duplication implementation with ID maps**

```ts
async function createDuplicatedProjectGraph(
  tx: Prisma.TransactionClient,
  sourceProject: SourceProjectGraph,
  duplicatedName: string,
) {
  const duplicatedProject = await tx.project.create({
    data: {
      companyId: sourceProject.companyId,
      name: duplicatedName,
      clientName: sourceProject.clientName,
      location: sourceProject.location,
      projectType: sourceProject.projectType,
      startDate: sourceProject.startDate,
      endDate: sourceProject.endDate,
      status: sourceProject.status,
    },
  });

  const budgetIdMap = new Map<string, string>();
  const levelIdMap = new Map<string, string>();
  const itemIdMap = new Map<string, string>();
  const apuIdMap = new Map<string, string>();
  const apuResourceIdMap = new Map<string, string>();
  const groupIdMap = new Map<string, string>();
  const titleIdMap = new Map<string, string>();
  const formulaIdMap = new Map<string, string>();
  const monomialIdMap = new Map<string, string>();

  for (const sourceBudget of sourceProject.budgets) {
    const createdBudget = await tx.budget.create({
      data: {
        projectId: duplicatedProject.id,
        parentBudgetId: sourceBudget.parentBudgetId ? budgetIdMap.get(sourceBudget.parentBudgetId) ?? null : null,
        kind: sourceBudget.kind,
        name: sourceBudget.name,
        currency: sourceBudget.currency,
        igvRate: sourceBudget.igvRate,
        generalExpensesRate: sourceBudget.generalExpensesRate,
        utilityRate: sourceBudget.utilityRate,
        totalDirectCost: sourceBudget.totalDirectCost,
        totalGeneralExpenses: sourceBudget.totalGeneralExpenses,
        totalUtility: sourceBudget.totalUtility,
        totalTax: sourceBudget.totalTax,
        totalAmount: sourceBudget.totalAmount,
      },
    });

    budgetIdMap.set(sourceBudget.id, createdBudget.id);

    for (const sourceLevel of sourceBudget.levels) {
      const createdLevel = await tx.budgetLevel.create({
        data: {
          budgetId: createdBudget.id,
          parentId: sourceLevel.parentId ? levelIdMap.get(sourceLevel.parentId) ?? null : null,
          type: sourceLevel.type,
          code: sourceLevel.code,
          name: sourceLevel.name,
          sortOrder: sourceLevel.sortOrder,
        },
      });

      levelIdMap.set(sourceLevel.id, createdLevel.id);
    }

    for (const sourceItem of sourceBudget.items) {
      const createdItem = await tx.budgetItem.create({
        data: {
          budgetId: createdBudget.id,
          levelId: sourceItem.levelId ? levelIdMap.get(sourceItem.levelId) ?? null : null,
          code: sourceItem.code,
          description: sourceItem.description,
          unit: sourceItem.unit,
          quantity: sourceItem.quantity,
          unitPrice: sourceItem.unitPrice,
          partial: sourceItem.partial,
          sortOrder: sourceItem.sortOrder,
        },
      });

      itemIdMap.set(sourceItem.id, createdItem.id);

      if (sourceItem.apu) {
        const createdApu = await tx.apu.create({
          data: {
            budgetItemId: createdItem.id,
            name: sourceItem.apu.name,
            unit: sourceItem.apu.unit,
            performance: sourceItem.apu.performance,
            totalUnitCost: sourceItem.apu.totalUnitCost,
          },
        });

        apuIdMap.set(sourceItem.apu.id, createdApu.id);

        for (const sourceApuResource of sourceItem.apu.resources) {
          const createdApuResource = await tx.apuResource.create({
            data: {
              apuId: createdApu.id,
              resourceId: sourceApuResource.resourceId,
              resourceType: sourceApuResource.resourceType,
              crew: sourceApuResource.crew,
              quantity: sourceApuResource.quantity,
              unitPrice: sourceApuResource.unitPrice,
              subtotal: sourceApuResource.subtotal,
            },
          });

          apuResourceIdMap.set(sourceApuResource.id, createdApuResource.id);
        }
      }
    }

    for (const sourceExpense of sourceBudget.generalExpenses) {
      await tx.generalExpense.create({
        data: {
          budgetId: createdBudget.id,
          name: sourceExpense.name,
          type: sourceExpense.type,
          amount: sourceExpense.amount,
          percentage: sourceExpense.percentage,
        },
      });
    }

    for (const sourceGroup of sourceBudget.generalExpenseGroups) {
      const createdGroup = await tx.generalExpenseGroup.create({
        data: {
          budgetId: createdBudget.id,
          name: sourceGroup.name,
          kind: sourceGroup.kind,
          sortOrder: sourceGroup.sortOrder,
        },
      });

      groupIdMap.set(sourceGroup.id, createdGroup.id);

      for (const sourceTitle of sourceGroup.titles) {
        const createdTitle = await tx.generalExpenseTitle.create({
          data: {
            groupId: createdGroup.id,
            code: sourceTitle.code,
            name: sourceTitle.name,
            category: sourceTitle.category,
            sortOrder: sourceTitle.sortOrder,
          },
        });

        titleIdMap.set(sourceTitle.id, createdTitle.id);

        for (const sourceExpenseItem of sourceTitle.items) {
          await tx.generalExpenseItem.create({
            data: {
              titleId: createdTitle.id,
              code: sourceExpenseItem.code,
              description: sourceExpenseItem.description,
              category: sourceExpenseItem.category,
              unit: sourceExpenseItem.unit,
              quantityDescription: sourceExpenseItem.quantityDescription,
              quantity: sourceExpenseItem.quantity,
              participationPercentage: sourceExpenseItem.participationPercentage,
              unitPrice: sourceExpenseItem.unitPrice,
              sortOrder: sourceExpenseItem.sortOrder,
            },
          });
        }
      }
    }

    for (const sourceFooterRow of sourceBudget.footerRows) {
      await tx.budgetFooterRow.create({
        data: {
          budgetId: createdBudget.id,
          variable: sourceFooterRow.variable,
          description: sourceFooterRow.description,
          formula: sourceFooterRow.formula,
          manualValue: sourceFooterRow.manualValue,
          iu: sourceFooterRow.iu,
          highlight: sourceFooterRow.highlight,
          sortOrder: sourceFooterRow.sortOrder,
        },
      });
    }
  }

  for (const sourceFormula of sourceProject.polynomialFormulas) {
    const createdFormula = await tx.polynomialFormula.create({
      data: {
        projectId: duplicatedProject.id,
        budgetId: budgetIdMap.get(sourceFormula.budgetId) ?? "",
        name: sourceFormula.name,
        baseMonth: sourceFormula.baseMonth,
        baseYear: sourceFormula.baseYear,
        totalBaseAmount: sourceFormula.totalBaseAmount,
        status: sourceFormula.status,
      },
    });

    formulaIdMap.set(sourceFormula.id, createdFormula.id);

    for (const sourceMonomial of sourceFormula.monomials) {
      const createdMonomial = await tx.polynomialMonomial.create({
        data: {
          formulaId: createdFormula.id,
          code: sourceMonomial.code,
          name: sourceMonomial.name,
          costGroupKey: sourceMonomial.costGroupKey,
          amount: sourceMonomial.amount,
          coefficient: sourceMonomial.coefficient,
          baseIndexCode: sourceMonomial.baseIndexCode,
          baseIndexName: sourceMonomial.baseIndexName,
          baseIndexValue: sourceMonomial.baseIndexValue,
          adjustmentIndexCode: sourceMonomial.adjustmentIndexCode,
          adjustmentIndexName: sourceMonomial.adjustmentIndexName,
          adjustmentIndexValue: sourceMonomial.adjustmentIndexValue,
          sortOrder: sourceMonomial.sortOrder,
        },
      });

      monomialIdMap.set(sourceMonomial.id, createdMonomial.id);

      for (const sourceComponent of sourceMonomial.components) {
        await tx.polynomialMonomialComponent.create({
          data: {
            monomialId: createdMonomial.id,
            budgetItemId: sourceComponent.budgetItemId ? itemIdMap.get(sourceComponent.budgetItemId) ?? null : null,
            apuResourceId: sourceComponent.apuResourceId
              ? apuResourceIdMap.get(sourceComponent.apuResourceId) ?? null
              : null,
            resourceType: sourceComponent.resourceType,
            amount: sourceComponent.amount,
          },
        });
      }
    }
  }

  return duplicatedProject;
}
```

- [ ] **Step 3: Add the source graph types needed by the implementation**

```ts
type SourceProjectGraph = Prisma.ProjectGetPayload<{
  include: {
    budgets: {
      include: {
        levels: true;
        items: {
          include: {
            apu: {
              include: {
                resources: true;
              };
            };
          };
        };
        generalExpenses: true;
        generalExpenseGroups: {
          include: {
            titles: {
              include: {
                items: true;
              };
            };
          };
        };
        footerRows: true;
      };
    };
    polynomialFormulas: {
      include: {
        monomials: {
          include: {
            components: true;
          };
        };
      };
    };
  };
}>;
```

- [ ] **Step 4: Update the test imports and run the data tests**

```ts
import { createProject, duplicateProject, getProjectById } from "@/lib/data/projects";
```

Run: `npm run test -- lib/data/projects.test.ts`

Expected: PASS for the new duplication tests and existing project tests.

- [ ] **Step 5: Commit**

```bash
git add lib/data/projects.ts lib/data/projects.test.ts
git commit -m "feat: add transactional project duplication service"
```

### Task 4: Add the duplicate-project API route tests

**Files:**
- Create: `app/api/projects/[id]/duplicate/route.test.ts`
- Test: `app/api/projects/[id]/duplicate/route.test.ts`

- [ ] **Step 1: Write the failing unauthorized route test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  duplicateProject: vi.fn(),
  recordActivityEvent: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/data/projects", () => ({
  duplicateProject: mocks.duplicateProject,
}));

vi.mock("@/lib/data/activity-events", () => ({
  recordActivityEvent: mocks.recordActivityEvent,
}));

import { POST } from "@/app/api/projects/[id]/duplicate/route";

describe("POST /api/projects/[id]/duplicate", () => {
  beforeEach(() => {
    mocks.getAuthSession.mockReset();
    mocks.duplicateProject.mockReset();
    mocks.recordActivityEvent.mockReset();
    mocks.revalidatePath.mockReset();
  });

  it("returns 401 when the user is not authenticated", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/projects/project-1/duplicate"), {
      params: Promise.resolve({ id: "project-1" }),
    });

    expect(response.status).toBe(401);
  });
});
```

- [ ] **Step 2: Write the failing success test**

```ts
it("duplicates the project, records activity, and revalidates project views", async () => {
  mocks.getAuthSession.mockResolvedValue({
    user: {
      id: "user-1",
    },
  });
  mocks.duplicateProject.mockResolvedValue({
    id: "project-copy",
    name: "Hospital Norte (copia)",
  });

  const response = await POST(new Request("http://localhost/api/projects/project-1/duplicate"), {
    params: Promise.resolve({ id: "project-1" }),
  });

  expect(response.status).toBe(201);
  expect(mocks.duplicateProject).toHaveBeenCalledWith("project-1", "user-1");
  expect(mocks.recordActivityEvent).toHaveBeenCalledWith({
    userId: "user-1",
    type: "PROJECT_CREATED",
    title: "Proyecto duplicado",
    detail: "Hospital Norte (copia)",
    href: "/projects/project-copy",
  });
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/projects");
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/projects/project-copy");
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/budgets");
});
```

- [ ] **Step 3: Run the route test to verify it fails**

Run: `npm run test -- app/api/projects/[id]/duplicate/route.test.ts`

Expected: FAIL because the route does not exist yet.

- [ ] **Step 4: Commit**

```bash
git add app/api/projects/[id]/duplicate/route.test.ts
git commit -m "test: cover duplicate project api route"
```

### Task 5: Implement the duplicate-project API route

**Files:**
- Create: `app/api/projects/[id]/duplicate/route.ts`
- Test: `app/api/projects/[id]/duplicate/route.test.ts`

- [ ] **Step 1: Add the route handler**

```ts
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthSession } from "@/lib/auth/session";
import { recordActivityEvent } from "@/lib/data/activity-events";
import { duplicateProject } from "@/lib/data/projects";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const project = await duplicateProject(id, session.user.id);

    await recordActivityEvent({
      userId: session.user.id,
      type: "PROJECT_CREATED",
      title: "Proyecto duplicado",
      detail: project.name,
      href: `/projects/${project.id}`,
    });

    revalidatePath("/dashboard");
    revalidatePath("/projects");
    revalidatePath(`/projects/${project.id}`);
    revalidatePath("/budgets");

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo duplicar el proyecto",
      },
      { status: 400 },
    );
  }
}
```

- [ ] **Step 2: Run the route test to verify it passes**

Run: `npm run test -- app/api/projects/[id]/duplicate/route.test.ts`

Expected: PASS

- [ ] **Step 3: Run the data-layer test suite again**

Run: `npm run test -- lib/data/projects.test.ts`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/api/projects/[id]/duplicate/route.ts app/api/projects/[id]/duplicate/route.test.ts
git commit -m "feat: expose duplicate project api route"
```

### Task 6: Add UI coverage for the new duplicate action

**Files:**
- Modify: `components/projects/projects-table.view-mode.test.tsx`
- Test: `components/projects/projects-table.view-mode.test.tsx`

- [ ] **Step 1: Write the failing UI test for the duplicate action**

```ts
it("shows a duplicate action for each project row", async () => {
  const { getActionTexts } = await renderProjectsTable();

  expect(getActionTexts()).toContain("Duplicar");
});
```

- [ ] **Step 2: Extend the test harness with a helper that reads action labels**

```ts
getActionTexts: () =>
  Array.from(nextContainer.querySelectorAll("button, a"))
    .map((element) => element.textContent?.trim() ?? "")
    .filter(Boolean),
```

- [ ] **Step 3: Run the component test to verify it fails**

Run: `npm run test -- components/projects/projects-table.view-mode.test.tsx`

Expected: FAIL because the action is not rendered yet.

- [ ] **Step 4: Commit**

```bash
git add components/projects/projects-table.view-mode.test.tsx
git commit -m "test: cover duplicate action in projects table"
```

### Task 7: Implement the duplicate action in the projects table

**Files:**
- Modify: `components/projects/projects-table.tsx`
- Test: `components/projects/projects-table.view-mode.test.tsx`

- [ ] **Step 1: Add the duplicate request handler**

```ts
async function duplicateProjectRow(id: string) {
  setPendingId(id);
  setError("");

  const response = await fetch(`/api/projects/${id}/duplicate`, {
    method: "POST",
  });

  setPendingId(null);

  if (!response.ok) {
    const data = await response.json();
    setError(data.error ?? "No se pudo duplicar el proyecto");
    return;
  }

  const duplicatedProject = (await response.json()) as ProjectRecord;

  setRows((current) => [
    {
      ...duplicatedProject,
      budgetsCount: 1,
    },
    ...current,
  ]);
  broadcastAppDataChange(["/dashboard", "/projects", "/budgets"], undefined, {
    locallyHandledPaths: ["/projects"],
  });
}
```

- [ ] **Step 2: Render the new action button in the row actions**

```tsx
<ActionButton
  action="copy"
  label="Duplicar"
  size="sm"
  variant="ghost"
  disabled={pendingId === project.id}
  onClick={() => duplicateProjectRow(project.id)}
/>
```

- [ ] **Step 3: Adjust the optimistic insert so the table stays usable**

```ts
setRows((current) => {
  const budgetsCount = current.find((row) => row.id === id)?.budgetsCount ?? 0;

  return [
    {
      ...duplicatedProject,
      budgetsCount,
    },
    ...current,
  ];
});
```

- [ ] **Step 4: Run the table test to verify it passes**

Run: `npm run test -- components/projects/projects-table.view-mode.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/projects/projects-table.tsx components/projects/projects-table.view-mode.test.tsx
git commit -m "feat: add duplicate project action to table"
```

### Task 8: Run final verification and sanity checks

**Files:**
- Modify: `docs/superpowers/plans/2026-05-19-project-duplication.md`

- [ ] **Step 1: Run the targeted test suites**

Run: `npm run test -- lib/data/projects.test.ts`
Expected: PASS

Run: `npm run test -- app/api/projects/[id]/duplicate/route.test.ts`
Expected: PASS

Run: `npm run test -- components/projects/projects-table.view-mode.test.tsx`
Expected: PASS

- [ ] **Step 2: Run lint for touched files**

Run: `npm run lint`

Expected: PASS or only pre-existing unrelated issues.

- [ ] **Step 3: Update the plan checklist as completed during execution**

```md
- [x] Step completed
```

- [ ] **Step 4: Commit**

```bash
git add lib/data/projects.ts lib/data/projects.test.ts app/api/projects/[id]/duplicate/route.ts app/api/projects/[id]/duplicate/route.test.ts components/projects/projects-table.tsx components/projects/projects-table.view-mode.test.tsx docs/superpowers/plans/2026-05-19-project-duplication.md
git commit -m "feat: support deep project duplication"
```
