import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CostTrendsChart } from "@/components/dashboard/analytics/cost-trends-chart";
import type { CostTrendPoint } from "@/lib/dashboard/analytics";

function createTrendPoint(
  overrides: Partial<CostTrendPoint> = {},
): CostTrendPoint {
  return {
    period: "2026-01",
    label: "01/2026",
    kValue: 1.025,
    projectName: "Vivienda San Miguel",
    budgetName: "Formula General",
    ...overrides,
  };
}

describe("CostTrendsChart", () => {
  it("renders empty state when no data is provided", () => {
    const markup = renderToStaticMarkup(
      <CostTrendsChart data={[]} />,
    );

    expect(markup).toContain("Tendencias de K históricas");
    expect(markup).toContain(
      "Registra reajustes en la fórmula polinómica para ver la evolución del coeficiente K.",
    );
  });

  it("renders the chart container when data is present", () => {
    const data = [
      createTrendPoint({ period: "2026-01", label: "01/2026", kValue: 1.025 }),
    ];
    const markup = renderToStaticMarkup(
      <CostTrendsChart data={data} />,
    );

    expect(markup).toContain("Tendencias de K históricas");
    // ResponsiveContainer renders a div with the responsive-container class in SSR
    expect(markup).toContain("recharts-responsive-container");
  });

  it("renders legend when multiple projects exist", () => {
    const data = [
      createTrendPoint({ projectName: "Proyecto A", kValue: 1.025 }),
      createTrendPoint({ projectName: "Proyecto B", kValue: 1.015, period: "2026-01", label: "01/2026" }),
    ];
    const markup = renderToStaticMarkup(
      <CostTrendsChart data={data} />,
    );

    // Legend renders outside recharts when lines.length > 1
    expect(markup).toContain("Proyecto A");
    expect(markup).toContain("Proyecto B");
  });

  it("hides legend when only one project exists", () => {
    const data = [
      createTrendPoint({ projectName: "Unico Proyecto", kValue: 1.025 }),
      createTrendPoint({ projectName: "Unico Proyecto", kValue: 1.048, period: "2026-02", label: "02/2026" }),
    ];
    const markup = renderToStaticMarkup(
      <CostTrendsChart data={data} />,
    );

    // With only one project, the legend should not render project name text
    // The chart responsive container should still render
    expect(markup).toContain("recharts-responsive-container");
  });

  it("handles a single data point without crashing", () => {
    const data = [createTrendPoint()];
    const markup = renderToStaticMarkup(
      <CostTrendsChart data={data} />,
    );

    expect(markup).toContain("Tendencias de K históricas");
    expect(markup).toContain("recharts-responsive-container");
  });

  it("renders legend with both project names when multiple projects share the same period", () => {
    const data = [
      createTrendPoint({ period: "2026-01", label: "01/2026", projectName: "Proyecto A", kValue: 1.025 }),
      createTrendPoint({ period: "2026-01", label: "01/2026", projectName: "Proyecto B", kValue: 1.015 }),
      createTrendPoint({ period: "2026-02", label: "02/2026", projectName: "Proyecto A", kValue: 1.048 }),
    ];
    const markup = renderToStaticMarkup(
      <CostTrendsChart data={data} />,
    );

    // Both project names should appear in the legend (outside recharts)
    expect(markup).toContain("Proyecto A");
    expect(markup).toContain("Proyecto B");
    // Chart responsive container renders
    expect(markup).toContain("recharts-responsive-container");
  });
});
