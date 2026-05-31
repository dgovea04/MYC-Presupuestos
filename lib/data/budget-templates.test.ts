import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  budgetTemplateCreate: vi.fn(),
  budgetTemplateDeleteMany: vi.fn(),
  budgetTemplateFindFirst: vi.fn(),
  budgetTemplateFindMany: vi.fn(),
  budgetTemplateUpdate: vi.fn(),
  transaction: vi.fn(),
  projectFindFirst: vi.fn(),
  budgetCreate: vi.fn(),
  budgetFindFirst: vi.fn(),
  budgetLevelCreate: vi.fn(),
  budgetItemCreate: vi.fn(),
  apuCreate: vi.fn(),
  resourceFindFirst: vi.fn(),
  resourceCreate: vi.fn(),
  apuResourceCreate: vi.fn(),
  getBudgetById: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    budgetTemplate: {
      create: mocks.budgetTemplateCreate,
      deleteMany: mocks.budgetTemplateDeleteMany,
      findFirst: mocks.budgetTemplateFindFirst,
      findMany: mocks.budgetTemplateFindMany,
      update: mocks.budgetTemplateUpdate,
    },
  },
}));

vi.mock("@/lib/data/budgets", () => ({
  getBudgetById: mocks.getBudgetById,
}));

import {
  createUserBudgetTemplateFromBudget,
  applyUserBudgetTemplateToProject,
  deleteUserBudgetTemplate,
  duplicateUserBudgetTemplate,
  getUserBudgetTemplateById,
  listUserBudgetTemplates,
  updateUserBudgetTemplate,
} from "@/lib/data/budget-templates";
import type { BudgetRecord } from "@/types/budget";

