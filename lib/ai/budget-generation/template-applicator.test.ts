import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  budgetFindFirst: vi.fn(),
  budgetFindMany: vi.fn(),
  budgetUpdate: vi.fn(),
  budgetLevelFindFirst: vi.fn(),
  budgetLevelCreate: vi.fn(),
  budgetItemCreate: vi.fn(),
  budgetItemAggregate: vi.fn(),
  apuCreate: vi.fn(),
  resourceFindFirst: vi.fn(),
  resourceCreate: vi.fn(),
  apuResourceCreate: vi.fn(),
  projectFindFirst: vi.fn(),
  getUserBudgetTemplateById: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/data/budget-templates", () => ({
  getUserBudgetTemplateById: mocks.getUserBudgetTemplateById,
}));

// ─── Import after mocks ─────────────────────────────────────────────────────

import { applyTemplateToSubBudget } from "./template-applicator";

// ─── Helpers ────────────────────────────────────────────────────────────────

function createTx() {
  return {
    budget: {
      findFirst: mocks.budgetFindFirst,
      findMany: mocks.budgetFindMany,
      update: mocks.budgetUpdate,
    },
    budgetLevel: {
      findFirst: mocks.budgetLevelFindFirst,
      create: mocks.budgetLevelCreate,
    },
    budgetItem: {
      create: mocks.budgetItemCreate,
      aggregate: mocks.budgetItemAggregate,
    },
    apu: { create: mocks.apuCreate },
    resource: {
      findFirst: mocks.resourceFindFirst,
      create: mocks.resourceCreate,
    },
    apuResource: { create: mocks.apuResourceCreate },
    project: { findFirst: mocks.projectFindFirst },
  };
}

function makeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: (overrides.id as string) ?? "tpl-1",
    userId: "user-1",
    sourceProjectId: "proj-src",
    sourceBudgetId: "budget-src",
    name: (overrides.name as string) ?? "Plantilla de prueba",
    description: "",
    snapshot: (overrides.snapshot as Record<string, unknown>) ?? makeSnapshot(),
    libraryItem: {
      id: "li-1",
      name: "Plantilla de prueba",
      module: "BUDGET" as const,
      description: "",
      source: "USER" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      tags: [],
      actionLabel: "Ver",
      badge: undefined,
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    name: "Arquitectura",
    description: "",
    source: {
      budgetId: "budget-src",
      projectId: "proj-src",
      budgetName: "Arquitectura",
      capturedAt: "2026-01-01T00:00:00.000Z",
    },
    budget: {
      kind: "SUB_BUDGET",
      currency: "PEN",
      igvRate: 0.18,
      generalExpensesRate: 0.1,
      utilityRate: 0.08,
      totalDirectCost: 1000,
      totalGeneralExpenses: 100,
      totalUtility: 80,
      totalTax: 212.4,
      totalAmount: 1392.4,
    },
    levels: (overrides.levels as Array<Record<string, unknown>>) ?? [
      {
        templateKey: "level-001",
        sourceLevelId: "lvl-1",
        parentKey: null,
        type: "TITLE",
        code: "01",
        name: "Arquitectura",
        sortOrder: 1,
      },
    ],
    items: (overrides.items as Array<Record<string, unknown>>) ?? [
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
        apu: null,
      },
    ],
    summary: {
      levelCount: 1,
      itemCount: 1,
      apuCount: 0,
      currency: "PEN",
      totalDirectCost: 1000,
      totalAmount: 1392.4,
    },
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("applyTemplateToSubBudget", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: transaction passes through the callback
    mocks.transaction.mockImplementation(
      async (callback: (tx: ReturnType<typeof createTx>) => Promise<unknown>) =>
        callback(createTx()),
    );

    // Default successful budget lookup
    mocks.budgetFindFirst.mockResolvedValue({
      id: "target-budget",
      generalExpensesRate: 0.1,
      utilityRate: 0.08,
      igvRate: 0.18,
    });

    // Default project lookup
    mocks.projectFindFirst.mockResolvedValue({ companyId: "company-1" });

    // Default level creation
    mocks.budgetLevelFindFirst.mockResolvedValue(null); // no existing level
    mocks.budgetLevelCreate.mockResolvedValue({ id: "created-level" });

    // Default item creation
    mocks.budgetItemCreate.mockResolvedValue({ id: "created-item" });

    // Default aggregate returns items
    mocks.budgetItemAggregate.mockResolvedValue({ _sum: { partial: 950 } });

    // Default budget update (for totals)
    mocks.budgetUpdate.mockResolvedValue({});

    // Default child budget list for parent refresh
    mocks.budgetFindMany.mockResolvedValue([]);
  });

  it("throws when template is not found", async () => {
    mocks.getUserBudgetTemplateById.mockResolvedValue(null);

    await expect(
      applyTemplateToSubBudget({
        templateId: "tpl-missing",
        projectId: "proj-1",
        targetSubBudgetName: "Arquitectura",
        userId: "user-1",
      }),
    ).rejects.toThrow("No se encontró la plantilla");
  });

  it("throws when target sub-budget is not found", async () => {
    mocks.getUserBudgetTemplateById.mockResolvedValue(makeTemplate());
    mocks.budgetFindFirst.mockResolvedValue(null); // no target budget found

    await expect(
      applyTemplateToSubBudget({
        templateId: "tpl-1",
        projectId: "proj-1",
        targetSubBudgetName: "Inexistente",
        userId: "user-1",
      }),
    ).rejects.toThrow("No se encontró el sub-presupuesto");
  });

  it("applies template items to an existing sub-budget", async () => {
    mocks.getUserBudgetTemplateById.mockResolvedValue(makeTemplate());

    const result = await applyTemplateToSubBudget({
      templateId: "tpl-1",
      projectId: "proj-1",
      targetSubBudgetName: "Arquitectura",
      userId: "user-1",
    });

    expect(result).toMatchObject({
      id: "target-budget",
      projectId: "proj-1",
      name: "Arquitectura",
      templateName: "Plantilla de prueba",
    });
    expect(result.itemsAdded).toBeGreaterThan(0);
    expect(result.errors).toEqual([]);
  });

  it("creates levels from template in the target budget", async () => {
    mocks.getUserBudgetTemplateById.mockResolvedValue(makeTemplate());

    await applyTemplateToSubBudget({
      templateId: "tpl-1",
      projectId: "proj-1",
      targetSubBudgetName: "Arquitectura",
      userId: "user-1",
    });

    expect(mocks.budgetLevelCreate).toHaveBeenCalled();
    const createCall = mocks.budgetLevelCreate.mock.calls[0][0];
    expect(createCall.data.budgetId).toBe("target-budget");
    expect(createCall.data.type).toBe("TITLE");
  });

  it("reuses existing levels when code matches", async () => {
    mocks.getUserBudgetTemplateById.mockResolvedValue(makeTemplate());
    mocks.budgetLevelFindFirst.mockResolvedValue({ id: "existing-level" });

    await applyTemplateToSubBudget({
      templateId: "tpl-1",
      projectId: "proj-1",
      targetSubBudgetName: "Arquitectura",
      userId: "user-1",
    });

    // Should not create new level since one exists
    expect(mocks.budgetLevelCreate).not.toHaveBeenCalled();
  });

  it("creates budget items under the target sub-budget", async () => {
    mocks.getUserBudgetTemplateById.mockResolvedValue(makeTemplate());

    await applyTemplateToSubBudget({
      templateId: "tpl-1",
      projectId: "proj-1",
      targetSubBudgetName: "Arquitectura",
      userId: "user-1",
    });

    expect(mocks.budgetItemCreate).toHaveBeenCalled();
    const createCall = mocks.budgetItemCreate.mock.calls[0][0];
    expect(createCall.data.budgetId).toBe("target-budget");
    expect(createCall.data.unit).toBe("m2");
  });

  it("creates APUs and resources when template items have APUs", async () => {
    const snapshot = makeSnapshot({
      items: [
        {
          templateKey: "item-001",
          sourceItemId: "item-1",
          levelKey: "level-001",
          code: "01.01",
          description: "Muro de ladrillo con APU",
          unit: "m2",
          quantity: 10,
          unitPrice: 95,
          partial: 950,
          sortOrder: 1,
          apu: {
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
                  category: "LABOR" as const,
                  iu: null,
                  iuCurrent: null,
                  subcategory: null,
                  unit: "hh",
                  unitPrice: 18.5,
                  currency: "PEN",
                  source: null,
                },
              },
            ],
          },
        },
      ],
    });

    mocks.getUserBudgetTemplateById.mockResolvedValue(makeTemplate({ snapshot }));
    // Resource doesn't exist yet → create it
    mocks.resourceFindFirst.mockResolvedValue(null);
    mocks.resourceCreate.mockResolvedValue({ id: "created-resource" });
    mocks.apuCreate.mockResolvedValue({ id: "created-apu" });

    await applyTemplateToSubBudget({
      templateId: "tpl-1",
      projectId: "proj-1",
      targetSubBudgetName: "Arquitectura",
      userId: "user-1",
    });

    expect(mocks.apuCreate).toHaveBeenCalled();
    expect(mocks.resourceFindFirst).toHaveBeenCalled();
    expect(mocks.resourceCreate).toHaveBeenCalled();
    expect(mocks.apuResourceCreate).toHaveBeenCalled();
  });

  it("reuses existing resources instead of creating duplicates", async () => {
    const snapshot = makeSnapshot({
      items: [
        {
          templateKey: "item-001",
          sourceItemId: "item-1",
          levelKey: "level-001",
          code: "01.01",
          description: "Item con recurso existente",
          unit: "m2",
          quantity: 10,
          unitPrice: 95,
          partial: 950,
          sortOrder: 1,
          apu: {
            name: "Item con recurso",
            unit: "m2",
            performance: 12,
            totalUnitCost: 95,
            resources: [
              {
                resourceType: "MATERIAL",
                crew: null,
                quantity: 1,
                unitPrice: 50,
                subtotal: 50,
                resource: {
                  code: "MAT-001",
                  description: "Cemento",
                  category: "MATERIAL" as const,
                  iu: null,
                  iuCurrent: null,
                  subcategory: null,
                  unit: "bol",
                  unitPrice: 50,
                  currency: "PEN",
                  source: null,
                },
              },
            ],
          },
        },
      ],
    });

    mocks.getUserBudgetTemplateById.mockResolvedValue(makeTemplate({ snapshot }));
    // Resource already exists
    mocks.resourceFindFirst.mockResolvedValue({ id: "existing-resource" });
    mocks.apuCreate.mockResolvedValue({ id: "created-apu" });

    await applyTemplateToSubBudget({
      templateId: "tpl-1",
      projectId: "proj-1",
      targetSubBudgetName: "Arquitectura",
      userId: "user-1",
    });

    expect(mocks.resourceFindFirst).toHaveBeenCalled();
    expect(mocks.resourceCreate).not.toHaveBeenCalled(); // reuses existing
    expect(mocks.apuResourceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ resourceId: "existing-resource" }),
      }),
    );
  });

  it("recalculates target sub-budget totals after adding items", async () => {
    mocks.getUserBudgetTemplateById.mockResolvedValue(makeTemplate());
    mocks.budgetItemAggregate.mockResolvedValue({ _sum: { partial: 1950 } }); // old + new

    await applyTemplateToSubBudget({
      templateId: "tpl-1",
      projectId: "proj-1",
      targetSubBudgetName: "Arquitectura",
      userId: "user-1",
    });

    // Should update target budget with new totals
    expect(mocks.budgetUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "target-budget" },
        data: expect.objectContaining({
          totalDirectCost: 1950,
        }),
      }),
    );
  });

  it("recalculates parent general budget totals", async () => {
    mocks.getUserBudgetTemplateById.mockResolvedValue(makeTemplate());

    // Mock parent budget exists
    mocks.budgetFindFirst
      .mockResolvedValueOnce({ id: "target-budget", generalExpensesRate: 0.1, utilityRate: 0.08, igvRate: 0.18 }) // first call: target budget
      .mockResolvedValueOnce({ id: "parent-budget" }); // second call: find parent

    // Mock child budgets for parent recalculation
    mocks.budgetFindMany.mockResolvedValue([
      { totalDirectCost: 1950, totalGeneralExpenses: 195, totalUtility: 156, totalTax: 414.18, totalAmount: 2715.18 },
    ]);

    await applyTemplateToSubBudget({
      templateId: "tpl-1",
      projectId: "proj-1",
      targetSubBudgetName: "Arquitectura",
      userId: "user-1",
    });

    // Parent budget should be updated with consolidated totals
    const updateCalls = mocks.budgetUpdate.mock.calls;
    const parentUpdate = updateCalls.find(
      (call: Array<Record<string, unknown>>) => call[0].where.id === "parent-budget",
    );
    expect(parentUpdate).toBeDefined();
  });

  it("uses the correct target sub-budget name in where clause", async () => {
    mocks.getUserBudgetTemplateById.mockResolvedValue(makeTemplate());

    await applyTemplateToSubBudget({
      templateId: "tpl-1",
      projectId: "proj-1",
      targetSubBudgetName: "Estructuras",
      userId: "user-1",
    });

    expect(mocks.budgetFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: "Estructuras",
          kind: "SUB_BUDGET",
        }),
      }),
    );
  });

  it("throws when project is not found", async () => {
    mocks.getUserBudgetTemplateById.mockResolvedValue(makeTemplate());
    mocks.projectFindFirst.mockResolvedValue(null); // project not found

    await expect(
      applyTemplateToSubBudget({
        templateId: "tpl-1",
        projectId: "proj-missing",
        targetSubBudgetName: "Arquitectura",
        userId: "user-1",
      }),
    ).rejects.toThrow("Proyecto no encontrado");
  });

  it("handles APU creation errors gracefully without failing the whole operation", async () => {
    const snapshot = makeSnapshot({
      items: [
        {
          templateKey: "item-001",
          sourceItemId: "item-1",
          levelKey: "level-001",
          code: "01.01",
          description: "Item con APU que falla",
          unit: "m2",
          quantity: 10,
          unitPrice: 95,
          partial: 950,
          sortOrder: 1,
          apu: {
            name: "APU que falla",
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
                resource: null, // missing resource → should skip gracefully
              },
            ],
          },
        },
      ],
    });

    mocks.getUserBudgetTemplateById.mockResolvedValue(makeTemplate({ snapshot }));
    mocks.apuCreate.mockRejectedValue(new Error("APU creation failed"));

    const result = await applyTemplateToSubBudget({
      templateId: "tpl-1",
      projectId: "proj-1",
      targetSubBudgetName: "Arquitectura",
      userId: "user-1",
    });

    // Should still succeed with errors captured
    expect(result.itemsAdded).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Error al crear APU");
  });
});
