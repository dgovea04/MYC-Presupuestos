/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BoxPlotChart } from "@/components/risk/box-plot-chart";
import type { RiskBoxPlotStats } from "@/types/risk";

describe("BoxPlotChart", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows empty state message when result is null", () => {
    render(<BoxPlotChart currency="PEN" currencyDecimals={2} result={null} />);

    expect(screen.getByText("Box Plot")).toBeTruthy();
    expect(screen.getByText("Ejecuta una simulacion para ver el box plot.")).toBeTruthy();
  });

  it("renders box plot with all 5 stat values when result is provided", () => {
    const result: RiskBoxPlotStats = {
      minimum: 950,
      lowerQuartile: 990,
      median: 1020,
      upperQuartile: 1055,
      maximum: 1100,
    };

    render(<BoxPlotChart currency="PEN" currencyDecimals={2} result={result} />);

    expect(screen.getByText("Box Plot")).toBeTruthy();

    // All 5 stat labels
    expect(screen.getByText("Min")).toBeTruthy();
    expect(screen.getByText("Q1")).toBeTruthy();
    expect(screen.getByText("Mediana")).toBeTruthy();
    expect(screen.getByText("Q3")).toBeTruthy();
    expect(screen.getByText("Max")).toBeTruthy();

    // All 5 stat values
    expect(screen.getByText("S/ 950.00")).toBeTruthy();
    expect(screen.getByText("S/ 990.00")).toBeTruthy();
    expect(screen.getByText("S/ 1,020.00")).toBeTruthy();
    expect(screen.getByText("S/ 1,055.00")).toBeTruthy();
    expect(screen.getByText("S/ 1,100.00")).toBeTruthy();
  });

  it("renders box plot visualization elements", () => {
    const result: RiskBoxPlotStats = {
      minimum: 100,
      lowerQuartile: 200,
      median: 350,
      upperQuartile: 450,
      maximum: 600,
    };

    const { container } = render(<BoxPlotChart currency="PEN" currencyDecimals={2} result={result} />);

    // The box plot should have a container with relative positioning
    const boxPlotContainer = container.querySelector(".relative.h-24");
    expect(boxPlotContainer).toBeTruthy();

    // Should have the center line, whiskers, box, median marker, and min/max ticks
    const elements = boxPlotContainer!.querySelectorAll(".absolute");
    // At least 6 absolute-positioned elements (left whisker, box, right whisker, min tick, median, max tick)
    expect(elements.length).toBeGreaterThanOrEqual(6);
  });

  it("handles zero-range data (all values equal)", () => {
    const result: RiskBoxPlotStats = {
      minimum: 1000,
      lowerQuartile: 1000,
      median: 1000,
      upperQuartile: 1000,
      maximum: 1000,
    };

    render(<BoxPlotChart currency="PEN" currencyDecimals={2} result={result} />);

    // Should render without error, all stats showing 1000.00
    const thousandValues = screen.getAllByText("S/ 1,000.00");
    expect(thousandValues.length).toBe(5);
  });

  it("renders formatted values with USD currency", () => {
    const result: RiskBoxPlotStats = {
      minimum: 5000,
      lowerQuartile: 5200,
      median: 5500,
      upperQuartile: 5800,
      maximum: 6200,
    };

    render(<BoxPlotChart currency="USD" currencyDecimals={0} result={result} />);

    expect(screen.getByText("$ 5,000")).toBeTruthy();
    expect(screen.getByText("$ 6,200")).toBeTruthy();
  });
});
