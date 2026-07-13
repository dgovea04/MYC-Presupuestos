import { describe, expect, it } from "vitest";
import { resolveProjectGeneralBudget } from "@/lib/projects/general-budget";

describe("resolveProjectGeneralBudget", () => {
  it("prefers the named general budget when available", () => {
    expect(
      resolveProjectGeneralBudget([
        { id: "sub-1", kind: "SUB_BUDGET", parentBudgetId: "general-1", name: "Estructuras" },
        { id: "general-1", kind: "GENERAL", parentBudgetId: null, name: "Presupuesto General" },
      ]),
    ).toEqual({ id: "general-1", kind: "GENERAL", parentBudgetId: null, name: "Presupuesto General" });
  });

  it("falls back to any general budget before using the root legacy budget", () => {
    expect(
      resolveProjectGeneralBudget([
        { id: "legacy-root", kind: "SUB_BUDGET", parentBudgetId: null, name: "Raiz legacy" },
        { id: "general-2", kind: "GENERAL", parentBudgetId: null, name: "Consolidado" },
      ]),
    ).toEqual({ id: "general-2", kind: "GENERAL", parentBudgetId: null, name: "Consolidado" });
  });

  it("falls back to a root budget for legacy projects without GENERAL kind", () => {
    expect(
      resolveProjectGeneralBudget([
        { id: "legacy-root", kind: "SUB_BUDGET", parentBudgetId: null, name: "Raiz legacy" },
        { id: "sub-1", kind: "SUB_BUDGET", parentBudgetId: "legacy-root", name: "Arquitectura" },
      ]),
    ).toEqual({ id: "legacy-root", kind: "SUB_BUDGET", parentBudgetId: null, name: "Raiz legacy" });
  });

  it("returns null when the project has no budgets", () => {
    expect(resolveProjectGeneralBudget([])).toBeNull();
  });
});
