/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RiskScheduleAnalysisPanel } from "@/components/risk/risk-schedule-analysis-panel";
import type { RiskSimulationSummary } from "@/types/risk";

describe("RiskScheduleAnalysisPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows empty-state text when the simulation has no schedule duration analysis", () => {
    render(<RiskScheduleAnalysisPanel result={null} />);

    expect(screen.getByText("Analisis de plazo")).toBeTruthy();
    expect(
      screen.getByText(
        "Ejecuta una simulacion con variables de duracion activas para ver contingencia, buffer y distribucion de plazo.",
      ),
    ).toBeTruthy();
  });

  it("shows schedule duration metrics and charts when the latest run includes schedule risk", () => {
    render(<RiskScheduleAnalysisPanel result={createSimulationSummary()} />);

    expect(screen.getByText("Duracion media")).toBeTruthy();
    expect(screen.getAllByText("49.2 dias").length).toBeGreaterThan(0);
    expect(screen.getByText("P95 plazo")).toBeTruthy();
    expect(screen.getAllByText("55.0 dias").length).toBeGreaterThan(0);
    expect(screen.getByText("Buffer recomendado P80")).toBeTruthy();
    expect(screen.getByText("6.0 dias (13.04%)")).toBeTruthy();
    expect(screen.getByText("Buffer conservador P95")).toBeTruthy();
    expect(screen.getByText("Contingencia plazo")).toBeTruthy();
    expect(screen.getByText("Histograma de plazo")).toBeTruthy();
    expect(screen.getByText("Curva S de plazo")).toBeTruthy();
    expect(screen.getByText("+9.0 dias")).toBeTruthy();
    expect(screen.getByText("19.57%")).toBeTruthy();
  });
});

function createSimulationSummary(): RiskSimulationSummary {
  return {
    budgetId: "budget-1",
    iterations: 10000,
    baseTotal: 4200,
    mean: 4300,
    median: 4250,
    variance: 100,
    standardDeviation: 10,
    skewness: 0,
    kurtosis: 0,
    p10: 4100,
    p50: 4250,
    p80: 4400,
    p90: 4450,
    p95: 4500,
    histogramBins: [],
    sCurvePoints: [],
    scheduleDuration: {
      iterations: 10000,
      baseProjectDurationDays: 46,
      meanDurationDays: 49.2,
      medianDurationDays: 49,
      p80DurationDays: 52,
      p90DurationDays: 54,
      p95DurationDays: 55,
      minimumDurationDays: 46,
      maximumDurationDays: 60,
      criticalItemCount: 2,
      histogramBins: [
        { min: 46, max: 48, midpoint: 47, frequency: 1200, probability: 0.12 },
        { min: 48, max: 50, midpoint: 49, frequency: 3800, probability: 0.38 },
      ],
      sCurvePoints: [
        { cost: 46, cumulativeProbability: 0.05 },
        { cost: 49, cumulativeProbability: 0.5 },
        { cost: 55, cumulativeProbability: 0.95 },
      ],
    },
  };
}