describe("budget templates data service", () => {
  beforeEach(() => {
    mocks.budgetTemplateCreate.mockReset();
    mocks.budgetTemplateDeleteMany.mockReset();
    mocks.budgetTemplateFindFirst.mockReset();
    mocks.budgetTemplateFindMany.mockReset();
    mocks.budgetTemplateUpdate.mockReset();
    mocks.transaction.mockReset();
    mocks.projectFindFirst.mockReset();
    mocks.budgetCreate.mockReset();
    mocks.budgetFindFirst.mockReset();
    mocks.budgetLevelCreate.mockReset();
    mocks.budgetItemCreate.mockReset();
    mocks.apuCreate.mockReset();
    mocks.resourceFindFirst.mockReset();
    mocks.resourceCreate.mockReset();
    mocks.apuResourceCreate.mockReset();
    mocks.getBudgetById.mockReset();

    mocks.transaction.mockImplementation(async (callback: (tx: ReturnType<typeof createTx>) => Promise<unknown>) =>
      callback(createTx()),
    );
  });

  it("creates a user budget template snapshot from an accessible budget", async () => {
    mocks.getBudgetById.mockResolvedValue(createBudget());
    mocks.budgetTemplateCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "template-1",
      createdAt: new Date("2026-05-29T22:00:00.000Z"),
      updatedAt: new Date("2026-05-29T22:00:00.000Z"),
      ...data,
    }));

    const template = await createUserBudgetTemplateFromBudget("user-1", {
      budgetId: "budget-1",
      name: "Arquitectura reusable",
      description: "Base validada para proyectos similares.",
      capturedAt: "2026-05-29T22:00:00.000Z",
    });

    expect(mocks.getBudgetById).toHaveBeenCalledWith("budget-1", "user-1");
    expect(mocks.budgetTemplateCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        sourceProjectId: "project-1",
        sourceBudgetId: "budget-1",
        module: "BUDGET",
        name: "Arquitectura reusable",
        description: "Base validada para proyectos similares.",
      }),
    });
    expect(template.libraryItem).toMatchObject({
      id: "budget-template-template-1",
      name: "Arquitectura reusable",
      source: "USER",
      tags: ["Subpresupuesto", "PEN", "1 partidas"],
      actionLabel: "Ver plantilla",
    });
    expect(template.snapshot.source.capturedAt).toBe("2026-05-29T22:00:00.000Z");
  });

  it("rejects template creation when the source budget is not accessible", async () => {
    mocks.getBudgetById.mockResolvedValue(null);

    await expect(
      createUserBudgetTemplateFromBudget("user-1", {
        budgetId: "missing-budget",
        name: "No visible",
      }),
    ).rejects.toThrow("No se encontro el presupuesto para crear la plantilla");
    expect(mocks.budgetTemplateCreate).not.toHaveBeenCalled();
  });

  it("lists persisted budget templates as user library items", async () => {
    mocks.budgetTemplateFindMany.mockResolvedValue([
      {
        id: "template-1",
        userId: "user-1",
        sourceProjectId: "project-1",
        sourceBudgetId: "budget-1",
        module: "BUDGET",
        name: "Arquitectura reusable",
        description: "",
        payload: createSnapshotPayload(),
        createdAt: new Date("2026-05-29T22:00:00.000Z"),
        updatedAt: new Date("2026-05-29T23:00:00.000Z"),
      },
    ]);

    const templates = await listUserBudgetTemplates("user-1");

    expect(mocks.budgetTemplateFindMany).toHaveBeenCalledWith({
      where: { userId: "user-1", module: "BUDGET" },
      orderBy: { updatedAt: "desc" },
    });
    expect(templates).toEqual([
      expect.objectContaining({
        id: "template-1",
        libraryItem: expect.objectContaining({
          id: "budget-template-template-1",
          source: "USER",
          createdAt: "2026-05-29T22:00:00.000Z",
          updatedAt: "2026-05-29T23:00:00.000Z",
        }),
      }),
    ]);
  });

  it("gets one persisted budget template by owner", async () => {
    mocks.budgetTemplateFindFirst.mockResolvedValue({
      id: "template-1",
      userId: "user-1",
      sourceProjectId: "project-1",
      sourceBudgetId: "budget-1",
      module: "BUDGET",
      name: "Arquitectura reusable",
      description: "",
      payload: createSnapshotPayload(),
      createdAt: new Date("2026-05-29T22:00:00.000Z"),
      updatedAt: new Date("2026-05-29T23:00:00.000Z"),
    });

    const template = await getUserBudgetTemplateById("template-1", "user-1");

    expect(mocks.budgetTemplateFindFirst).toHaveBeenCalledWith({
      where: { id: "template-1", userId: "user-1", module: "BUDGET" },
    });
    expect(template?.libraryItem.id).toBe("budget-template-template-1");
  });

  it("deletes a persisted budget template by owner", async () => {
    mocks.budgetTemplateFindFirst.mockResolvedValue({
      id: "template-1",
      userId: "user-1",
      sourceProjectId: "project-1",
      sourceBudgetId: "budget-1",
      module: "BUDGET",
      name: "Arquitectura reusable",
      description: "",
      payload: createSnapshotPayload(),
      createdAt: new Date("2026-05-29T22:00:00.000Z"),
      updatedAt: new Date("2026-05-29T23:00:00.000Z"),
    });
    mocks.budgetTemplateDeleteMany.mockResolvedValue({ count: 1 });

    const deleted = await deleteUserBudgetTemplate("template-1", "user-1");

    expect(deleted).toMatchObject({ id: "template-1", name: "Arquitectura reusable" });
    expect(mocks.budgetTemplateFindFirst).toHaveBeenCalledWith({
      where: { id: "template-1", userId: "user-1", module: "BUDGET" },
    });
    expect(mocks.budgetTemplateDeleteMany).toHaveBeenCalledWith({
      where: { id: "template-1", userId: "user-1", module: "BUDGET" },
    });
  });

  it("rejects deleting a missing or inaccessible template", async () => {
    mocks.budgetTemplateFindFirst.mockResolvedValue(null);

    await expect(deleteUserBudgetTemplate("template-1", "user-1")).rejects.toThrow(
      "No se encontro la plantilla para eliminar",
    );
    expect(mocks.budgetTemplateDeleteMany).not.toHaveBeenCalled();
  });

  it("updates a persisted budget template and synchronizes its snapshot metadata", async () => {
    mocks.budgetTemplateFindFirst.mockResolvedValue({
      id: "template-1",
      userId: "user-1",
      sourceProjectId: "project-1",
      sourceBudgetId: "budget-1",
      module: "BUDGET",
      name: "Arquitectura reusable",
      description: "",
      payload: createSnapshotPayload(),
      createdAt: new Date("2026-05-29T22:00:00.000Z"),
      updatedAt: new Date("2026-05-29T23:00:00.000Z"),
    });
    mocks.budgetTemplateUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "template-1",
      userId: "user-1",
      sourceProjectId: "project-1",
      sourceBudgetId: "budget-1",
      module: "BUDGET",
      createdAt: new Date("2026-05-29T22:00:00.000Z"),
      updatedAt: new Date("2026-05-30T01:00:00.000Z"),
      ...data,
    }));

    const template = await updateUserBudgetTemplate("template-1", "user-1", {
      name: "Arquitectura costa",
      description: "Base ajustada para obras urbanas.",
    });

    expect(mocks.budgetTemplateUpdate).toHaveBeenCalledWith({
      where: { id: "template-1" },
      data: expect.objectContaining({
        name: "Arquitectura costa",
        description: "Base ajustada para obras urbanas.",
      }),
    });
    expect(template.name).toBe("Arquitectura costa");
    expect(template.snapshot.name).toBe("Arquitectura costa");
    expect(template.libraryItem.name).toBe("Arquitectura costa");
  });

  it("duplicates a persisted budget template and synchronizes copied snapshot metadata", async () => {
    mocks.budgetTemplateFindFirst.mockResolvedValue({
      id: "template-1",
      userId: "user-1",
      sourceProjectId: "project-1",
      sourceBudgetId: "budget-1",
      module: "BUDGET",
      name: "Arquitectura reusable",
      description: "Base inicial",
      payload: createSnapshotPayload(),
      createdAt: new Date("2026-05-29T22:00:00.000Z"),
      updatedAt: new Date("2026-05-29T23:00:00.000Z"),
    });
    mocks.budgetTemplateCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "template-copy",
      createdAt: new Date("2026-05-30T10:00:00.000Z"),
      updatedAt: new Date("2026-05-30T10:00:00.000Z"),
      ...data,
    }));

    const template = await duplicateUserBudgetTemplate("template-1", "user-1", {
      name: "Arquitectura reusable copia",
    });

    expect(mocks.budgetTemplateCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        sourceProjectId: "project-1",
        sourceBudgetId: "budget-1",
        module: "BUDGET",
        name: "Arquitectura reusable copia",
        description: "Base inicial",
      }),
    });
    expect(template.id).toBe("template-copy");
    expect(template.snapshot.name).toBe("Arquitectura reusable copia");
    expect(template.libraryItem.id).toBe("budget-template-template-copy");
  });

  it("applies a saved template to a project with levels, items, APU, and reusable resources", async () => {
    mocks.budgetTemplateFindFirst.mockResolvedValue({
      id: "template-1",
      userId: "user-1",
      sourceProjectId: "project-1",
      sourceBudgetId: "budget-1",
      module: "BUDGET",
      name: "Arquitectura reusable",
      description: "",
      payload: createSnapshotPayload({ withApu: true }),
      createdAt: new Date("2026-05-29T22:00:00.000Z"),
      updatedAt: new Date("2026-05-29T23:00:00.000Z"),
    });
    mocks.projectFindFirst.mockResolvedValue({ id: "target-project", companyId: "company-1" });
    mocks.budgetFindFirst.mockResolvedValue({ id: "general-budget" });
    mocks.budgetCreate.mockResolvedValue({ id: "created-budget" });
    mocks.budgetLevelCreate.mockResolvedValue({ id: "created-level" });
    mocks.budgetItemCreate.mockResolvedValue({ id: "created-item" });
    mocks.apuCreate.mockResolvedValue({ id: "created-apu" });
    mocks.resourceFindFirst.mockResolvedValue(null);
    mocks.resourceCreate.mockResolvedValue({ id: "created-resource" });

    const result = await applyUserBudgetTemplateToProject("template-1", "user-1", {
      projectId: "target-project",
      name: "Arquitectura aplicada",
    });

    expect(result).toEqual({
      id: "created-budget",
      projectId: "target-project",
      name: "Arquitectura aplicada",
      templateName: "Arquitectura reusable",
    });
    expect(mocks.projectFindFirst).toHaveBeenCalledWith({
      where: { id: "target-project", company: { userId: "user-1" } },
      select: { id: true, companyId: true },
    });
    expect(mocks.budgetCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: "target-project",
        parentBudgetId: "general-budget",
        kind: "SUB_BUDGET",
        name: "Arquitectura aplicada",
      }),
      select: { id: true },
    });
    expect(mocks.budgetLevelCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ budgetId: "created-budget", parentId: null, code: "01" }),
      select: { id: true },
    });
    expect(mocks.budgetItemCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ budgetId: "created-budget", levelId: "created-level", code: "01.01" }),
      select: { id: true },
    });
    expect(mocks.resourceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ companyId: "company-1", code: "MO-001", description: "Operario" }),
      select: { id: true },
    });
    expect(mocks.apuResourceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ apuId: "created-apu", resourceId: "created-resource", resourceType: "LABOR" }),
    });
  });
});

