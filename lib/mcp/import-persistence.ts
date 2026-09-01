import { randomUUID } from "node:crypto";
import { Prisma, PolynomialCostGroup } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { assertWithinPlanLimit } from "@/lib/billing/entitlements";
import { assertWorkspaceMembership } from "@/lib/workspace/access";
import type { McpManifest } from "./types";
import type { McpImportPersistenceResult, McpImportPersistenceOptions } from "./types";

type PersistenceContext = {
  tx: Prisma.TransactionClient;
  manifest: McpManifest;
  readModule: (path: string) => unknown;
  levelIdMap: Map<string, string>;
  budgetItemIdMap: Map<string, string>;
  apuResourceIdMap: Map<string, string>;
  resourceIdMap: Map<string, string>;
  budgetIdMap: Map<string, string>;
};

type McpApuModule = {
  apus: Array<{
    id: string;
    budgetItemId: string;
    name: string;
    unit: string;
    performance: string | number;
    totalUnitCost: string | number;
    resources: Array<{
      id: string;
      resourceId: string | null;
      resourceType: string;
      crew: string | number | null;
      quantity: string | number;
      unitPrice: string | number;
      subtotal: string | number;
      resourceDescription: string | null;
    }>;
  }>;
};

type McpApuResource = McpApuModule["apus"][number]["resources"][number];

type McpFooterModule = {
  footers: Array<{
    budgetId: string;
    rows: Array<{
      variable: string;
      description: string;
      formula: string | null;
      manualValue: string | number;
      iu: string | null;
      highlight: boolean;
      sortOrder: number;
    }>;
  }>;
};

type McpBudgetItemsModule = {
  budgets: Array<{
    budgetId: string;
    budgetName: string;
    levels: Array<{
      id: string;
      parentId: string | null;
      type: string;
      code: string;
      name: string;
      sortOrder: number;
    }>;
    items: Array<{
      id: string;
      levelId: string | null;
      code: string;
      description: string;
      unit: string;
      quantity: string;
      unitPrice: string;
      partial: string;
      sortOrder: number;
    }>;
  }>;
};

type McpProjectResourcesModule = {
  resources: Array<{
    id: string;
    code: string;
    description: string;
    category: string;
    unit: string;
    currency: string;
    unitPrice: string | number;
    iu: string | null;
    iuCurrent: string | null;
  }>;
};

const importTransactionOptions = {
  maxWait: 10_000,
  timeout: 120_000,
};

