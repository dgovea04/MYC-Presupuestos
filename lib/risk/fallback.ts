import type { RiskAnalysisPayload, RiskBudgetKind, RiskWorkScheduleSummary } from "@/types/risk";
import { getBudgetById, getProjectSubBudgetDetails } from "@/lib/data/budgets";
import { getRiskAnalysisFallbackData } from "@/lib/risk/data";
import { getWorkScheduleSection } from "@/lib/data/work-schedule";

export async function buildFallbackRiskAnalysisPayload(input: {
  budgetId: string;
  budgetKind: "GENERAL" | "SUB_BUDGET";
  budgetName: string;
  currency: string;
  projectId: string;
  userId: string;
}): Promise<RiskAnalysisPayload | null> {
  const items =
    input.budgetKind === "GENERAL"
      ? (await getProjectSubBudgetDetails(input.projectId, input.userId)).flatMap((budget) =>
          budget.items.map((item) => ({
            itemId: item.id,
            budgetId: budget.id,
            sourceBudgetName: budget.name,
            code: item.code,
            description: item.description,
            unit: item.unit,
            baseQuantity: item.quantity,
            unitPrice: item.unitPrice,
            baseTotal: item.partial,
            updatedAt: new Date(0).toISOString(),
          })),
        )
      : ((await getBudgetById(input.budgetId, input.userId))?.items.map((item) => ({
          itemId: item.id,
          budgetId: input.budgetId,
          sourceBudgetName: input.budgetName,
          code: item.code,
          description: item.description,
          unit: item.unit,
          baseQuantity: item.quantity,
          unitPrice: item.unitPrice,
          baseTotal: item.partial,
          updatedAt: new Date(0).toISOString(),
        })) ?? []);

  // For SUB_BUDGET, empty items means getBudgetById returned null
  // (the budget doesn't exist for this user). GENERAL with no
  // sub-budgets is a valid empty state — show the page, not a 404.
  if (input.budgetKind === "SUB_BUDGET" && items.length === 0) {
    return null;
  }

  const itemIds = items.map((item) => item.itemId);
  const fallbackRiskData = await getRiskAnalysisFallbackData(input.budgetId, itemIds).catch(() => ({
    variables: [] as RiskAnalysisPayload["variables"],
    correlations: [] as RiskAnalysisPayload["correlations"],
    latestRun: null as RiskAnalysisPayload["latestRun"],
  }));

  return {
    budget: {
      id: input.budgetId,
      projectId: input.projectId,
      name: input.budgetName,
      kind: input.budgetKind,
      currency: input.currency,
      baseTotal: items.reduce((total, item) => total + item.baseTotal, 0),
    },
    items,
    variables: fallbackRiskData.variables,
    correlations: fallbackRiskData.correlations,
    latestRun: fallbackRiskData.latestRun,
  };
}

export async function loadRiskWorkScheduleSummary(
  budgetId: string,
  userId: string,
  budgetKind: RiskBudgetKind,
): Promise<RiskWorkScheduleSummary | null> {
  if (budgetKind !== "GENERAL") {
    return null;
  }

  try {
    const section = await getWorkScheduleSection(budgetId, userId);
    return buildRiskWorkScheduleSummary(section);
  } catch {
    return null;
  }
}

export function buildRiskWorkScheduleSummary(
  section: Awaited<ReturnType<typeof getWorkScheduleSection>>,
): RiskWorkScheduleSummary {
  return {
    budgetId: section.budgetId,
    budgetName: section.budgetName,
    currency: section.currency,
    timeline: section.timeline,
    criticalPath: section.criticalPath ?? null,
    generationSummary: section.generationSummary
      ? {
          generatedCount: section.generationSummary.generatedCount,
          pendingCount: section.generationSummary.pendingCount,
        }
      : null,
    criticalItems: section.groups.flatMap((group) =>
      group.lines
        .filter((line) => line.criticalPath?.isCritical)
        .map((line) => ({
          budgetItemId: line.budgetItemId,
          itemCode: line.itemCode,
          description: line.description,
          subBudgetName: line.subBudgetName,
          partial: line.partial,
          durationDays: line.durationDays ?? null,
          startDate: line.startDate ?? null,
          endDate: line.endDate ?? null,
        })),
    ),
    simulationLines: section.groups.flatMap((group) =>
      group.lines.flatMap((line) =>
        line.durationDays && line.durationDays > 0
          ? [
              {
                budgetItemId: line.budgetItemId,
                itemCode: line.itemCode,
                description: line.description,
                durationDays: line.durationDays,
                predecessor: line.predecessor ?? null,
                subBudgetName: line.subBudgetName,
              },
            ]
          : [],
      ),
    ),
  };
}