function createTx() {
  return {
    project: { findFirst: mocks.projectFindFirst },
    budget: { create: mocks.budgetCreate, findFirst: mocks.budgetFindFirst },
    budgetLevel: { create: mocks.budgetLevelCreate },
    budgetItem: { create: mocks.budgetItemCreate },
    apu: { create: mocks.apuCreate },
    resource: { findFirst: mocks.resourceFindFirst, create: mocks.resourceCreate },
    apuResource: { create: mocks.apuResourceCreate },
  };
}

function createBudget(): BudgetRecord {
  return {
    id: "budget-1",
    projectId: "project-1",
    parentBudgetId: null,
    kind: "SUB_BUDGET",
    name: "Arquitectura",
    currency: "PEN",
    igvRate: 0.18,
    generalExpensesRate: 0.1,
    utilityRate: 0.08,
    totalDirectCost: 0,
    totalGeneralExpenses: 0,
    totalUtility: 0,
    totalTax: 0,
    totalAmount: 0,
    levels: [
      {
        id: "level-1",
        budgetId: "budget-1",
        parentId: null,
        type: "TITLE",
        code: "01",
        name: "Arquitectura",
        sortOrder: 1,
      },
    ],
    items: [
      {
        id: "item-1",
        budgetId: "budget-1",
        levelId: "level-1",
        code: "01.01",
        description: "Muro de ladrillo",
        unit: "m2",
        quantity: 10,
        unitPrice: 95,
        partial: 0,
        sortOrder: 1,
      },
    ],
  };
}