export async function importProjectPackageToMyc(
  userId: string,
  manifest: McpManifest,
  readModule: (path: string) => unknown,
  options: McpImportPersistenceOptions,
): Promise<McpImportPersistenceResult> {
  await assertWorkspaceMembership({ userId, companyId: options.companyId, minimumRole: "EDITOR" });
  await assertWithinPlanLimit({ userId, resource: "projects" });
  await assertWithinPlanLimit({ userId, resource: "budgets" });

  const warnings: string[] = [];

  const transactionResult = await prisma.$transaction(async (tx) => {
    const ctx: PersistenceContext = {
      tx,
      manifest,
      readModule,
      levelIdMap: new Map(),
      budgetItemIdMap: new Map(),
      apuResourceIdMap: new Map(),
      resourceIdMap: new Map(),
      budgetIdMap: new Map(),
    };

    // Read core project data
    const projectData = readModule("project.json") as {
      name: string;
      clientName: string | null;
      location: string | null;
      projectType: string | null;
      startDate: string | null;
      endDate: string | null;
      currency: string;
    };

    // Read budget tree
    const budgetTree = readModule("budgets/budget-tree.json") as {
      budgets: Array<{
        id: string;
        parentBudgetId: string | null;
        kind: string;
        name: string;
        currency: string;
        igvRate: string;
        generalExpensesRate: string;
        utilityRate: string;
        totalDirectCost: string;
        totalGeneralExpenses: string;
        totalUtility: string;
        totalTax: string;
        totalAmount: string;
      }>;
    };

    // Create project
    const projectOverrides = options.projectOverrides;

    const project = await tx.project.create({
      data: {
        companyId: options.companyId,
        name: projectOverrides?.name ?? projectData.name,
        clientName:
          projectOverrides && "clientName" in projectOverrides
            ? projectOverrides.clientName
            : projectData.clientName,
        location:
          projectOverrides && "location" in projectOverrides
            ? projectOverrides.location
            : projectData.location,
        projectType:
          projectOverrides && "projectType" in projectOverrides
            ? projectOverrides.projectType ?? "Importado .mcp"
            : projectData.projectType ?? "Importado .mcp",
        startDate: projectData.startDate ? new Date(projectData.startDate) : null,
        endDate: projectData.endDate ? new Date(projectData.endDate) : null,
        status: "PLANNING",
        isDemo: projectOverrides?.isDemo ?? false,
        demoKey: projectOverrides?.demoKey ?? null,
      },
    });

    // Create budgets
    const generalBudgetNode = budgetTree.budgets.find((budget) => budget.kind === "GENERAL");
    if (!generalBudgetNode) {
      throw new Error("El paquete .mcp no contiene un presupuesto general.");
    }

    const generalBudget = await tx.budget.create({
      data: {
        projectId: project.id,
        kind: "GENERAL",
        name: generalBudgetNode.name,
        currency: generalBudgetNode.currency,
        igvRate: generalBudgetNode.igvRate,
        generalExpensesRate: generalBudgetNode.generalExpensesRate,
        utilityRate: generalBudgetNode.utilityRate,
        totalDirectCost: generalBudgetNode.totalDirectCost,
        totalGeneralExpenses: generalBudgetNode.totalGeneralExpenses,
        totalUtility: generalBudgetNode.totalUtility,
        totalTax: generalBudgetNode.totalTax,
        totalAmount: generalBudgetNode.totalAmount,
      },
    });

    ctx.budgetIdMap.set(generalBudgetNode.id, generalBudget.id);

    // Import footer rows for general budget if available
    await persistFooterRows(ctx, generalBudgetNode.id, generalBudget.id);

    // Create sub-budgets with content
    const subBudgetIds: string[] = [];
    let totalItemCount = 0;
    let totalApuCount = 0;

    // Read budget items data
    let budgetItemsData: McpBudgetItemsModule | null = null;

    try {
      budgetItemsData = readModule("budgets/budget-items.json") as McpBudgetItemsModule;
    } catch {
      warnings.push("No se pudieron leer los items del presupuesto.");
    }

    // Read APUs data
    let apusData: McpApuModule | null = null;

    try {
      apusData = readModule("budgets/apus.json") as McpApuModule;
    } catch {
      warnings.push("No se pudieron leer los APUs del presupuesto.");
    }

    const apuById = new Map(
      (apusData?.apus ?? []).map((apu) => [apu.budgetItemId, apu] as const),
    );

    await persistProjectResources(ctx, options.companyId, apusData?.apus ?? [], warnings);

    // Build items-by-budget lookup
    const itemsByBudgetId = new Map<string, McpBudgetItemsModule["budgets"][number]>();
    if (budgetItemsData) {
      for (const budgetItems of budgetItemsData.budgets) {
        itemsByBudgetId.set(budgetItems.budgetId, budgetItems);
      }
    }

    for (const budgetNode of budgetTree.budgets.filter((entry) => entry.kind === "SUB_BUDGET")) {
      const createData = createBudgetCreateData(budgetNode, project.id, generalBudget.id);
      const subBudget = await tx.budget.create({ data: createData });
      ctx.budgetIdMap.set(budgetNode.id, subBudget.id);
      subBudgetIds.push(subBudget.id);

      const budgetItems = itemsByBudgetId.get(budgetNode.id);
      if (budgetItems) {
        const counts = await persistBudgetStructure(ctx, budgetItems, subBudget.id, apuById);
        totalItemCount += counts.itemCount;
        totalApuCount += counts.apuCount;
      }

      // Import footer rows
      await persistFooterRows(ctx, budgetNode.id, subBudget.id);
    }

    // Import polynomial formula if present
    try {
      const formulaModule = readModule("polynomial-formula/formula.json") as { formula: Record<string, unknown> | null } | null;
      if (formulaModule?.formula) {
        const formula = formulaModule.formula as {
          name: string;
          baseMonth: number;
          baseYear: number;
          totalBaseAmount: string;
          status: string;
          monomials: Array<{
            code: string;
            name: string;
            costGroupKey: string;
            amount: string;
            coefficient: string;
            baseIndexCode: string;
            baseIndexName: string;
            baseIndexValue: string;
            adjustmentIndexCode: string | null;
            adjustmentIndexName: string | null;
            adjustmentIndexValue: string | null;
            sortOrder: number;
            components: Array<{
              budgetItemId: string | null;
              apuResourceId: string | null;
              resourceType: string | null;
              amount: string;
            }>;
          }>;
        };

        const createdFormula = await tx.polynomialFormula.create({
          data: {
            projectId: project.id,
            budgetId: generalBudget.id,
            name: formula.name,
            baseMonth: formula.baseMonth,
            baseYear: formula.baseYear,
            totalBaseAmount: formula.totalBaseAmount,
            status: (formula.status as "DRAFT" | "VALID" | "ARCHIVED") ?? "DRAFT",
          },
        });

        for (const monomial of formula.monomials) {
          const createdMonomial = await tx.polynomialMonomial.create({
            data: {
              formulaId: createdFormula.id,
              code: monomial.code,
              name: monomial.name,
              costGroupKey: monomial.costGroupKey as unknown as PolynomialCostGroup,
              amount: monomial.amount,
              coefficient: monomial.coefficient,
              baseIndexCode: monomial.baseIndexCode,
              baseIndexName: monomial.baseIndexName,
              baseIndexValue: monomial.baseIndexValue,
              adjustmentIndexCode: monomial.adjustmentIndexCode,
              adjustmentIndexName: monomial.adjustmentIndexName,
              adjustmentIndexValue: monomial.adjustmentIndexValue,
              sortOrder: monomial.sortOrder,
            },
          });

          for (const component of monomial.components) {
            await tx.polynomialMonomialComponent.create({
              data: {
                monomialId: createdMonomial.id,
                budgetItemId: component.budgetItemId
                  ? ctx.budgetItemIdMap.get(component.budgetItemId) ?? null
                  : null,
                apuResourceId: component.apuResourceId
                  ? ctx.apuResourceIdMap.get(component.apuResourceId) ?? null
                  : null,
                resourceType: component.resourceType,
                amount: component.amount,
              },
            });
          }
        }
      }
    } catch {
      warnings.push("No se pudo restaurar la formula polinomica.");
    }

    return {
      projectId: project.id,
      projectName: project.name,
      generalBudgetId: generalBudget.id,
      subBudgetIds,
      budgetCount: 1 + subBudgetIds.length,
      itemCount: totalItemCount,
      apuCount: totalApuCount,
      resourceCount: 0,
      warnings,
    };
  }, importTransactionOptions);

  return transactionResult;
}

