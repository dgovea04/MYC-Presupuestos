import { prisma } from "@/lib/db/prisma";
import type {
  RiskCorrelationRecord,
  RiskInputSource,
  RiskScenarioRecord,
  RiskScenarioSource,
  RiskScenarioStatus,
  RiskVariableRecord,
} from "@/types/risk";

type RiskScenarioVariableInput = Pick<
  RiskVariableRecord,
  | "budgetItemId"
  | "variableType"
  | "distributionType"
  | "minimum"
  | "mostLikely"
  | "maximum"
  | "enabled"
> & {
  id?: string;
  budgetId?: string;
  source?: RiskInputSource;
  confidence?: number | null;
  rationale?: string | null;
};

type RiskScenarioCorrelationInput = Pick<
  RiskCorrelationRecord,
  "sourceVariableId" | "targetVariableId" | "coefficient"
> & {
  id?: string;
  budgetId?: string;
  source?: RiskInputSource;
  confidence?: number | null;
  rationale?: string | null;
};

export type SaveRiskScenarioInput = {
  name: string;
  description?: string | null;
  source?: RiskScenarioSource;
  status?: RiskScenarioStatus;
  variables: RiskScenarioVariableInput[];
  correlations: RiskScenarioCorrelationInput[];
};

export async function saveRiskScenario(
  budgetId: string,
  userId: string,
  input: SaveRiskScenarioInput,
): Promise<RiskScenarioRecord> {
  const budget = await prisma.budget.findFirst({
    where: {
      id: budgetId,
      project: {
        company: {
          memberships: {
            some: {
              userId,
              status: "ACTIVE",
            },
          },
        },
      },
    },
    select: { id: true },
  });

  if (!budget) {
    throw new Error("No tienes permisos para guardar este escenario de riesgo.");
  }

  const submittedBudgetItemIds = Array.from(new Set(input.variables.map((variable) => variable.budgetItemId)));

  if (submittedBudgetItemIds.length > 0) {
    const scopedBudgetItems = await prisma.budgetItem.findMany({
      where: {
        budget: {
          OR: [
            { id: budgetId },
            { parentBudgetId: budgetId },
          ],
        },
        id: { in: submittedBudgetItemIds },
      },
      select: { id: true },
    });
    const scopedBudgetItemIds = new Set(scopedBudgetItems.map((item) => item.id));
    const hasOutOfScopeBudgetItem = submittedBudgetItemIds.some((budgetItemId) => !scopedBudgetItemIds.has(budgetItemId));

    if (hasOutOfScopeBudgetItem) {
      throw new Error("El escenario contiene partidas que no pertenecen al presupuesto seleccionado.");
    }
  }

  const scenario = await prisma.$transaction(async (tx) => {
    const createdScenario = await tx.riskScenario.create({
      data: {
        budgetId,
        name: input.name,
        description: input.description ?? null,
        source: input.source ?? "MANUAL",
        status: input.status ?? "DRAFT",
        createdByUserId: userId,
      },
    });
    const variableIdMap = new Map<string, string>();

    for (const variable of input.variables) {
      const createdVariable = await tx.riskVariable.create({
        data: {
          budgetId,
          scenarioId: createdScenario.id,
          budgetItemId: variable.budgetItemId,
          variableType: variable.variableType,
          distributionType: variable.distributionType,
          minimum: variable.minimum,
          mostLikely: variable.mostLikely,
          maximum: variable.maximum,
          enabled: variable.enabled,
          source: variable.source ?? "MANUAL",
          confidence: variable.confidence ?? null,
          rationale: variable.rationale ?? null,
        },
        select: { id: true },
      });

      if (variable.id) {
        variableIdMap.set(variable.id, createdVariable.id);
      }
    }

    for (const correlation of input.correlations) {
      const sourceVariableId = variableIdMap.get(correlation.sourceVariableId);
      const targetVariableId = variableIdMap.get(correlation.targetVariableId);

      if (!sourceVariableId || !targetVariableId) {
        throw new Error("La correlacion usa variables que no pertenecen al escenario guardado.");
      }

      await tx.riskCorrelation.create({
        data: {
          budgetId,
          scenarioId: createdScenario.id,
          sourceVariableId,
          targetVariableId,
          coefficient: correlation.coefficient,
          source: correlation.source ?? "MANUAL",
          confidence: correlation.confidence ?? null,
          rationale: correlation.rationale ?? null,
        },
      });
    }

    return createdScenario;
  });

  return {
    id: scenario.id,
    budgetId: scenario.budgetId,
    name: scenario.name,
    description: scenario.description,
    source: scenario.source,
    status: scenario.status,
    createdByUserId: scenario.createdByUserId,
    createdAt: scenario.createdAt.toISOString(),
    updatedAt: scenario.updatedAt.toISOString(),
  };
}
