import Decimal from "decimal.js";
import type {
  RiskAnalysisPayload,
  RiskSuggestionStrategy,
  RiskVariableSuggestion,
  RiskVariableType,
  RiskWorkScheduleSummary,
} from "@/types/risk";

export type SuggestRiskVariablesInput = {
  payload: RiskAnalysisPayload;
  workScheduleSummary: RiskWorkScheduleSummary | null;
  strategy: RiskSuggestionStrategy;
  maxSuggestions: number;
};

const STRATEGY_RANGE = {
  balanced: { quantityMax: "1.1", priceMax: "1.08", durationMax: "1.25" },
  conservative: { quantityMax: "1.15", priceMax: "1.12", durationMax: "1.35" },
  aggressive: { quantityMax: "1.05", priceMax: "1.04", durationMax: "1.15" },
} as const satisfies Record<
  RiskSuggestionStrategy,
  { quantityMax: string; priceMax: string; durationMax: string }
>;

export function suggestRiskVariables(input: SuggestRiskVariablesInput): RiskVariableSuggestion[] {
  const existingKeys = new Set(
    input.payload.variables.map((variable) => variableKey(variable.budgetItemId, variable.variableType)),
  );
  const criticalItems = new Map(
    (input.workScheduleSummary?.criticalItems ?? []).map((item) => [item.budgetItemId, item]),
  );
  const range = STRATEGY_RANGE[input.strategy];

  return input.payload.items
    .flatMap((item) => {
      const suggestions: RiskVariableSuggestion[] = [];
      const impactScore = new Decimal(item.baseTotal);

      if (!existingKeys.has(variableKey(item.itemId, "QUANTITY")) && new Decimal(item.baseQuantity).gt(0)) {
        suggestions.push({
          id: `suggestion:${item.itemId}:quantity`,
          budgetId: input.payload.budget.id,
          budgetItemId: item.itemId,
          variableType: "QUANTITY",
          distributionType: "PERT",
          minimum: roundRisk(new Decimal(item.baseQuantity).mul("0.95")),
          mostLikely: roundRisk(new Decimal(item.baseQuantity)),
          maximum: roundRisk(new Decimal(item.baseQuantity).mul(range.quantityMax)),
          confidence: criticalItems.has(item.itemId) ? 0.86 : 0.74,
          reason: "Partida con impacto relevante en el costo directo y metrado sensible.",
          source: "HEURISTIC",
          impactScore: impactScore.toNumber(),
        });
      }

      if (
        !existingKeys.has(variableKey(item.itemId, "UNIT_PRICE")) &&
        new Decimal(item.unitPrice).gt(0) &&
        new Decimal(item.unitPrice).mul(item.baseQuantity).gte(impactScore.mul("0.95"))
      ) {
        suggestions.push({
          id: `suggestion:${item.itemId}:unit-price`,
          budgetId: input.payload.budget.id,
          budgetItemId: item.itemId,
          variableType: "UNIT_PRICE",
          distributionType: "PERT",
          minimum: roundRisk(new Decimal(item.unitPrice).mul("0.97")),
          mostLikely: roundRisk(new Decimal(item.unitPrice)),
          maximum: roundRisk(new Decimal(item.unitPrice).mul(range.priceMax)),
          confidence: 0.7,
          reason: "Precio unitario relevante para el parcial de la partida.",
          source: "HEURISTIC",
          impactScore: impactScore.mul("0.85").toNumber(),
        });
      }

      const criticalItem = criticalItems.get(item.itemId);
      if (
        criticalItem?.durationDays &&
        criticalItem.durationDays > 0 &&
        !existingKeys.has(variableKey(item.itemId, "DURATION"))
      ) {
        suggestions.push({
          id: `suggestion:${item.itemId}:duration`,
          budgetId: input.payload.budget.id,
          budgetItemId: item.itemId,
          variableType: "DURATION",
          distributionType: "PERT",
          minimum: roundDuration(new Decimal(criticalItem.durationDays).mul("0.9")),
          mostLikely: criticalItem.durationDays,
          maximum: roundDuration(new Decimal(criticalItem.durationDays).mul(range.durationMax)),
          confidence: 0.82,
          reason: "Partida critica del cronograma con exposicion de plazo.",
          source: "HEURISTIC",
          impactScore: impactScore.mul("1.1").toNumber(),
        });
      }

      return suggestions;
    })
    .sort((left, right) => right.impactScore - left.impactScore)
    .slice(0, Math.max(1, input.maxSuggestions));
}

function variableKey(budgetItemId: string, variableType: RiskVariableType): string {
  return `${budgetItemId}:${variableType}`;
}

function roundRisk(value: Decimal): number {
  return value.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
}

function roundDuration(value: Decimal): number {
  return Decimal.max(1, value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP)).toNumber();
}