function createBudgetCreateData(
  budget: {
    kind: string;
    name: string;
    currency: string;
    igvRate: string;
    generalExpensesRate: string;
    utilityRate: string;
    totalDirectCost: string;
    totalGeneralExpenses: string;
    totalUtility: string;
    totalTax: string;
    totalAmount: string;
  },
  projectId: string,
  parentBudgetId: string | null,
) {
  return {
    projectId,
    parentBudgetId,
    kind: budget.kind as "GENERAL" | "SUB_BUDGET",
    name: budget.name,
    currency: budget.currency,
    igvRate: budget.igvRate,
    generalExpensesRate: budget.generalExpensesRate,
    utilityRate: budget.utilityRate,
    totalDirectCost: budget.totalDirectCost,
    totalGeneralExpenses: budget.totalGeneralExpenses,
    totalUtility: budget.totalUtility,
    totalTax: budget.totalTax,
    totalAmount: budget.totalAmount,
  };
}

async function persistBudgetStructure(
  ctx: PersistenceContext,
  budgetData: {
    levels: Array<{
      id: string;
      parentId: string | null;
      type: string;
      code: string;
      name: string;
      sortOrder: number;
    }>;
    items: Array<{
      id: string;
      levelId: string | null;
      code: string;
      description: string;
      unit: string;
      quantity: string;
      unitPrice: string;
      partial: string;
      sortOrder: number;
    }>;
  },
  persistedBudgetId: string,
  apuById: Map<string, {
    id: string;
    name: string;
    unit: string;
    performance: string | number;
    totalUnitCost: string | number;
    resources: Array<{
      id: string;
      resourceId: string | null;
      resourceType: string;
      crew: string | number | null;
      quantity: string | number;
      unitPrice: string | number;
      subtotal: string | number;
      resourceDescription: string | null;
    }>;
  }>,
) {
  const { tx, levelIdMap, budgetItemIdMap, apuResourceIdMap, resourceIdMap } = ctx;

  // Create levels — handle out-of-order parent-child relationships
  // by re-queuing levels whose parent hasn't been created yet
  let pendingLevels = [...budgetData.levels];

  while (pendingLevels.length > 0) {
    const nextPendingLevels: typeof pendingLevels = [];
    let createdLevels = 0;

    for (const level of pendingLevels) {
      if (level.parentId && !levelIdMap.has(level.parentId)) {
        nextPendingLevels.push(level);
        continue;
      }

      const createdLevel = await tx.budgetLevel.create({
        data: {
          budgetId: persistedBudgetId,
          parentId: level.parentId ? levelIdMap.get(level.parentId) ?? null : null,
          type: level.type as never,
          code: level.code,
          name: level.name,
          sortOrder: level.sortOrder,
        },
      });

      levelIdMap.set(level.id, createdLevel.id);
      createdLevels += 1;
    }

    if (createdLevels === 0) {
      throw new Error("No se pudo restaurar la jerarquia de niveles del presupuesto.");
    }

    pendingLevels = nextPendingLevels;
  }

  // Create items
  let apuCount = 0;
  for (const item of budgetData.items) {
    const createdItem = await tx.budgetItem.create({
      data: {
        budgetId: persistedBudgetId,
        levelId: item.levelId ? levelIdMap.get(item.levelId) ?? null : null,
        code: item.code,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        partial: item.partial,
        sortOrder: item.sortOrder,
      },
    });

    budgetItemIdMap.set(item.id, createdItem.id);

    // Create APU if present
    const apu = apuById.get(item.id);
    if (apu) {
      const createdApu = await tx.apu.create({
        data: {
          budgetItemId: createdItem.id,
          name: apu.name,
          unit: apu.unit,
          performance: apu.performance,
          totalUnitCost: apu.totalUnitCost,
        },
      });

      for (const resource of apu.resources) {
        const createdResource = await tx.apuResource.create({
          data: {
            apuId: createdApu.id,
            resourceId: resource.resourceId
              ? resourceIdMap.get(resource.resourceId) ?? null
              : resourceIdMap.get(resource.id) ?? null,
            resourceType: resource.resourceType,
            crew: resource.crew ?? null,
            quantity: resource.quantity,
            unitPrice: resource.unitPrice,
            subtotal: resource.subtotal,
          },
        });
        // Track old ApuResource ID → new ApuResource ID for polynomial formula components
        apuResourceIdMap.set(resource.id, createdResource.id);
      }

      apuCount++;
    }
  }

  return { itemCount: budgetData.items.length, apuCount };
}

