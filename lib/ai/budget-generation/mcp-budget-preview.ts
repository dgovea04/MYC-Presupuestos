import { matchBlueprintItemsToCatalog } from "./mcp-catalog-matcher";
import { scaleBlueprintQuantities } from "./mcp-quantity-scaler";
import { extractBudgetBlueprintFromStoredPackage } from "./mcp-template-extractor";

// ─── Types ──────────────────────────────────────────────────────────────────

export type McpBudgetGenerationPreview = {
  packageId: string;
  sourceProjectName: string;
  targetProjectId: string;
  templateScore: number;
  subBudgets: McpBudgetGenerationPreviewSubBudget[];
  totals: {
    estimatedDirectCost: string;
    matchedItems: number;
    reviewRequiredItems: number;
    unmatchedItems: number;
  };
  warnings: string[];
  assumptions: string[];
};

export type McpBudgetGenerationPreviewSubBudget = {
  name: string;
  itemCount: number;
  matchedCatalogItems: number;
  reviewRequiredItems: number;
  unmatchedItems: number;
  estimatedDirectCost: string;
};

// ─── Main function ──────────────────────────────────────────────────────────

export async function previewBudgetFromMcpTemplate(input: {
  userId: string;
  projectId: string;
  packageId: string;
  description: string;
}): Promise<McpBudgetGenerationPreview> {
  // 1. Extract blueprint from .mcp
  const blueprint = await extractBudgetBlueprintFromStoredPackage({
    packageId: input.packageId,
    userId: input.userId,
  });

  // 2. Match items to catalog
  const matches = await matchBlueprintItemsToCatalog({
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

  // 4. Build match by item lookup
  const matchByItemId = new Map(
    matches.map((m) => [m.sourceItemId, m]),
  );

  // 5. Build preview per sub-budget
  const subBudgets: McpBudgetGenerationPreviewSubBudget[] = [];
  let totalMatched = 0;
  let totalReview = 0;
  let totalUnmatched = 0;
  let totalDirectCost = 0;

  const warnings = [...blueprint.warnings];
  const assumptions = [...blueprint.assumptions];

  for (const sb of blueprint.subBudgets) {
    let subTotalMatched = 0;
    let subTotalReview = 0;
    let subTotalUnmatched = 0;
    let subTotalCost = 0;

    for (const item of sb.items) {
      const match = matchByItemId.get(item.sourceItemId);
      const qty = quantityByItemId.get(item.sourceItemId);

      if (match) {
        if (match.status === "matched") {
          subTotalMatched++;
          totalMatched++;
        } else if (match.status === "review_required") {
          subTotalReview++;
          totalReview++;
        } else {
          subTotalUnmatched++;
          totalUnmatched++;
        }
      } else {
        subTotalUnmatched++;
        totalUnmatched++;
      }

      // Calculate estimated cost using scaled quantity and catalog price
      const quantity = qty ? Number.parseFloat(qty.quantity) : Number.parseFloat(item.quantity);
      const unitPrice = match?.catalogPartidaId
        ? Number.parseFloat(match.selectedUnitPrice)
        : Number.parseFloat(item.unitPrice);
      subTotalCost += quantity * unitPrice;
    }

    subBudgets.push({
      name: sb.name,
      itemCount: sb.items.length,
      matchedCatalogItems: subTotalMatched,
      reviewRequiredItems: subTotalReview,
      unmatchedItems: subTotalUnmatched,
      estimatedDirectCost: String(Math.round(subTotalCost * 100) / 100),
    });

    totalDirectCost += subTotalCost;
  }

  // Add quantity-related assumptions
  for (const qty of scaledQuantities) {
    if (qty.confidence === "inferred" || qty.confidence === "template") {
      assumptions.push(`Cantidad "${qty.reason}" para item ${qty.sourceItemId}`);
    }
  }

  if (totalReview > 0) {
    warnings.push(
      `${totalReview} partidas requieren revisión por similitud baja al catálogo.`,
    );
  }

  if (totalUnmatched > 0) {
    warnings.push(
      `${totalUnmatched} partidas no tienen coincidencia en el catálogo y usarán datos de la plantilla.`,
    );
  }

  return {
    packageId: input.packageId,
    sourceProjectName: blueprint.sourceProjectName,
    targetProjectId: input.projectId,
    templateScore: blueprint.confidence,
    subBudgets,
    totals: {
      estimatedDirectCost: String(Math.round(totalDirectCost * 100) / 100),
      matchedItems: totalMatched,
      reviewRequiredItems: totalReview,
      unmatchedItems: totalUnmatched,
    },
    warnings,
    assumptions,
  };
}
