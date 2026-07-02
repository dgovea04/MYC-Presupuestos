/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RiskKPICards } from "@/components/risk/risk-kpi-cards";
import type { RiskSimulationSummary } from "@/types/risk";

describe("RiskKPICards", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders all 8 KPI labels with '-' when result is null", () => {
    render(<RiskKPICards currency="PEN" currencyDecimals={2} result={null} />);

    expect(screen.getByText("Promedio")).toBeTruthy();
    expect(screen.getByText("Mediana")).toBeTruthy();
    expect(screen.getByText("P50")).toBeTruthy();
    expect(screen.getByText("P80")).toBeTruthy();
    expect(screen.getByText("P90")).toBeTruthy();
    expect(screen.getByText("Desv. estandar")).toBeTruthy();
    expect(screen.getByText("Asimetria")).toBeTruthy();
    expect(screen.getByText("Curtosis")).toBeTruthy();

    const dashValues = screen.getAllByText("-");
    expect(dashValues.length).toBe(8);
  });

  it("renders formatted currency values when result is provided", () => {
    const result: RiskSimulationSummary = {
      budgetId: "budget-1",
      iterations: 10000,
      baseTotal: 1000,
      mean: 1045.5,
      median: 1038.2,
      variance: 2250,
      standardDeviation: 47.434,
      skewness: 0.35,
      kurtosis: -0.12,
      p10: 980,
      p50: 1040,
      p80: 1090,
      p90: 1125.75,
      p95: 1150,
      histogramBins: [],
      sCurvePoints: [],
      scheduleDuration: null,
    };

    render(<RiskKPICards currency="PEN" currencyDecimals={2} result={result} />);

    expect(screen.getByText("S/ 1,045.50")).toBeTruthy();
    expect(screen.getByText("S/ 1,038.20")).toBeTruthy();
    expect(screen.getByText("S/ 1,040.00")).toBeTruthy(); // P50
    expect(screen.getByText("S/ 1,090.00")).toBeTruthy();
    expect(screen.getByText("S/ 1,125.75")).toBeTruthy();
    expect(screen.getByText("S/ 47.43")).toBeTruthy();
    expect(screen.getByText("0.3500")).toBeTruthy();
    expect(screen.getByText("-0.1200")).toBeTruthy();
  });

  it("renders with USD currency and different decimal count", () => {
    const result: RiskSimulationSummary = {
      budgetId: "budget-1",
      iterations: 10000,
      baseTotal: 5000,
      mean: 5200,
      median: 5100,
      variance: 40000,
      standardDeviation: 200,
      skewness: 0,
      kurtosis: 0,
      p10: 4800,
      p50: 5190,
      p80: 5400,
      p90: 5500,
      p95: 5600,
      histogramBins: [],
      sCurvePoints: [],
      scheduleDuration: null,
    };

    render(<RiskKPICards currency="USD" currencyDecimals={0} result={result} />);

    expect(screen.getByText("$ 5,200")).toBeTruthy();
    expect(screen.getByText("$ 5,190")).toBeTruthy();
  });

  it("renders 8 card containers regardless of result", () => {
    const result: RiskSimulationSummary = {
      budgetId: "budget-1",
      iterations: 10000,
      baseTotal: 1000,
      mean: 1000,
      median: 1000,
      variance: 0,
      standardDeviation: 0,
      skewness: 0,
      kurtosis: 0,
      p10: 1000,
      p50: 1000,
      p80: 1000,
      p90: 1000,
      p95: 1000,
      histogramBins: [],
      sCurvePoints: [],
      scheduleDuration: null,
    };

    const { container } = render(<RiskKPICards currency="PEN" currencyDecimals={2} result={result} />);

    // Should render exactly 8 cards
    const cards = container.querySelectorAll(".theme-surface-card");
    expect(cards.length).toBe(8);
  });
});
