import { describe, expect, it } from "vitest";
import { applyCatalogPartidaToDraftItem } from "@/lib/budgets/catalog-partida-application";
import type { BudgetItemRecord } from "@/types/budget";
import type { CatalogPartidaRecord } from "@/types/partida";

describe("applyCatalogPartidaToDraftItem", () => {
  it("links subpartida rows to catalog partidas even when the subpartida has no APU", () => {
    const aguaPartida: CatalogPartidaRecord = {
      id: "catalog-agua",
      description: "AGUA PARA LA OBRA",
      unit: "GLB",
      unitPrice: 15.09,
      currency: "PEN",
      performance: 1,
      apuRows: [],
    };
    const parentPartida: CatalogPartidaRecord = {
      id: "catalog-perfilado",
      description: "PERFILADO Y COMPACTADO EN ZONAS DE CORTE",
      unit: "M2",
      unitPrice: 15.09,
      currency: "PEN",
      performance: 1,
      apuRows: [
        {
          id: "row-agua",
          catalogPartidaId: "catalog-perfilado",
          resourceId: null,
          catalogSubpartidaId: null,
          description: "AGUA PARA LA OBRA",
          unit: "GLB",
          crew: null,
          quantity: 1,
          unitPrice: 15.09,
          subtotal: 15.09,
          resourceType: "SUBPARTIDA",
          groupLabel: "Sub Partidas",
          sortOrder: 0,
        },
      ],
    };

    const result = applyCatalogPartidaToDraftItem({
      item: createBudgetItem(),
      partida: parentPartida,
      catalogPartidas: [parentPartida, aguaPartida],
      resourcesById: new Map(),
      resourcesByDescriptionUnit: new Map(),
    });

    expect(result.apu?.resources).toEqual([
      expect.objectContaining({
        resourceType: "SUBPARTIDA",
        catalogPartidaId: "catalog-agua",
        catalogPartida: expect.objectContaining({
          description: "AGUA PARA LA OBRA",
          apuRows: [],
        }),
        nestedApuRows: [],
      }),
    ]);
  });

  it("preserves subpartida row description when there is no matching catalog partida", () => {
    const parentPartida: CatalogPartidaRecord = {
      id: "catalog-perfilado",
      description: "PERFILADO Y COMPACTADO EN ZONAS DE CORTE",
      unit: "M2",
      unitPrice: 15.09,
      currency: "PEN",
      performance: 1,
      apuRows: [
        {
          id: "row-agua",
          catalogPartidaId: "catalog-perfilado",
          resourceId: null,
          catalogSubpartidaId: null,
          description: "AGUA PARA LA OBRA",
          unit: "M3",
          crew: null,
          quantity: 1,
          unitPrice: 15.09,
          subtotal: 15.09,
          resourceType: "SUBPARTIDA",
          groupLabel: "Sub Partidas",
          sortOrder: 0,
        },
      ],
    };

    const result = applyCatalogPartidaToDraftItem({
      item: createBudgetItem(),
      partida: parentPartida,
      catalogPartidas: [parentPartida],
      resourcesById: new Map(),
      resourcesByDescriptionUnit: new Map(),
    });

    expect(result.apu?.resources).toEqual([
      expect.objectContaining({
        resourceType: "SUBPARTIDA",
        catalogPartidaId: null,
        description: "AGUA PARA LA OBRA",
        unit: "M3",
        nestedApuRows: [],
      }),
    ]);
  });
});

function createBudgetItem(): BudgetItemRecord {
  return {
    id: "item-1",
    budgetId: "budget-1",
    levelId: null,
    code: "01.01",
    description: "",
    unit: "",
    quantity: 1,
    unitPrice: 0,
    partial: 0,
    sortOrder: 0,
    apu: null,
  };
}
