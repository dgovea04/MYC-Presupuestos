/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SCurveChart } from "@/components/risk/s-curve-chart";
import type { RiskSimulationSummary } from "@/types/risk";

vi.mock("recharts", () => ({
  CartesianGrid: () => null,
  Line: () => null,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

describe("SCurveChart", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows empty state message when result is null", () => {
    render(<SCurveChart currency="PEN" currencyDecimals={2} result={null} />);

    expect(screen.getByText("Curva S acumulada")).toBeTruthy();
    expect(screen.getByText("Ejecuta una simulacion para ver la curva S.")).toBeTruthy();
  });

  it("renders a line chart when result has s-curve points", () => {
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
      histogramBins: [],
      sCurvePoints: [
        { cost: 960, cumulativeProbability: 0.01 },
        { cost: 980, cumulativeProbability: 0.05 },
        { cost: 1000, cumulativeProbability: 0.25 },
        { cost: 1020, cumulativeProbability: 0.5 },
        { cost: 1040, cumulativeProbability: 0.75 },
        { cost: 1060, cumulativeProbability: 0.9 },
        { cost: 1080, cumulativeProbability: 0.95 },
        { cost: 1100, cumulativeProbability: 0.99 },
      ],
      scheduleDuration: null,
    };

    render(<SCurveChart currency="PEN" currencyDecimals={2} result={result} />);

    expect(screen.getByText("Curva S acumulada")).toBeTruthy();
    expect(screen.getByTestId("line-chart")).toBeTruthy();
    expect(screen.queryByText("Ejecuta una simulacion para ver la curva S.")).toBeNull();
  });

  it("renders chart with empty s-curve points", () => {
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

    render(<SCurveChart currency="PEN" currencyDecimals={2} result={result} />);

    expect(screen.getByTestId("line-chart")).toBeTruthy();
  });

  it("renders with different currency", () => {
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
      p50: 5100,
      p80: 5300,
      p90: 5400,
      p95: 5500,
      histogramBins: [],
      sCurvePoints: [{ cost: 5000, cumulativeProbability: 0.5 }],
      scheduleDuration: null,
    };

    render(<SCurveChart currency="USD" currencyDecimals={0} result={result} />);

    expect(screen.getByText("Curva S acumulada")).toBeTruthy();
    expect(screen.getByTestId("line-chart")).toBeTruthy();
  });
});
