/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RiskWorkSchedulePanel } from "@/components/risk/risk-work-schedule-panel";
import { buildWorkScheduleExposureSummary } from "@/lib/risk/statistics";
import type { RiskVariableRecord, RiskWorkScheduleSummary } from "@/types/risk";

describe("RiskWorkSchedulePanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows empty-state text when no schedule summary is available", () => {
    render(<RiskWorkSchedulePanel summary={null} variables={[]} />);

    expect(screen.getByText("Cronograma")).toBeTruthy();
    expect(
      screen.getByText("Este analisis de riesgo no tiene un cronograma general vinculado para cruzar ruta critica y variables."),
    ).toBeTruthy();
  });

  it("shows critical exposure against active risk variables", () => {
    render(<RiskWorkSchedulePanel summary={createSummary()} variables={createVariables()} />);

    expect(screen.getByText("Cruce de variables de riesgo activas con la ruta critica del cronograma general.")).toBeTruthy();
    expect(screen.getByText("Criticas con riesgo")).toBeTruthy();
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getByText("Cobertura critica")).toBeTruthy();
    expect(screen.getByText("100.0%")).toBeTruthy();
    expect(screen.getByText("Costo critico expuesto")).toBeTruthy();
    expect(screen.getByText("S/ 4,200.00")).toBeTruthy();
    expect(screen.getByText("01.01 Excavacion masiva")).toBeTruthy();
    expect(screen.getByText("2 variables activas")).toBeTruthy();
  });

  it("builds quantitative exposure metrics from critical items and active variables", () => {
    const exposure = buildWorkScheduleExposureSummary(createSummary(), createVariables());

    expect(exposure).toEqual({
      exposedCriticalCost: 4200,
      exposedCriticalItemCount: 2,
      exposedCriticalShare: 1,
      totalCriticalCost: 4200,
      uncoveredCriticalCost: 0,
    });
  });

  it("offers duration editing actions for critical items", () => {
    const onEditDurationVariable = vi.fn();

    render(
      <RiskWorkSchedulePanel
        onEditDurationVariable={onEditDurationVariable}
        summary={createSummary()}
        variables={createVariables()}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Agregar duracion" })[1]!);

    expect(onEditDurationVariable).toHaveBeenCalledWith("item-2:DURATION");
  });
});

function createSummary(): RiskWorkScheduleSummary {
  return {
    budgetId: "budget-1",
    budgetName: "Presupuesto General",
    currency: "PEN",
    timeline: {
      startDate: "2026-07-01",
      endDate: "2026-08-15",
    },
    criticalPath: {
      status: "calculated",
      projectDurationDays: 46,
      scheduledItemCount: 8,
      criticalItemCount: 2,
      issues: [],
    },
    generationSummary: {
      generatedCount: 8,
      pendingCount: 1,
    },
    criticalItems: [
      {
        budgetItemId: "item-1",
        itemCode: "01.01",
        description: "Excavacion masiva",
        subBudgetName: "Movimiento de tierras",
        partial: 2800,
        durationDays: 10,
        startDate: "2026-07-01",
        endDate: "2026-07-10",
      },
      {
        budgetItemId: "item-2",
        itemCode: "01.02",
        description: "Relleno compactado",
        subBudgetName: "Movimiento de tierras",
        partial: 1400,
        durationDays: 7,
        startDate: "2026-07-11",
        endDate: "2026-07-17",
      },
    ],
    simulationLines: [
      {
        budgetItemId: "item-1",
        itemCode: "01.01",
        description: "Excavacion masiva",
        durationDays: 10,
        predecessor: null,
        subBudgetName: "Movimiento de tierras",
      },
      {
        budgetItemId: "item-2",
        itemCode: "01.02",
        description: "Relleno compactado",
        durationDays: 7,
        predecessor: "01.01FS",
        subBudgetName: "Movimiento de tierras",
      },
    ],
  };
}

function createVariables(): RiskVariableRecord[] {
  return [
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
  ];
}
