import { prisma } from "@/lib/db/prisma";
import Decimal from "decimal.js";
import type { McpBudgetBlueprint, McpProjectResource } from "./mcp-blueprint";
import type { McpCatalogItemMatch, CatalogMatchStatus } from "./mcp-catalog-matcher";
import { matchBlueprintItemsToCatalog } from "./mcp-catalog-matcher";
import { scaleBlueprintQuantities } from "./mcp-quantity-scaler";
import { extractBudgetBlueprintFromStoredPackage } from "./mcp-template-extractor";

// ─── Types ──────────────────────────────────────────────────────────────────

export type McpBudgetApplyMode = "auto" | "review_required";

export type McpBudgetGenerationResult = {
  projectId: string;
  generalBudgetId: string;
  packageId: string;
  sourceProjectName: string;
  subBudgets: Array<{
    budgetId: string;
    name: string;
    levelsCreated: number;
    itemsCreated: number;
    itemsCleaned: number;
    apusCreated: number;
    directCost: string;
  }>;
  /** Estadísticas de matching con catálogo antes de aplicar. */
  matchStats: {
    matched: number;
    reviewRequired: number;
    unmatched: number;
    total: number;
  };
  skippedItems: Array<{
    sourceItemId: string;
    description: string;
    reason: string;
  }>;
  warnings: string[];
};

// ─── Transaction options ────────────────────────────────────────────────────

const transactionOptions = {
  maxWait: 10_000,
  timeout: 120_000,
};

// ─── Main function ──────────────────────────────────────────────────────────

