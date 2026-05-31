import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BudgetsTable } from "@/components/budget/budgets-table";

describe("BudgetsTable", () => {
  it("renders a contextual general expenses template action", () => {
    const markup = renderToStaticMarkup(
      <BudgetsTable
        templateIntent={{
          id: "general-expenses-fixed-workbook",
          label: "Plantilla de gastos generales fijos",
          description: "Abre el desagregado operativo y revisa costos indirectos permanentes.",
        }}
        budgets={[
          {
            id: "budget-1",
            name: "Presupuesto General",
            currency: "PEN",
            totalAmount: 1200,
            updatedAt: "2026-05-30T12:00:00.000Z",
            projectName: "Hospital Norte",
          },
        ]}
      />,
    );

    expect(markup).toContain("Plantilla de gastos generales fijos");
    expect(markup).toContain("Selecciona un presupuesto general");
    expect(markup).toContain('href="/budgets/budget-1/general-expenses?template=general-expenses-fixed-workbook"');
    expect(markup).toContain("Gastos generales");
    expect(markup).toContain('href="/templates?module=GENERAL_EXPENSES&amp;source=WORKBOOK"');
    expect(markup).toContain("Ver plantillas");
    expect(markup).toContain('href="/budgets/budget-1"');
    expect(markup).toContain("Presupuesto");
  });
});
