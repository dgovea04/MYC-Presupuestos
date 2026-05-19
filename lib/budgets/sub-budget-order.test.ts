import { describe, expect, it } from "vitest";
import { orderSubBudgetsBySpecialty } from "@/lib/budgets/sub-budget-order";

describe("orderSubBudgetsBySpecialty", () => {
  it("keeps the known specialties first and preserves extra sub budgets", () => {
    const budgets = [
      { id: "1", name: "Arquitectura" },
      { id: "2", name: "Obras Provisionales" },
      { id: "3", name: "Instalaciones Eléctricas" },
      { id: "4", name: "Estructuras" },
    ];

    expect(orderSubBudgetsBySpecialty(budgets).map((budget) => budget.name)).toEqual([
      "Estructuras",
      "Arquitectura",
      "Instalaciones Eléctricas",
      "Obras Provisionales",
    ]);
  });

  it("treats accented and unaccented electrical names as the same specialty", () => {
    const budgets = [
      { id: "1", name: "Instalaciones Electricas" },
      { id: "2", name: "Arquitectura" },
    ];

    expect(orderSubBudgetsBySpecialty(budgets).map((budget) => budget.name)).toEqual([
      "Arquitectura",
      "Instalaciones Electricas",
    ]);
  });
});