export async function applyMcpBudgetBlueprintToProject(input: {
  userId: string;
  companyId: string;
  projectId: string;
  packageId: string;
  description: string;
  mode: McpBudgetApplyMode;
}): Promise<McpBudgetGenerationResult> {
  // 1. Extract blueprint
  const blueprint = await extractBudgetBlueprintFromStoredPackage({
    packageId: input.packageId,
    userId: input.userId,
  });

  // 2. Match to catalog
  const catalogMatches = await matchBlueprintItemsToCatalog({
    blueprint,
  });

  // 3. Scale quantities
  const scaledQuantities = scaleBlueprintQuantities({
    blueprint,
    description: input.description,
  });

  const quantityByItemId = new Map(
    scaledQuantities.map((q) => [q.sourceItemId, q]),
  );

  const matchByItemId = new Map(
    catalogMatches.map((m) => [m.sourceItemId, m]),
  );

  // Count match stats BEFORE filtering (preview for the user)
  const matchStats = {
    matched: 0,
    reviewRequired: 0,
    unmatched: 0,
    total: catalogMatches.length,
  };
  for (const m of catalogMatches) {
    if (m.status === "matched") matchStats.matched++;
    else if (m.status === "review_required") matchStats.reviewRequired++;
    else matchStats.unmatched++;
  }

  // 4. Execute in transaction
  const result = await prisma.$transaction(async (tx) => {
    const warnings: string[] = [];
    const skippedItems: McpBudgetGenerationResult["skippedItems"] = [];

    // Validate project access
    const project = await tx.project.findFirst({
      where: {
        id: input.projectId,
        companyId: input.companyId,
      },
      select: { id: true, name: true },
    });

    if (!project) {
      throw new Error("Proyecto no encontrado o no tienes acceso.");
    }

    // Find or create general budget
    let generalBudget = await tx.budget.findFirst({
      where: {
        projectId: input.projectId,
        kind: "GENERAL",
      },
      select: {
        id: true,
        igvRate: true,
        generalExpensesRate: true,
        utilityRate: true,
      },
    });

    if (!generalBudget) {
      const firstSubBudget = blueprint.subBudgets[0];
      generalBudget = await tx.budget.create({
        data: {
          projectId: input.projectId,
          kind: "GENERAL",
          name: "Presupuesto General",
          currency: firstSubBudget?.currency ?? "PEN",
          igvRate: firstSubBudget?.igvRate ?? "0.18",
          generalExpensesRate: firstSubBudget?.generalExpensesRate ?? "0.10",
          utilityRate: firstSubBudget?.utilityRate ?? "0.08",
          totalDirectCost: 0,
          totalGeneralExpenses: 0,
          totalUtility: 0,
          totalTax: 0,
          totalAmount: 0,
        },
        select: {
          id: true,
          igvRate: true,
          generalExpensesRate: true,
          utilityRate: true,
        },
      });
    }

    const resultSubBudgets: McpBudgetGenerationResult["subBudgets"] = [];

    for (const sb of blueprint.subBudgets) {
      // Check if sub-budget already exists (by name)
      const existingSubBudget = await tx.budget.findFirst({
        where: {
          projectId: input.projectId,
          parentBudgetId: generalBudget.id,
          name: sb.name,
        },
        select: { id: true },
      });

      let subBudgetId: string;
      let itemsCleaned = 0;

      if (existingSubBudget) {
        subBudgetId = existingSubBudget.id;

        // Smart merge: clean MCP-sourced items from previous runs before
        // re-applying the template. Manual items are preserved.
        itemsCleaned = await cleanMcpSourcedContent({
          tx,
          subBudgetId,
          packageId: input.packageId,
        });
      } else {
        const created = await tx.budget.create({
          data: {
            projectId: input.projectId,
            parentBudgetId: generalBudget.id,
            kind: "SUB_BUDGET",
            name: sb.name,
            currency: sb.currency,
            igvRate: sb.igvRate,
            generalExpensesRate: sb.generalExpensesRate,
            utilityRate: sb.utilityRate,
            totalDirectCost: 0,
            totalGeneralExpenses: 0,
            totalUtility: 0,
            totalTax: 0,
            totalAmount: 0,
          },
        });
        subBudgetId = created.id;
      }

      // Create levels, items, and APUs in the sub-budget.
      // For existing sub-budgets, MCP items were cleaned above so this is
      // a fresh application. Levels are deduped by code.
      const content = await createSubBudgetContent({
        tx,
        subBudgetId,
        sb,
        matchByItemId,
        quantityByItemId,
        mode: input.mode,
        packageId: input.packageId,
        sourceProjectName: blueprint.sourceProjectName,
        skippedItems,
        companyId: input.companyId,
        projectResources: blueprint.projectResources ?? [],
      });

      // Update sub-budget totals
      const genExp = content.directCost.times(Number(sb.generalExpensesRate));
      const util = content.directCost.times(Number(sb.utilityRate));
      const subtotal = content.directCost.plus(genExp).plus(util);
      const tax = subtotal.times(Number(sb.igvRate));
      const total = subtotal.plus(tax);

      await tx.budget.update({
        where: { id: subBudgetId },
        data: {
          totalDirectCost: content.directCost.toFixed(4),
          totalGeneralExpenses: genExp.toFixed(4),
          totalUtility: util.toFixed(4),
          totalTax: tax.toFixed(4),
          totalAmount: total.toFixed(4),
        },
      });

      resultSubBudgets.push({
        budgetId: subBudgetId,
        name: sb.name,
        levelsCreated: content.levelsCreated,
        itemsCreated: content.itemsCreated,
        itemsCleaned,
        apusCreated: content.apusCreated,
        directCost: content.directCost.toFixed(4),
      });
    }

    // Refresh general budget totals
    await refreshGeneralBudgetTotals(tx, generalBudget.id);

    return {
      projectId: input.projectId,
      generalBudgetId: generalBudget.id,
      packageId: input.packageId,
      sourceProjectName: blueprint.sourceProjectName,
      subBudgets: resultSubBudgets,
      matchStats,
      skippedItems,
      warnings,
    };
  }, transactionOptions);

  return result;
}

// ─── Cleanup helper (smart merge) ───────────────────────────────────────────