async function persistProjectResources(
  ctx: PersistenceContext,
  companyId: string,
  apus: McpApuModule["apus"],
  warnings: string[],
) {
  let projectResourcesData: McpProjectResourcesModule | null = null;

  try {
    projectResourcesData = ctx.readModule("budgets/project-resources.json") as McpProjectResourcesModule;
  } catch {
    await persistFallbackProjectResourcesFromApus(ctx, companyId, apus);
    return;
  }

  for (const resource of projectResourcesData.resources ?? []) {
    const matchingGlobalResource = await ctx.tx.resource.findFirst({
      where: {
        companyId: null,
        code: resource.code,
        description: resource.description,
        category: resource.category as never,
        unit: resource.unit,
        unitPrice: resource.unitPrice,
        currency: resource.currency,
        iu: resource.iu,
        iuCurrent: resource.iuCurrent,
      },
      select: { id: true },
    });

    if (matchingGlobalResource) {
      ctx.resourceIdMap.set(resource.id, matchingGlobalResource.id);
      continue;
    }

    const createdResource = await ctx.tx.resource.create({
      data: {
        companyId,
        code: resource.code,
        description: resource.description,
        category: resource.category as never,
        unit: resource.unit,
        unitPrice: resource.unitPrice,
        currency: resource.currency,
        iu: resource.iu,
        iuCurrent: resource.iuCurrent,
        source: "mcp-import",
      },
    });

    ctx.resourceIdMap.set(resource.id, createdResource.id);
  }

  if (projectResourcesData.resources?.length === 0) {
    warnings.push("El paquete .mcp no contiene recursos de proyecto para vincular los APU.");
  }
}

