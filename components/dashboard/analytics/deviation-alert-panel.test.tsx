import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Mock next/link to render as a plain <a> tag for static markup tests
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { DeviationAlertPanel } from "@/components/dashboard/analytics/deviation-alert-panel";
import type { DeviationAlert } from "@/lib/dashboard/analytics";

function createAlert(
  overrides: Partial<DeviationAlert> = {},
): DeviationAlert {
  return {
    id: "adj-1",
    projectName: "Vivienda San Miguel",
    budgetName: "Formula General",
    href: "/budgets/budget-1/polynomial-formula?focus=adjustment",
    originalAmount: 150000,
    adjustedAmount: 187500,
    deviationAmount: 37500,
    deviationPercent: 25,
    period: "3/2026",
    severity: "high",
    currency: "PEN",
    ...overrides,
  };
}

describe("DeviationAlertPanel", () => {
  it("renders empty state when no data is provided", () => {
    const markup = renderToStaticMarkup(
      <DeviationAlertPanel data={[]} currencyDecimals={2} />,
    );

    expect(markup).toContain("Alertas de desviacion");
    expect(markup).toContain(
      "Registra reajustes para detectar desviaciones en el presupuesto.",
    );
  });

  it("renders severity count cards", () => {
    const data = [
      createAlert({ id: "a1", severity: "high" }),
      createAlert({ id: "a2", severity: "high" }),
      createAlert({ id: "a3", severity: "medium" }),
      createAlert({ id: "a4", severity: "low" }),
    ];
    const markup = renderToStaticMarkup(
      <DeviationAlertPanel data={data} currencyDecimals={2} />,
    );

    expect(markup).toContain("2"); // high count
    expect(markup).toContain("1"); // medium count
    expect(markup).toContain("1"); // low count
    expect(markup).toContain("Criticas");
    expect(markup).toContain("Moderadas");
    expect(markup).toContain("Leves");
  });

  it("renders the total alert badge count", () => {
    const data = [
      createAlert({ id: "a1", severity: "high" }),
      createAlert({ id: "a2", severity: "medium" }),
    ];
    const markup = renderToStaticMarkup(
      <DeviationAlertPanel data={data} currencyDecimals={2} />,
    );

    expect(markup).toContain("2 alertas");
  });

  it("renders '1 alerta' for single alert", () => {
    const data = [createAlert()];
    const markup = renderToStaticMarkup(
      <DeviationAlertPanel data={data} currencyDecimals={2} />,
    );

    expect(markup).toContain("1 alerta");
  });

  it("renders project name, budget name, period and formatted deviation amount", () => {
    const data = [
      createAlert({
        projectName: "Colegio Sur",
        budgetName: "Formula Estructuras",
        deviationAmount: 37500,
        deviationPercent: 25,
        period: "3/2026",
        adjustedAmount: 187500,
        originalAmount: 150000,
      }),
    ];
    const markup = renderToStaticMarkup(
      <DeviationAlertPanel data={data} currencyDecimals={2} />,
    );

    expect(markup).toContain("Colegio Sur");
    expect(markup).toContain("Formula Estructuras");
    expect(markup).toContain("Periodo 3/2026");
    expect(markup).toContain("S/ 37,500.00");
    expect(markup).toContain("25%");
  });

  it("renders an upward trend (red) when adjusted > original", () => {
    const data = [
      createAlert({
        adjustedAmount: 200000,
        originalAmount: 150000,
        deviationAmount: 50000,
      }),
    ];
    const markup = renderToStaticMarkup(
      <DeviationAlertPanel data={data} currencyDecimals={2} />,
    );

    expect(markup).toContain("+S/ 50,000.00");
    expect(markup).toContain("bg-rose-50"); // upward trend badge
  });

  it("renders a downward trend (green) when adjusted < original", () => {
    const data = [
      createAlert({
        adjustedAmount: 100000,
        originalAmount: 150000,
        deviationAmount: 50000,
      }),
    ];
    const markup = renderToStaticMarkup(
      <DeviationAlertPanel data={data} currencyDecimals={2} />,
    );

    expect(markup).toContain("-S/ 50,000.00");
    expect(markup).toContain("bg-emerald-50"); // downward trend badge
  });

  it("renders severity badge labels correctly", () => {
    const data = [
      createAlert({ id: "a1", severity: "high" }),
      createAlert({ id: "a2", severity: "medium" }),
      createAlert({ id: "a3", severity: "low" }),
    ];
    const markup = renderToStaticMarkup(
      <DeviationAlertPanel data={data} currencyDecimals={2} />,
    );

    expect(markup).toContain("Critica");
    expect(markup).toContain("Moderada");
    expect(markup).toContain("Leve");
  });

  it("renders link href pointing to polynomial formula adjustment", () => {
    const data = [
      createAlert({
        href: "/budgets/budget-42/polynomial-formula?focus=adjustment",
      }),
    ];
    const markup = renderToStaticMarkup(
      <DeviationAlertPanel data={data} currencyDecimals={2} />,
    );

    expect(markup).toContain('href="/budgets/budget-42/polynomial-formula?focus=adjustment"');
  });

  it("limits visible alerts to 5 and shows truncation message", () => {
    const data = Array.from({ length: 7 }, (_, i) =>
      createAlert({
        id: `adj-${i}`,
        projectName: `Proyecto ${i + 1}`,
        severity: "low",
      }),
    );
    const markup = renderToStaticMarkup(
      <DeviationAlertPanel data={data} currencyDecimals={2} />,
    );

    // Only first 5 should render
    expect(markup).toContain("Proyecto 1");
    expect(markup).toContain("Proyecto 5");
    expect(markup).not.toContain("Proyecto 6");
    expect(markup).not.toContain("Proyecto 7");
    expect(markup).toContain("Mostrando 5 de 7 alertas");
  });

  it("does not show truncation message when 5 or fewer items", () => {
    const data = Array.from({ length: 5 }, (_, i) =>
      createAlert({
        id: `adj-${i}`,
        projectName: `Proyecto ${i + 1}`,
        severity: "low",
      }),
    );
    const markup = renderToStaticMarkup(
      <DeviationAlertPanel data={data} currencyDecimals={2} />,
    );

    expect(markup).not.toContain("Mostrando");
  });
});