/**
 * Deletes all MCP-sourced items (BudgetItemGenerationSource with
 * sourceType "MCP_TEMPLATE" and matching packageId) from a sub-budget,
 * and then removes levels that become empty (orphaned).
 *
 * Manual items (those without a BudgetItemGenerationSource entry, or
 * with a different sourceType) are preserved.
 *
 * Returns the number of BudgetItems deleted.
 */
export async function cleanMcpSourcedContent(input: {
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
  subBudgetId: string;
  packageId: string;
}): Promise<number> {
  const { tx, subBudgetId, packageId } = input;

  // 1. Find all MCP-sourced BudgetItems in this sub-budget for this package
  const mcpSources = await tx.budgetItemGenerationSource.findMany({
    where: {
      budgetId: subBudgetId,
      sourceType: "MCP_TEMPLATE",
      sourcePackageId: packageId,
    },
    select: { budgetItemId: true, budgetItem: { select: { levelId: true } } },
  });

  if (mcpSources.length === 0) return 0;

  // Track which levels had items removed (to check for orphans later)
  const affectedLevelIds = new Set(
    mcpSources
      .map((s) => s.budgetItem.levelId)
      .filter((id): id is string => id !== null),
  );

  // 2. Delete MCP-sourced BudgetItems (cascade deletes Apu, ApuResource,
  //    BudgetItemGenerationSource, WorkScheduleItem, etc.)
  const itemIds = mcpSources.map((s) => s.budgetItemId);
  await tx.budgetItem.deleteMany({
    where: { id: { in: itemIds } },
  });

  // 3. Delete orphaned levels (levels that now have 0 items AND no children).
  //    Levels with children are preserved — those children may have manual items.
  if (affectedLevelIds.size > 0) {
    const affectedArray = [...affectedLevelIds];

    // 3a. Find which affected levels still have items (manual items survived)
    const remainingItemCounts = await tx.budgetItem.groupBy({
      by: ["levelId"],
      where: {
        budgetId: subBudgetId,
        levelId: { in: affectedArray },
      },
      _count: { id: true },
    });

    const nonEmptyLevelIds = new Set(
      remainingItemCounts
        .filter((g) => g._count.id > 0)
        .map((g) => g.levelId)
        .filter((id): id is string => id !== null),
    );

    // 3b. Find which affected levels have children (those children may have
    //     manual items that survived the MCP cleanup above)
    const levelsWithChildren = await tx.budgetLevel.findMany({
      where: {
        budgetId: subBudgetId,
        parentId: { in: affectedArray },
      },
      select: { parentId: true },
      distinct: ["parentId"],
    });

    const hasChildrenLevelIds = new Set(
      levelsWithChildren
        .map((l) => l.parentId)
        .filter((id): id is string => id !== null),
    );

    const orphanedLevelIds = affectedArray.filter(
      (id) => !nonEmptyLevelIds.has(id) && !hasChildrenLevelIds.has(id),
    );

    if (orphanedLevelIds.length > 0) {
      await tx.budgetLevel.deleteMany({
        where: {
          budgetId: subBudgetId,
          id: { in: orphanedLevelIds },
        },
      });
    }
  }

  return mcpSources.length;
}

// ─── Resource resolution ────────────────────────────────────────────────────

/**
 * Resolves a Resource ID for an APU resource row.
 *
 * Strategy (in order):
 * 1. In-memory cache (avoids repeated lookups within the transaction).
 * 2. Match projectResources by resourceSourceId (direct ID from the .mcp).
 * 3. Look up in DB by description + companyId.
 * 4. Match projectResources by description.
 * 5. Fallback: create a new Resource from available data.
 */
