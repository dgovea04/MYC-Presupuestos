import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CostByPhaseChart } from "@/components/dashboard/analytics/cost-by-phase-chart";
import type { CostByPhaseItem } from "@/lib/dashboard/analytics";

function createProject(
  overrides: Partial<CostByPhaseItem> = {},
): CostByPhaseItem {
  return {
    projectId: "project-1",
    projectName: "Vivienda San Miguel",
    generalBudgetId: "budget-1",
    generalTotal: 500000,
    currency: "PEN",
    subBudgets: [
      { subBudgetName: "Estructuras", totalDirectCost: 150000, totalAmount: 200000, currency: "PEN" },
      { subBudgetName: "Arquitectura", totalDirectCost: 100000, totalAmount: 180000, currency: "PEN" },
      { subBudgetName: "Instalaciones Sanitarias", totalDirectCost: 50000, totalAmount: 70000, currency: "PEN" },
      { subBudgetName: "Instalaciones Electricas", totalDirectCost: 35000, totalAmount: 50000, currency: "PEN" },
    ],
    ...overrides,
  };
}

describe("CostByPhaseChart", () => {
  it("renders empty state when no data is provided", () => {
    const markup = renderToStaticMarkup(
      <CostByPhaseChart data={[]} currencyDecimals={2} />,
    );

    expect(markup).toContain("Costo por fase / subpresupuesto");
    expect(markup).toContain(
      "Crea presupuestos con subpresupuestos para ver el desglose por especialidad.",
    );
  });

  it("renders the project selector with available project names", () => {
    const data = [
      createProject({ projectId: "p1", projectName: "Proyecto Alpha" }),
      createProject({ projectId: "p2", projectName: "Proyecto Beta" }),
    ];
    const markup = renderToStaticMarkup(
      <CostByPhaseChart data={data} currencyDecimals={2} />,
    );

    expect(markup).toContain("Proyecto Alpha");
    expect(markup).toContain("Proyecto Beta");
  });

  it("displays the total general budget amount", () => {
    const data = [createProject({ generalTotal: 750000 })];
    const markup = renderToStaticMarkup(
      <CostByPhaseChart data={data} currencyDecimals={2} />,
    );

    expect(markup).toContain("Total presupuesto general");
    expect(markup).toContain("S/ 750,000.00");
  });

  it("displays formatted sub-budget names and their percentages", () => {
    const data = [
      createProject({
        subBudgets: [
          { subBudgetName: "Estructuras", totalDirectCost: 150000, totalAmount: 200000, currency: "PEN" },
          { subBudgetName: "Arquitectura", totalDirectCost: 100000, totalAmount: 180000, currency: "PEN" },
        ],
      }),
    ];
    const markup = renderToStaticMarkup(
      <CostByPhaseChart data={data} currencyDecimals={2} />,
    );

    expect(markup).toContain("Estructuras");
    expect(markup).toContain("Arquitectura");
    expect(markup).toContain("(40.0%)"); // 200000/500000
    expect(markup).toContain("(36.0%)"); // 180000/500000
  });

  it("handles a project with a single sub-budget", () => {
    const data = [
      createProject({
        subBudgets: [
          { subBudgetName: "Unico", totalDirectCost: 50000, totalAmount: 80000, currency: "PEN" },
        ],
      }),
    ];
    const markup = renderToStaticMarkup(
      <CostByPhaseChart data={data} currencyDecimals={2} />,
    );

    expect(markup).toContain("Unico");
    expect(markup).toContain("(16.0%)"); // 80000/500000
  });

  it("handles zero total amount without crashing (division by zero guard)", () => {
    const data = [
      createProject({
        generalTotal: 0,
        subBudgets: [
          { subBudgetName: "Unico", totalDirectCost: 0, totalAmount: 0, currency: "PEN" },
        ],
      }),
    ];
    const markup = renderToStaticMarkup(
      <CostByPhaseChart data={data} currencyDecimals={2} />,
    );

    expect(markup).toContain("Unico");
    expect(markup).toContain("(0.0%)");
  });

  it("sorts sub-budgets by total amount descending", () => {
    const data = [
      createProject({
        subBudgets: [
          { subBudgetName: "Pequeño", totalDirectCost: 10000, totalAmount: 15000, currency: "PEN" },
          { subBudgetName: "Grande", totalDirectCost: 50000, totalAmount: 80000, currency: "PEN" },
          { subBudgetName: "Mediano", totalDirectCost: 25000, totalAmount: 40000, currency: "PEN" },
        ],
      }),
    ];
    const markup = renderToStaticMarkup(
      <CostByPhaseChart data={data} currencyDecimals={2} />,
    );

    // The legend should show them in descending order of total amount
    const grandeIndex = markup.indexOf("Grande");
    const medianoIndex = markup.indexOf("Mediano");
    const pequenoIndex = markup.indexOf("Pequeño");

    expect(grandeIndex).toBeGreaterThan(0);
    expect(medianoIndex).toBeGreaterThan(grandeIndex);
    expect(pequenoIndex).toBeGreaterThan(medianoIndex);
  });
});
