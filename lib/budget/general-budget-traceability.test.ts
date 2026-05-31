import { describe, expect, it } from "vitest";
import { buildGeneralBudgetTraceability } from "@/lib/budget/general-budget-traceability";

describe("buildGeneralBudgetTraceability", () => {
  it("marks a general budget as fully traceable when every sub budget has detail", () => {
    const traceability = buildGeneralBudgetTraceability({
      subBudgetCount: 2,
      detailCount: 2,
      latestUpdatedAt: "2026-05-21T10:00:00.000Z",
    });

    expect(traceability).toEqual({
      sourceLabel: "2 Sub Presupuestos conectados",
      coverageLabel: "Detalle completo para recalculo",
      calculationLabel: "Partidas + APU + tasas del presupuesto",
      latestUpdatedAt: "2026-05-21T10:00:00.000Z",
      warning: null,
    });
  });

  it("warns when the consolidated detail is incomplete", () => {
    const traceability = buildGeneralBudgetTraceability({
      subBudgetCount: 3,
      detailCount: 2,
      latestUpdatedAt: null,
    });

    expect(traceability.coverageLabel).toBe("Detalle pendiente de completar");
    expect(traceability.warning).toBe("El consolidado se actualiza mejor cuando todos los Sub Presupuestos tienen detalle disponible.");
  });
});