async function resolveApuResourceId(input: {
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
  companyId: string;
  resourceSourceId: string | null;
  resourceDescription: string | null;
  resourceType: string;
  unit: string;
  unitPrice: string;
  projectResources: McpProjectResource[];
  cache: Map<string, string | null>;
}): Promise<string | null> {
  const { tx, companyId, resourceSourceId, resourceDescription, resourceType, unit, unitPrice, projectResources, cache } = input;

  // Use resourceSourceId as the primary cache key if available
  const cacheKey = resourceSourceId ?? `desc:${companyId}:${resourceDescription ?? resourceType}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  // 1. Match projectResources by the original resource ID from the .mcp
  if (resourceSourceId) {
    const pkgById = projectResources.find((r) => r.id === resourceSourceId);
    if (pkgById) {
      return cacheAndCreate(tx, companyId, pkgById, cache, cacheKey);
    }
  }

  // 2. Look up in DB by description + companyId
  if (resourceDescription) {
    const existing = await tx.resource.findFirst({
      where: { description: resourceDescription, companyId },
      select: { id: true },
    });
    if (existing) {
      cache.set(cacheKey, existing.id);
      return existing.id;
    }
  }

  // 3. Match projectResources by description
  if (resourceDescription) {
    const pkgByDesc = projectResources.find(
      (r) => r.description === resourceDescription,
    );
    if (pkgByDesc) {
      return cacheAndCreate(tx, companyId, pkgByDesc, cache, cacheKey);
    }
  }

  // 4. Fallback: create Resource from available data
  const description = resourceDescription || resourceType;
  const code = resourceSourceId || `MCP-${resourceType.substring(0, 4).toUpperCase()}`;

  const created = await tx.resource.create({
    data: {
      companyId,
      code,
      description,
      category: mapResourceTypeToCategory(resourceType),
      unit,
      unitPrice,
      currency: "PEN",
    },
    select: { id: true },
  });
  cache.set(cacheKey, created.id);
  return created.id;
}

/** Creates a Resource from a McpProjectResource entry and caches the result. */
async function cacheAndCreate(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  companyId: string,
  pkg: McpProjectResource,
  cache: Map<string, string | null>,
  cacheKey: string,
): Promise<string> {
  const created = await tx.resource.create({
    data: {
      companyId,
      code: pkg.code,
      description: pkg.description,
      category: pkg.category as "MATERIAL" | "LABOR" | "EQUIPMENT" | "TOOLS" | "SUBCONTRACT",
      unit: pkg.unit,
      unitPrice: pkg.unitPrice,
      currency: pkg.currency,
      iu: pkg.iu,
      iuCurrent: pkg.iuCurrent,
    },
    select: { id: true },
  });
  cache.set(cacheKey, created.id);
  return created.id;
}

function mapResourceTypeToCategory(
  resourceType: string,
): "MATERIAL" | "LABOR" | "EQUIPMENT" | "TOOLS" | "SUBCONTRACT" {
  const upper = resourceType.toUpperCase();
  if (upper === "MATERIAL" || upper === "MATERIALES") return "MATERIAL";
  if (upper === "LABOR" || upper === "MANO_DE_OBRA" || upper === "MANO DE OBRA") return "LABOR";
  if (upper === "EQUIPMENT" || upper === "EQUIPO" || upper === "EQUIPOS") return "EQUIPMENT";
  if (upper === "TOOLS" || upper === "HERRAMIENTAS") return "TOOLS";
  if (upper === "SUBCONTRACT" || upper === "SUBCONTRATO") return "SUBCONTRACT";
  return "MATERIAL";
}

// ─── Content creation ───────────────────────────────────────────────────────

export async function createSubBudgetContent(input: {
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
  subBudgetId: string;
  sb: McpBudgetBlueprint["subBudgets"][number];
  matchByItemId: Map<string, McpCatalogItemMatch>;
  quantityByItemId: Map<string, { sourceItemId: string; quantity: string; confidence: string; reason: string }>;
  mode: McpBudgetApplyMode;
  packageId: string;
  sourceProjectName: string;
  skippedItems: McpBudgetGenerationResult["skippedItems"];
  /** Company ID for resource creation/lookup. */
  companyId: string;
  /** Resources from the .mcp (project-resources.json). Used to create Resource records. */
  projectResources: McpProjectResource[];
}): Promise<{
  levelsCreated: number;
  itemsCreated: number;
  apusCreated: number;
  directCost: Decimal;
}> {
  const { tx, subBudgetId, sb, matchByItemId, quantityByItemId, mode, packageId, sourceProjectName, skippedItems, companyId, projectResources } = input;

  // Cache for resource ID resolution within this sub-budget content creation
  const resourceIdCache = new Map<string, string | null>();

  // Pre-load existing levels in this sub-budget for dedup by code
  const existingLevels = await tx.budgetLevel.findMany({
    where: { budgetId: subBudgetId },
    select: { id: true, code: true },
  });
  const levelIdByCode = new Map(existingLevels.map((l) => [l.code, l.id]));

  // Create/reuse levels — skip those whose code already exists
  let levelsCreated = 0;
  const levelIdMap = new Map<string, string>();

  const sortedLevels = [...sb.levels].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  for (const level of sortedLevels) {
    let parentPersistedId: string | null = null;
    if (level.parentSourceLevelId) {
      parentPersistedId = levelIdMap.get(level.parentSourceLevelId) ?? null;
    }

    // Check if a level with this code already exists (survivor from manual
    // items or a previous run where we kept it)
    const existingId = levelIdByCode.get(level.code);
    if (existingId) {
      levelIdMap.set(level.sourceLevelId, existingId);
      continue;
    }

    const createdLevel = await tx.budgetLevel.create({
      data: {
        budgetId: subBudgetId,
        parentId: parentPersistedId,
        type: level.type,
        code: level.code,
        name: level.name,
        sortOrder: level.sortOrder,
      },
    });

    levelIdMap.set(level.sourceLevelId, createdLevel.id);
    levelsCreated++;
  }

  // Create items
  let itemsCreated = 0;
  let apusCreated = 0;
  let directCost = new Decimal(0);

  for (const item of sb.items) {
    const match = matchByItemId.get(item.sourceItemId);
    const qty = quantityByItemId.get(item.sourceItemId);

    // Determine if we should skip this item
    if (match) {
      const shouldCreate = shouldCreateItem(match.status, mode);
      if (!shouldCreate) {
        skippedItems.push({
          sourceItemId: item.sourceItemId,
          description: item.description,
          reason:
            match.status === "review_required"
              ? "Requiere revisión (similitud baja con catálogo)"
              : "Sin coincidencia en catálogo",
        });
        continue;
      }
    } else if (mode === "review_required") {
      skippedItems.push({
        sourceItemId: item.sourceItemId,
        description: item.description,
        reason: "Sin coincidencia en catálogo y modo review_required",
      });
      continue;
    }

    // Determine quantity, unit price, and description from match or fallback
    const quantity = qty
      ? new Decimal(qty.quantity)
      : new Decimal(item.quantity);
    const effectiveDescription = match?.catalogPartidaId
      ? match.selectedDescription
      : item.description;
    const effectiveUnit = match?.catalogPartidaId
      ? match.selectedUnit
      : item.unit;
    const effectiveUnitPrice = match?.catalogPartidaId
      ? new Decimal(match.selectedUnitPrice)
      : new Decimal(item.unitPrice);
    const partial = quantity.times(effectiveUnitPrice);

    const levelId = item.levelSourceId
      ? levelIdMap.get(item.levelSourceId) ?? null
      : null;

    const createdItem = await tx.budgetItem.create({
      data: {
        budgetId: subBudgetId,
        levelId,
        code: item.sourceCode,
        description: effectiveDescription,
        unit: effectiveUnit,
        quantity: quantity.toFixed(4),
        unitPrice: effectiveUnitPrice.toFixed(4),
        partial: partial.toFixed(4),
        sortOrder: item.sortOrder,
      },
    });

    // Record generation source for traceability
    await tx.budgetItemGenerationSource.create({
      data: {
        budgetItemId: createdItem.id,
        budgetId: subBudgetId,
        sourceType: "MCP_TEMPLATE",
        sourcePackageId: packageId,
        sourceCatalogPartidaId: match?.catalogPartidaId ?? null,
        sourceItemId: item.sourceItemId,
        catalogMatchScore: match?.matchScore ?? null,
        quantityConfidence: qty?.confidence ?? null,
        metadata: {
          sourceProjectName,
          sourceBudgetName: sb.name,
          originalQuantity: item.quantity,
          originalUnitPrice: item.unitPrice,
          originalDescription: item.description,
          matchReason: match?.reason ?? null,
          scaleReason: qty?.reason ?? null,
        },
      },
    });

    itemsCreated++;
    directCost = directCost.plus(partial);

    // Create APU if available
    if (item.apu) {
      const createdApu = await tx.apu.create({
        data: {
          budgetItemId: createdItem.id,
          name: item.apu.name,
          unit: item.apu.unit,
          performance: item.apu.performance,
          totalUnitCost: item.apu.totalUnitCost,
        },
      });

      for (const resource of item.apu.resources) {
        // Resolve resource ID: match projectResources → DB → fallback create
        const resourceId = await resolveApuResourceId({
          tx,
          companyId,
          resourceSourceId: resource.resourceSourceId,
          resourceDescription: resource.resourceDescription,
          resourceType: resource.resourceType,
          unit: item.apu!.unit,
          unitPrice: resource.unitPrice,
          projectResources,
          cache: resourceIdCache,
        });

        await tx.apuResource.create({
          data: {
            apuId: createdApu.id,
            resourceId,
            resourceType: resource.resourceType,
            crew: resource.crew ? new Decimal(resource.crew) : null,
            quantity: resource.quantity,
            unitPrice: resource.unitPrice,
            subtotal: resource.subtotal,
          },
        });
      }

      apusCreated++;
    }
  }

  return { levelsCreated, itemsCreated, apusCreated, directCost };
}

function shouldCreateItem(
  status: CatalogMatchStatus,
  mode: McpBudgetApplyMode,
): boolean {
  // En modo auto, el .mcp es la base definitiva: crear TODAS las partidas.
  // Las que tienen match con catálogo usan datos del catálogo;
  // las que no, usan sus datos originales del .mcp.
  if (mode === "auto") return true;
  // En modo review_required, solo crear items con match suficiente
  if (status === "matched") return true;
  if (status === "review_required") return true;
  return false;
}

async function refreshGeneralBudgetTotals(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  generalBudgetId: string,
): Promise<void> {
  const childBudgets = await tx.budget.findMany({
    where: { parentBudgetId: generalBudgetId },
    select: {
      totalDirectCost: true,
      totalGeneralExpenses: true,
      totalUtility: true,
      totalTax: true,
      totalAmount: true,
    },
  });

  const consolidated = childBudgets.reduce(
    (acc, child) => ({
      totalDirectCost: acc.totalDirectCost.plus(child.totalDirectCost),
      totalGeneralExpenses: acc.totalGeneralExpenses.plus(child.totalGeneralExpenses),
      totalUtility: acc.totalUtility.plus(child.totalUtility),
      totalTax: acc.totalTax.plus(child.totalTax),
      totalAmount: acc.totalAmount.plus(child.totalAmount),
    }),
    {
      totalDirectCost: new Decimal(0),
      totalGeneralExpenses: new Decimal(0),
      totalUtility: new Decimal(0),
      totalTax: new Decimal(0),
      totalAmount: new Decimal(0),
    },
  );

  await tx.budget.update({
    where: { id: generalBudgetId },
    data: {
      totalDirectCost: consolidated.totalDirectCost.toFixed(4),
      totalGeneralExpenses: consolidated.totalGeneralExpenses.toFixed(4),
      totalUtility: consolidated.totalUtility.toFixed(4),
      totalTax: consolidated.totalTax.toFixed(4),
      totalAmount: consolidated.totalAmount.toFixed(4),
    },
  });
}
