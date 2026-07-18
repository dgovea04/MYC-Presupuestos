import { describe, expect, it } from "vitest";
import { suggestRiskVariables } from "@/lib/risk/suggestions";
import type { RiskAnalysisPayload, RiskVariableRecord, RiskWorkScheduleSummary } from "@/types/risk";

function payload(variables: RiskVariableRecord[] = []): RiskAnalysisPayload {
  return {
    budget: {
      id: "budget-1",
      projectId: "project-1",
      name: "Obra",
      kind: "SUB_BUDGET",
      currency: "PEN",
      baseTotal: 1500,
    },
    items: [
      {
        itemId: "item-1",
        budgetId: "budget-1",
        sourceBudgetName: "Estructuras",
        code: "01.01",
        description: "Concreto",
        unit: "m3",
        baseQuantity: 10,
        unitPrice: 100,
        baseTotal: 1000,
        updatedAt: "2026-07-17T00:00:00.000Z",
      },
      {
        itemId: "item-2",
        budgetId: "budget-1",
        sourceBudgetName: "Estructuras",
        code: "01.02",
        description: "Acero",
        unit: "kg",
        baseQuantity: 5,
        unitPrice: 100,
        baseTotal: 500,
        updatedAt: "2026-07-17T00:00:00.000Z",
      },
    ],
    variables,
    correlations: [],
    latestRun: null,
  };
}

describe("suggestRiskVariables", () => {
  it("suggests high-impact quantity risk first", () => {
    const suggestions = suggestRiskVariables({
      payload: payload(),
      strategy: "balanced",
      maxSuggestions: 1,
      workScheduleSummary: null,
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      budgetItemId: "item-1",
      variableType: "QUANTITY",
      distributionType: "PERT",
      minimum: 9.5,
      mostLikely: 10,
      maximum: 11,
      source: "HEURISTIC",
      impactScore: 1000,
    });
  });

  it("avoids existing variable keys and caps suggestions by impact score", () => {
    const suggestions = suggestRiskVariables({
      payload: payload([
        {
          id: "risk-1",
          budgetId: "budget-1",
          budgetItemId: "item-1",
          variableType: "QUANTITY",
          distributionType: "PERT",
          minimum: 9,
          mostLikely: 10,
          maximum: 11,
          enabled: true,
        },
      ]),
      strategy: "conservative",
      maxSuggestions: 2,
      workScheduleSummary: null,
    });

    expect(suggestions).toHaveLength(2);
    expect(suggestions.map((suggestion) => `${suggestion.budgetItemId}:${suggestion.variableType}`)).toEqual([
      "item-1:UNIT_PRICE",
      "item-2:QUANTITY",
    ]);
    expect(suggestions[0]?.impactScore).toBeGreaterThanOrEqual(suggestions[1]?.impactScore ?? 0);
    expect(suggestions.every((suggestion) => suggestion.source === "HEURISTIC")).toBe(true);
  });

  it("adds duration suggestions for critical schedule items", () => {
    const suggestions = suggestRiskVariables({
      payload: payload(),
      strategy: "aggressive",
      maxSuggestions: 4,
      workScheduleSummary: workScheduleSummary(),
    });

    expect(suggestions).toContainEqual(
      expect.objectContaining({
        id: "suggestion:item-1:duration",
        budgetItemId: "item-1",
        variableType: "DURATION",
        distributionType: "PERT",
        minimum: 11,
        mostLikely: 12,
        maximum: 14,
        source: "HEURISTIC",
      }),
    );
  });
});

function workScheduleSummary(): RiskWorkScheduleSummary {
  return {
    budgetId: "budget-1",
    budgetName: "Obra",
    currency: "PEN",
    timeline: {
      startDate: null,
      endDate: null,
    },
    criticalPath: {
      status: "calculated",
      projectDurationDays: 12,
      scheduledItemCount: 1,
      criticalItemCount: 1,
      issues: [],
    },
    generationSummary: {
      generatedCount: 1,
      pendingCount: 0,
    },
    criticalItems: [
      {
        budgetItemId: "item-1",
        itemCode: "01.01",
        description: "Concreto",
        subBudgetName: "Estructuras",
        partial: 1000,
        durationDays: 12,
        startDate: null,
        endDate: null,
      },
    ],
    simulationLines: [],
  };
}
