import { describe, expect, it } from "vitest";
import { getProjectOtherSections } from "@/lib/projects/other-sections";

describe("getProjectOtherSections", () => {
  it("returns the functional budget sections in the expected order", () => {
    expect(getProjectOtherSections("budget-123")).toEqual([
      {
        title: "Lista de insumos",
        detail: "Consolidado funcional de insumos derivado desde los APUs del presupuesto general del proyecto.",
        href: "/budgets/budget-123/resources",
      },
      {
        title: "Gastos generales",
        detail: "Gestion operativa persistente de gastos generales conectada al presupuesto general del proyecto.",
        href: "/budgets/budget-123/general-expenses",
      },
      {
        title: "Pie de presupuesto",
        detail: "Seccion base del presupuesto general para observaciones, alcances y cierre documental.",
        href: "/budgets/budget-123/footer",
      },
      {
        title: "Formula polinomica",
        detail: "Acceso a la vista base de formula polinomica dentro del flujo funcional del presupuesto general.",
        href: "/budgets/budget-123/polynomial-formula",
      },
      {
        title: "Programacion de obra",
        detail: "Cronograma valorizado consolidado, calendario de insumos y curva S del presupuesto general.",
        href: "/budgets/budget-123/work-schedule",
      },
    ]);
  });

  it("returns no functional sections without a general budget", () => {
    expect(getProjectOtherSections(null)).toEqual([]);
  });
});
