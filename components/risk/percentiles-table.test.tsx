/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PercentilesTable } from "@/components/risk/percentiles-table";
import type { RiskSimulationSummary } from "@/types/risk";

describe("PercentilesTable", () => {
  afterEach(() => {
    cleanup();
  });

  function createResult(overrides: Partial<RiskSimulationSummary> = {}): RiskSimulationSummary {
    return {
      budgetId: "budget-1",
      iterations: 10000,
      baseTotal: 1000,
      mean: 1050,
      median: 1045,
      variance: 2500,
      standardDeviation: 50,
      skewness: 0.2,
      kurtosis: -0.3,
      p10: 940,
      p50: 1045,
      p80: 1090,
      p90: 1120,
      p95: 1145,
      histogramBins: [],
      sCurvePoints: [],
      scheduleDuration: null,
      ...overrides,
    };
  }

  it("renders the title and column headers", () => {
    render(
      <PercentilesTable
        baseTotal={1000}
        currency="PEN"
        currencyDecimals={2}
        result={null}
      />,
    );

    expect(screen.getByText("Percentiles y contingencia")).toBeTruthy();
    expect(screen.getByText("Percentil")).toBeTruthy();
    expect(screen.getByText("Monto")).toBeTruthy();
    expect(screen.getByText("Delta vs base")).toBeTruthy();
    expect(screen.getByText("Contingencia")).toBeTruthy();
  });

  it("renders all 5 percentile rows with '-' when result is null", () => {
    render(
      <PercentilesTable
        baseTotal={1000}
        currency="PEN"
        currencyDecimals={2}
        result={null}
      />,
    );

    expect(screen.getByText("P10")).toBeTruthy();
    expect(screen.getByText("P50")).toBeTruthy();
    expect(screen.getByText("P80")).toBeTruthy();
    expect(screen.getByText("P90")).toBeTruthy();
    expect(screen.getByText("P95")).toBeTruthy();

    const dashValues = screen.getAllByText("-");
    // 3 columns × 5 rows = 15 dash values
    expect(dashValues.length).toBe(15);
  });

  it("displays formatted currency values and deltas when result is provided", () => {
    render(
      <PercentilesTable
        baseTotal={1000}
        currency="PEN"
        currencyDecimals={2}
        result={createResult()}
      />,
    );

    expect(screen.getByText("S/ 940.00")).toBeTruthy(); // p10
    expect(screen.getByText("-S/ 60.00")).toBeTruthy(); // p10 delta
    expect(screen.getByText("S/ 1,045.00")).toBeTruthy(); // p50
    expect(screen.getByText("S/ 45.00")).toBeTruthy(); // p50 delta
    expect(screen.getByText("S/ 1,120.00")).toBeTruthy(); // p90
    expect(screen.getByText("S/ 120.00")).toBeTruthy(); // p90 delta
  });

  it("calculates contingency as percentage of baseTotal", () => {
    render(
      <PercentilesTable
        baseTotal={2000}
        currency="PEN"
        currencyDecimals={2}
        result={createResult({
          p10: 1800,
          p50: 2000,
          p80: 2200,
          p90: 2400,
          p95: 2600,
        })}
      />,
    );

    // P10: (1800 - 2000) / 2000 = -10%
    expect(screen.getByText("-10.00%")).toBeTruthy();
    // P80: (2200 - 2000) / 2000 = 10%
    expect(screen.getByText("10.00%")).toBeTruthy();
    // P95: (2600 - 2000) / 2000 = 30%
    expect(screen.getByText("30.00%")).toBeTruthy();
  });

  it("shows zero contingency when baseTotal is zero", () => {
    render(
      <PercentilesTable
        baseTotal={0}
        currency="PEN"
        currencyDecimals={2}
        result={createResult()}
      />,
    );

    // All contingencies should be 0.00%
    const zeroPct = screen.getAllByText("0.00%");
    expect(zeroPct.length).toBe(5);
  });

  it("renders in a Card with proper structure", () => {
    const { container } = render(
      <PercentilesTable
        baseTotal={1000}
        currency="PEN"
        currencyDecimals={2}
        result={createResult()}
      />,
    );

    const table = container.querySelector("table");
    expect(table).toBeTruthy();

    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(5);
  });
});
