/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HistogramChart } from "@/components/risk/histogram-chart";
import type { RiskSimulationSummary } from "@/types/risk";

vi.mock("recharts", () => ({
  Bar: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  CartesianGrid: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

describe("HistogramChart", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows empty state message when result is null", () => {
    render(<HistogramChart currency="PEN" currencyDecimals={2} result={null} />);

    expect(screen.getByText("Histograma")).toBeTruthy();
    expect(screen.getByText("Ejecuta una simulacion para ver el histograma.")).toBeTruthy();
  });

  it("renders a bar chart when result has histogram bins", () => {
    const result: RiskSimulationSummary = {
      budgetId: "budget-1",
      iterations: 10000,
      baseTotal: 1000,
      mean: 1040,
      median: 1030,
      variance: 400,
      standardDeviation: 20,
      skewness: 0.1,
      kurtosis: -0.2,
      p10: 980,
      p50: 1030,
      p80: 1080,
      p90: 1100,
      p95: 1120,
      histogramBins: [
        { min: 960, max: 980, midpoint: 970, frequency: 500, probability: 0.05 },
        { min: 980, max: 1000, midpoint: 990, frequency: 2000, probability: 0.2 },
        { min: 1000, max: 1020, midpoint: 1010, frequency: 4000, probability: 0.4 },
        { min: 1020, max: 1040, midpoint: 1030, frequency: 2000, probability: 0.2 },
        { min: 1040, max: 1060, midpoint: 1050, frequency: 1000, probability: 0.1 },
        { min: 1060, max: 1080, midpoint: 1070, frequency: 500, probability: 0.05 },
      ],
      sCurvePoints: [],
      scheduleDuration: null,
    };

    render(<HistogramChart currency="PEN" currencyDecimals={2} result={result} />);

    expect(screen.getByText("Histograma")).toBeTruthy();
    expect(screen.getByTestId("bar-chart")).toBeTruthy();
    expect(screen.queryByText("Ejecuta una simulacion para ver el histograma.")).toBeNull();
  });

  it("renders chart with empty histogram bins", () => {
    const result: RiskSimulationSummary = {
      budgetId: "budget-1",
      iterations: 10000,
      baseTotal: 500,
      mean: 500,
      median: 500,
      variance: 0,
      standardDeviation: 0,
      skewness: 0,
      kurtosis: 0,
      p10: 500,
      p50: 500,
      p80: 500,
      p90: 500,
      p95: 500,
      histogramBins: [],
      sCurvePoints: [],
      scheduleDuration: null,
    };

    render(<HistogramChart currency="PEN" currencyDecimals={2} result={result} />);

    // Chart should still render with empty data
    expect(screen.getByTestId("bar-chart")).toBeTruthy();
  });
});
