/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RiskSuggestionsPanel } from "@/components/risk/risk-suggestions-panel";
import type { RiskVariableRecord, RiskVariableSuggestion } from "@/types/risk";

describe("RiskSuggestionsPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders Khipu suggestions for review", () => {
    render(
      <RiskSuggestionsPanel
        disabled={false}
        onRequestSuggestions={async () => undefined}
        onSaveApprovedScenario={async () => undefined}
        suggestions={[createSuggestion()]}
      />,
    );

    expect(screen.getByText("Sugerencias de Khipu")).toBeTruthy();
    expect(screen.getByText("Partida de alto impacto.")).toBeTruthy();
    expect(screen.getByText("QUANTITY | PERT")).toBeTruthy();
    expect(screen.getByText("Min 9.5 | Probable 10 | Max 11")).toBeTruthy();
  });

  it("saves only accepted suggestions with source confidence and rationale metadata", async () => {
    const onSaveApprovedScenario = vi.fn<(variables: RiskVariableRecord[]) => Promise<void>>().mockResolvedValue(undefined);

    render(
      <RiskSuggestionsPanel
        disabled={false}
        onRequestSuggestions={async () => undefined}
        onSaveApprovedScenario={onSaveApprovedScenario}
        suggestions={[
          createSuggestion({ id: "suggestion-1", reason: "Partida de alto impacto." }),
          createSuggestion({
            id: "suggestion-2",
            budgetItemId: "item-2",
            variableType: "UNIT_PRICE",
            reason: "Precio unitario sensible.",
            confidence: 0.65,
            source: "AGENT",
          }),
        ]}
      />,
    );

    fireEvent.click(screen.getByLabelText("Rechazar sugerencia suggestion-2"));
    fireEvent.click(screen.getByRole("button", { name: "Guardar escenario aprobado" }));

    await waitFor(() => expect(onSaveApprovedScenario).toHaveBeenCalledTimes(1));
    expect(onSaveApprovedScenario).toHaveBeenCalledWith([
      expect.objectContaining({
        budgetItemId: "item-1",
        confidence: 0.8,
        enabled: true,
        rationale: "Partida de alto impacto.",
        source: "HEURISTIC",
        variableType: "QUANTITY",
      }),
    ]);
  });
});

function createSuggestion(overrides: Partial<RiskVariableSuggestion> = {}): RiskVariableSuggestion {
  return {
    id: "suggestion-1",
    budgetId: "budget-1",
    budgetItemId: "item-1",
    itemCode: "01.01",
    itemDescription: "Concreto",
    sourceBudgetName: "Estructuras",
    variableType: "QUANTITY",
    distributionType: "PERT",
    minimum: 9.5,
    mostLikely: 10,
    maximum: 11,
    confidence: 0.8,
    reason: "Partida de alto impacto.",
    source: "HEURISTIC",
    impactScore: 1000,
    ...overrides,
  };
}