function createSnapshotPayload(options: { withApu?: boolean } = {}) {
  return {
    schemaVersion: 1,
    name: "Arquitectura reusable",
    description: "",
    source: {
      budgetId: "budget-1",
      projectId: "project-1",
      budgetName: "Arquitectura",
      capturedAt: "2026-05-29T22:00:00.000Z",
    },
    budget: {
      kind: "SUB_BUDGET",
      currency: "PEN",
      igvRate: 0.18,
      generalExpensesRate: 0.1,
      utilityRate: 0.08,
      totalDirectCost: 950,
      totalGeneralExpenses: 95,
      totalUtility: 76,
      totalTax: 201.78,
      totalAmount: 1322.78,
    },
    levels: [
      {
        templateKey: "level-001",
        sourceLevelId: "level-1",
        parentKey: null,
        type: "TITLE",
        code: "01",
        name: "Arquitectura",
        sortOrder: 1,
      },
    ],
    items: [
      {
        templateKey: "item-001",
        sourceItemId: "item-1",
        levelKey: "level-001",
        code: "01.01",
        description: "Muro de ladrillo",
        unit: "m2",
        quantity: 10,
        unitPrice: 95,
        partial: 950,
        sortOrder: 1,
        apu: options.withApu
          ? {
              name: "Muro de ladrillo",
              unit: "m2",
              performance: 12,
              totalUnitCost: 95,
              resources: [
                {
                  resourceType: "LABOR",
                  crew: 1,
                  quantity: 0.5,
                  unitPrice: 18.5,
                  subtotal: 9.25,
                  resource: {
                    code: "MO-001",
                    description: "Operario",
                    category: "LABOR",
                    iu: null,
                    subcategory: null,
                    unit: "hh",
                    unitPrice: 18.5,
                    currency: "PEN",
                    source: null,
                  },
                },
              ],
            }
          : null,
      },
    ],
    summary: {
      levelCount: 1,
      itemCount: 1,
      apuCount: 0,
      currency: "PEN",
      totalDirectCost: 950,
      totalAmount: 1322.78,
    },
  };
}