async function persistFallbackProjectResourcesFromApus(
  ctx: PersistenceContext,
  companyId: string,
  apus: McpApuModule["apus"],
) {
  const fallbackResources = collectFallbackProjectResourcesFromApus(apus);

  for (const fallbackResource of fallbackResources) {
    const createdResource = await ctx.tx.resource.create({
      data: {
        companyId,
        code: fallbackResource.code,
        description: fallbackResource.description,
        category: fallbackResource.category as never,
        unit: fallbackResource.unit,
        unitPrice: fallbackResource.unitPrice,
        currency: fallbackResource.currency,
        iu: null,
        iuCurrent: null,
        source: "mcp-import",
      },
    });

    for (const sourceResourceId of fallbackResource.sourceResourceIds) {
      ctx.resourceIdMap.set(sourceResourceId, createdResource.id);
    }
  }
}

function collectFallbackProjectResourcesFromApus(apus: McpApuModule["apus"]) {
  const resourcesByKey = new Map<
    string,
    {
      code: string;
      description: string;
      category: string;
      unit: string;
      unitPrice: string | number;
      currency: string;
      sourceResourceIds: string[];
    }
  >();

  for (const apu of apus) {
    for (const resource of apu.resources) {
      const description = resource.resourceDescription?.trim();
      if (!description) continue;

      const key = buildFallbackResourceKey(resource);
      const existing = resourcesByKey.get(key);

      if (existing) {
        existing.sourceResourceIds.push(...fallbackSourceIds(resource));
        continue;
      }

      resourcesByKey.set(key, {
        code: `IMP-${String(resourcesByKey.size + 1).padStart(4, "0")}`,
        description,
        category: normalizeFallbackResourceCategory(resource.resourceType),
        unit: "und",
        unitPrice: resource.unitPrice,
        currency: "PEN",
        sourceResourceIds: fallbackSourceIds(resource),
      });
    }
  }

  return [...resourcesByKey.values()];
}

function fallbackSourceIds(resource: McpApuResource) {
  const ids = [resource.resourceId?.trim(), resource.id.trim()].filter(
    (value, index, values): value is string =>
      typeof value === "string" && value.length > 0 && values.indexOf(value) === index,
  );

  return ids;
}

function buildFallbackResourceKey(resource: McpApuResource) {
  return [
    resource.resourceDescription?.trim().toUpperCase() ?? "",
    normalizeFallbackResourceCategory(resource.resourceType),
    String(resource.unitPrice),
  ].join("|");
}

function normalizeFallbackResourceCategory(resourceType: string) {
  const normalized = resourceType.trim().toUpperCase();
  if (normalized === "MO") return "LABOR";
  if (
    normalized === "MATERIAL" ||
    normalized === "LABOR" ||
    normalized === "EQUIPMENT" ||
    normalized === "TOOLS" ||
    normalized === "SUBCONTRACT"
  ) {
    return normalized;
  }
  return "MATERIAL";
}

async function persistFooterRows(
  ctx: PersistenceContext,
  sourceBudgetId: string,
  persistedBudgetId: string,
) {
  let footerData: McpFooterModule | null = null;

  try {
    footerData = ctx.readModule("budgets/footer.json") as McpFooterModule;
  } catch {
    return;
  }

  if (!footerData?.footers) return;

  const budgetFooters = footerData.footers.find((footer) => footer.budgetId === sourceBudgetId);
  if (!budgetFooters || budgetFooters.rows.length === 0) return;

  await ctx.tx.budgetFooterRow.createMany({
    data: budgetFooters.rows.map((row) => ({
      id: randomUUID(),
      budgetId: persistedBudgetId,
      variable: row.variable,
      description: row.description,
      formula: row.formula,
      manualValue: row.manualValue,
      iu: row.iu,
      highlight: row.highlight,
      sortOrder: row.sortOrder,
    })),
  });
}
