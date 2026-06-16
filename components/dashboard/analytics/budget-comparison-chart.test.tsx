import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BudgetComparisonChart } from "@/components/dashboard/analytics/budget-comparison-chart";
import type { BudgetComparisonItem } from "@/lib/dashboard/analytics";

function createBudget(
  overrides: Partial<BudgetComparisonItem> = {},
): BudgetComparisonItem {
  return {
    projectId: "project-1",
    projectName: "Vivienda San Miguel",
    budgetId: "budget-1",
    totalAmount: 500000,
    totalDirectCost: 350000,
    currency: "PEN",
    updatedAt: new Date("2026-05-15T10:00:00.000Z"),
    ...overrides,
  };
}

describe("BudgetComparisonChart", () => {
  it("renders empty state when no data is provided", () => {
    const markup = renderToStaticMarkup(
      <BudgetComparisonChart data={[]} currencyDecimals={2} />,
    );

    expect(markup).toContain("Comparativa de presupuestos");
    expect(markup).toContain(
      "Registra presupuestos generales para ver la comparativa entre proyectos.",
    );
  });

  it("renders the card with chart container when data is present", () => {
    const data = [
      createBudget({ projectName: "Colegio Sur" }),
    ];
    const markup = renderToStaticMarkup(
      <BudgetComparisonChart data={data} currencyDecimals={2} />,
    );

    // Card title should render
    expect(markup).toContain("Comparativa de presupuestos");
    // ResponsiveContainer renders a div with the responsive-container class in SSR
    expect(markup).toContain("recharts-responsive-container");
  });

  it("limits visible projects to 8 and shows truncation message", () => {
    const data = Array.from({ length: 12 }, (_, i) =>
      createBudget({
        projectId: `project-${i}`,
        projectName: `Proyecto ${i + 1}`,
        budgetId: `budget-${i}`,
      }),
    );
    const markup = renderToStaticMarkup(
      <BudgetComparisonChart data={data} currencyDecimals={2} />,
    );

    // Truncation message renders outside recharts
    expect(markup).toContain("Mostrando 8 de 12 presupuestos");
  });

  it("does not show the truncation message when 8 or fewer items", () => {
    const data = Array.from({ length: 8 }, (_, i) =>
      createBudget({
        projectId: `project-${i}`,
        projectName: `Proyecto ${i + 1}`,
        budgetId: `budget-${i}`,
      }),
    );
    const markup = renderToStaticMarkup(
      <BudgetComparisonChart data={data} currencyDecimals={2} />,
    );

    expect(markup).not.toContain("Mostrando");
  });

  it("renders properly with a single budget entry (no truncation message)", () => {
    const data = [createBudget({ projectName: "Unico proyecto" })];
    const markup = renderToStaticMarkup(
      <BudgetComparisonChart data={data} currencyDecimals={2} />,
    );

    expect(markup).toContain("Comparativa de presupuestos");
    expect(markup).not.toContain("Mostrando");
    expect(markup).toContain("recharts-responsive-container");
  });
});
