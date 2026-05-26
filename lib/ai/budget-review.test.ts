import { describe, expect, it } from "vitest";
import { buildAiBudgetReviewSummary } from "@/lib/ai/budget-review";
import type { BudgetItemRecord } from "@/types/budget";

function createItem(patch: Partial<BudgetItemRecord>): BudgetItemRecord {
  return {
    id: patch.id ?? "item-1",
    budgetId: "budget-1",
    levelId: null,
    code: patch.code ?? "",
    description: patch.description ?? "Partida demo",
    unit: patch.unit ?? "m2",
    quantity: patch.quantity ?? 1,
    unitPrice: patch.unitPrice ?? 10,
    partial: patch.partial ?? (patch.quantity ?? 1) * (patch.unitPrice ?? 10),
    sortOrder: patch.sortOrder ?? 1,
    apu: patch.apu ?? null,
  };
}

describe("AI budget review summary", () => {
  it("builds a compact technical review context with duplicate, unit, quantity and cost signals", () => {
    const summary = buildAiBudgetReviewSummary({
      budgetName: "Estructuras",
      currency: "PEN",
      items: [
        createItem({
          id: "item-1",
          code: "01.01",
          description: "Concreto f'c=210 kg/cm2",
          unit: "m3",
          quantity: 12,
          unitPrice: 420,
          partial: 5040,
          sortOrder: 1,
        }),
        createItem({
          id: "item-2",
          code: "01.02",
          description: "concreto fc 210 kg cm2",
          unit: "m2",
          quantity: 0,
          unitPrice: 420,
          partial: 0,
          sortOrder: 2,
        }),
        createItem({
          id: "item-3",
          code: "01.03",
          description: "Acero corrugado fy=4200",
          unit: "glb",
          quantity: 2,
          unitPrice: 8800,
          partial: 17600,
          sortOrder: 3,
        }),
      ],
      totalDirectCost: 22640,
    });

    expect(summary).toContain("Presupuesto: Estructuras");
    expect(summary).toContain("Moneda: PEN");
    expect(summary).toContain("Total costo directo: 22640.00");
    expect(summary).toContain("item-1 <-> item-2");
    expect(summary).toContain("Unidades poco especificas o sospechosas");
    expect(summary).toContain("Metrados no positivos");
    expect(summary).toContain("Costos unitarios fuera de rango interno");
    expect(summary).toContain("01.01 | Concreto f'c=210 kg/cm2 | m3 | metrado 12.000 | PU 420.00 | parcial 5040.00");
  });
});
