/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCorrelationMatrixView,
  getCorrelationHeatmapClassName,
  RiskCorrelationsPanel,
} from "@/components/risk/risk-correlations-panel";
import type { RiskAnalysisPayload } from "@/types/risk";

describe("RiskCorrelationsPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("builds an upper-triangular matrix view for enabled variables", () => {
    const payload = createPayload();
    const matrix = buildCorrelationMatrixView(payload.items, payload.variables, payload.correlations);

    expect(matrix.variables.map((variable) => variable.label)).toEqual([
      "Cant. 01.01 Excavacion",
      "PU 01.01 Excavacion",
      "Cant. 01.02 Relleno",
    ]);
    expect(matrix.cells[0]?.[1]?.coefficient).toBe(0.35);
    expect(matrix.cells[1]?.[0]).toBeNull();
  });

  it("maps coefficients to heatmap tones", () => {
    expect(getCorrelationHeatmapClassName(0.8)).toContain("emerald-200");
    expect(getCorrelationHeatmapClassName(-0.8)).toContain("rose-200");
    expect(getCorrelationHeatmapClassName(0)).toContain("slate-50");
  });

  it("renders a matrix and saves edited coefficients in one batch", () => {
    const onSaveCorrelations = vi.fn(async () => undefined);
    const payload = createPayload();

    render(
      <RiskCorrelationsPanel
        correlations={payload.correlations}
        items={payload.items}
        onSaveCorrelations={onSaveCorrelations}
        variables={payload.variables}
      />,
    );

    expect(screen.getAllByText("Cant. 01.01 Excavacion").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PU 01.01 Excavacion").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1.00")).toHaveLength(3);
    expect(screen.getByText("Positiva")).toBeTruthy();
    expect(screen.getByText("Sin cambios")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Guardar cambios" }).hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Coeficiente risk-1:risk-2"), { target: { value: "0.55" } });
    fireEvent.change(screen.getByLabelText("Coeficiente risk-1:risk-3"), { target: { value: "-0.25" } });
    expect(screen.getByText("2 cambios pendientes")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Descartar cambios" }).hasAttribute("disabled")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(onSaveCorrelations).toHaveBeenCalledWith([
      { sourceVariableId: "risk-1", targetVariableId: "risk-2", coefficient: 0.55 },
      { sourceVariableId: "risk-1", targetVariableId: "risk-3", coefficient: -0.25 },
      { sourceVariableId: "risk-2", targetVariableId: "risk-3", coefficient: 0 },
    ]);
  });

  it("can discard draft edits and restore the saved state", () => {
    const payload = createPayload();

    render(
      <RiskCorrelationsPanel
        correlations={payload.correlations}
        items={payload.items}
        onSaveCorrelations={vi.fn(async () => undefined)}
        variables={payload.variables}
      />,
    );

    const input = screen.getByLabelText("Coeficiente risk-1:risk-2") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "0.8" } });

    expect(screen.getByText("1 cambio pendiente")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Descartar cambios" }));

    expect(input.value).toBe("0.35");
    expect(screen.getByText("Sin cambios")).toBeTruthy();
  });

  it("labels duration variables in the matrix view", () => {
    const payload = createPayload();
    payload.variables.push({
      id: "risk-4",
      budgetId: "budget-1",
      budgetItemId: "item-2",
      variableType: "DURATION",
      distributionType: "TRIANGULAR",
      minimum: 6,
      mostLikely: 7,
      maximum: 9,
      enabled: true,
    });

    const matrix = buildCorrelationMatrixView(payload.items, payload.variables, payload.correlations);

    expect(matrix.variables.at(-1)?.label).toBe("Dur. 01.02 Relleno");
  });
});

function createPayload(): RiskAnalysisPayload {
  return {
    budget: {
      id: "budget-1",
      projectId: "project-1",
      name: "Presupuesto General",
      kind: "GENERAL",
      currency: "PEN",
      baseTotal: 1000,
    },
    items: [
      {
        itemId: "item-1",
        budgetId: "child-1",
        sourceBudgetName: "Estructuras",
        code: "01.01",
        description: "Excavacion",
        unit: "m3",
        baseQuantity: 10,
        unitPrice: 100,
        baseTotal: 1000,
      },
      {
        itemId: "item-2",
        budgetId: "child-1",
        sourceBudgetName: "Estructuras",
        code: "01.02",
        description: "Relleno",
        unit: "m3",
        baseQuantity: 5,
        unitPrice: 80,
        baseTotal: 400,
      },
    ],
    variables: [
      {
        id: "risk-1",
        budgetId: "budget-1",
        budgetItemId: "item-1",
        variableType: "QUANTITY",
        distributionType: "TRIANGULAR",
        minimum: 8,
        mostLikely: 10,
        maximum: 12,
        enabled: true,
      },
      {
        id: "risk-2",
        budgetId: "budget-1",
        budgetItemId: "item-1",
        variableType: "UNIT_PRICE",
        distributionType: "PERT",
        minimum: 90,
        mostLikely: 100,
        maximum: 110,
        enabled: true,
      },
      {
        id: "risk-3",
        budgetId: "budget-1",
        budgetItemId: "item-2",
        variableType: "QUANTITY",
        distributionType: "TRIANGULAR",
        minimum: 4,
        mostLikely: 5,
        maximum: 6,
        enabled: true,
      },
    ],
    correlations: [
      {
        id: "corr-1",
        budgetId: "budget-1",
        sourceVariableId: "risk-1",
        targetVariableId: "risk-2",
        coefficient: 0.35,
      },
    ],
    latestRun: null,
  };
}
