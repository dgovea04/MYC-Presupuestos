import { prisma } from "@/lib/db/prisma";
import Decimal from "decimal.js";
import type { McpBudgetBlueprint } from "./mcp-blueprint";
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
    apusCreated: number;
    directCost: string;
  }>;
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
      // Check if sub-budget already exists (by normalized name)
      const existingSubBudget = await tx.budget.findFirst({
        where: {
          projectId: input.projectId,
          parentBudgetId: generalBudget.id,
          name: sb.name,
        },
        select: { id: true },
      });

      if (existingSubBudget) {
        warnings.push(
          `Sub-presupuesto "${sb.name}" ya existe. Se omite la creación.`,
        );
        resultSubBudgets.push({
          budgetId: existingSubBudget.id,
          name: sb.name,
          levelsCreated: 0,
          itemsCreated: 0,
          apusCreated: 0,
          directCost: "0",
        });
        continue;
      }

      // Create sub-budget
      const subBudget = await tx.budget.create({
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

      // Create levels
      let levelsCreated = 0;
      const levelIdMap = new Map<string, string>();

      // Process levels in order, handling parent-child relationships
      const sortedLevels = [...sb.levels].sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );

      for (const level of sortedLevels) {
        // If parent not yet created, try to find by source ID
        let parentPersistedId: string | null = null;
        if (level.parentSourceLevelId) {
          parentPersistedId = levelIdMap.get(level.parentSourceLevelId) ?? null;
        }

        const createdLevel = await tx.budgetLevel.create({
          data: {
            budgetId: subBudget.id,
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
          const shouldCreate = shouldCreateItem(match.status, input.mode);
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
        } else if (input.mode === "review_required") {
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
            budgetId: subBudget.id,
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
            budgetId: subBudget.id,
            sourceType: "MCP_TEMPLATE",
            sourcePackageId: input.packageId,
            sourceCatalogPartidaId: match?.catalogPartidaId ?? null,
            sourceItemId: item.sourceItemId,
            catalogMatchScore: match?.matchScore ?? null,
            quantityConfidence: qty?.confidence ?? null,
            metadata: {
              sourceProjectName: blueprint.sourceProjectName,
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
            await tx.apuResource.create({
              data: {
                apuId: createdApu.id,
                resourceId: null, // Resources are re-linked during catalog matching
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

      // Update sub-budget totals
      const genExp = directCost.times(Number(sb.generalExpensesRate));
      const util = directCost.times(Number(sb.utilityRate));
      const subtotal = directCost.plus(genExp).plus(util);
      const tax = subtotal.times(Number(sb.igvRate));
      const total = subtotal.plus(tax);

      await tx.budget.update({
        where: { id: subBudget.id },
        data: {
          totalDirectCost: directCost.toFixed(4),
          totalGeneralExpenses: genExp.toFixed(4),
          totalUtility: util.toFixed(4),
          totalTax: tax.toFixed(4),
          totalAmount: total.toFixed(4),
        },
      });

      resultSubBudgets.push({
        budgetId: subBudget.id,
        name: sb.name,
        levelsCreated,
        itemsCreated,
        apusCreated,
        directCost: directCost.toFixed(4),
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
      skippedItems,
      warnings,
    };
  }, transactionOptions);

  return result;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function shouldCreateItem(
  status: CatalogMatchStatus,
  mode: McpBudgetApplyMode,
): boolean {
  if (status === "matched") return true;
  if (mode === "auto" && status === "review_required") return true;
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
