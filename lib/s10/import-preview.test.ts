import { describe, expect, it } from "vitest";
import { createS10ImportDraftPreview, parseS10ExportSnapshotJson } from "@/lib/s10/import-preview";
import type { S10ExportSnapshot } from "@/lib/s10/import-mapper";

const snapshot: S10ExportSnapshot = {
  presupuestos: [
    {
      CodPresupuesto: "0201003",
      Descripcion: "OBRA S10",
      Moneda: "S/.",
      CostoOferta1: 100,
    },
  ],
  subpresupuestos: [
    {
      CodPresupuesto: "0201003",
      CodSubpresupuesto: "001",
      Descripcion: "ESTRUCTURAS",
    },
  ],
  partidas: [
    {
      CodPresupuesto: "0201003",
      CodSubpresupuesto: "001",
      CodPartida: "01",
      Descripcion: "EXCAVACION",
      CodUnidad: "601",
      Precio1: 12,
      RendimientoMO: 1,
      RendimientoEQ: 1,
    },
  ],
  subpresupuestoDetalles: [
    {
      CodPresupuesto: "0201003",
      CodSubpresupuesto: "001",
      Item: "01.01",
      Orden: "0001",
      Secuencial: 1,
      CodPartida: "01",
      CodPresupuestoPartida: "0201003",
      Descripcion: "EXCAVACION",
      Unidad: "m3",
      Metrado: 4,
      Precio1: 12,
      Parcial1: 48,
    },
  ],
  pieSubpresupuestos: [
    {
      CodPresupuesto: "0201003",
      CodSubpresupuesto: "001",
      Linea: "01",
      Descripcion: "COSTO DIRECTO",
      Variable: "CD",
      Formula: "CD",
    },
    {
      CodPresupuesto: "0201003",
      CodSubpresupuesto: "001",
      Linea: "02",
      Descripcion: "GASTOS GENERALES",
      Variable: "PGG",
      Formula: "PGG",
    },
    {
      CodPresupuesto: "0201003",
      CodSubpresupuesto: "001",
      Linea: "03",
      Descripcion: "UTILIDAD",
      Variable: "UTI",
      Formula: "UTI",
    },
    {
      CodPresupuesto: "0201003",
      CodSubpresupuesto: "001",
      Linea: "04",
      Descripcion: "SUBTOTAL",
      Variable: "ST",
      Formula: "ST",
    },
    {
      CodPresupuesto: "0201003",
      CodSubpresupuesto: "001",
      Linea: "05",
      Descripcion: "IGV",
      Variable: "IGV",
      Formula: "IGV",
    },
    {
      CodPresupuesto: "0201003",
      CodSubpresupuesto: "001",
      Linea: "06",
      Descripcion: "TOTAL",
      Variable: "P_T",
      Formula: "P_T",
    },
  ],
  resultadoPieSubpresupuestos: [
    {
      CodPresupuesto: "0201003",
      CodSubpresupuesto: "001",
      Linea: "01",
      Descripcion: "COSTO DIRECTO",
      Formula: "CD",
      Valor1: 48,
    },
    {
      CodPresupuesto: "0201003",
      CodSubpresupuesto: "001",
      Linea: "02",
      Descripcion: "GASTOS GENERALES",
      Formula: "PGG",
      Valor1: 4.8,
    },
    {
      CodPresupuesto: "0201003",
      CodSubpresupuesto: "001",
      Linea: "03",
      Descripcion: "UTILIDAD",
      Formula: "UTI",
      Valor1: 2.4,
    },
    {
      CodPresupuesto: "0201003",
      CodSubpresupuesto: "001",
      Linea: "04",
      Descripcion: "SUBTOTAL",
      Formula: "ST",
      Valor1: 55.2,
    },
    {
      CodPresupuesto: "0201003",
      CodSubpresupuesto: "001",
      Linea: "05",
      Descripcion: "IGV",
      Formula: "IGV",
      Valor1: 9.936,
    },
    {
      CodPresupuesto: "0201003",
      CodSubpresupuesto: "001",
      Linea: "06",
      Descripcion: "TOTAL",
      Formula: "P_T",
      Valor1: 65.136,
    },
  ],
  apuDetalles: [
    {
      CodPresupuesto: "0201003",
      CodSubpresupuesto: "001",
      CodPartida: "01",
      CodInsumo: "0147010001",
      Descripcion: "PEON",
      CodUnidad: "906",
      CodIndiceUnificado: "47",
      Cantidad: 1,
      Precio1: 12,
      Parcial1: 12,
      Tipo: "MO",
    },
  ],
};

describe("createS10ImportDraftPreview", () => {
  it("summarizes an import draft without returning the full imported graph", () => {
    const preview = createS10ImportDraftPreview(snapshot, { sampleItemLimit: 1 });

    expect(preview).toMatchObject({
      source: "S10",
      sourceBudgetCode: "0201003",
      projectName: "OBRA S10",
      resourceCount: 1,
      resourcesByCategory: {
        LABOR: 1,
        MATERIAL: 0,
        EQUIPMENT: 0,
        TOOLS: 0,
        SUBCONTRACT: 0,
      },
    });
    expect(preview.budgets).toEqual([
      expect.objectContaining({
        kind: "GENERAL",
        itemCount: 1,
        apuCount: 0,
        generalExpensesRate: 0.1,
        utilityRate: 0.05,
        igvRate: 0.18,
        footerRows: expect.arrayContaining([
          expect.objectContaining({ variable: "PGG", description: "GASTOS GENERALES", manualValue: 4.8 }),
          expect.objectContaining({ variable: "IGV", description: "IGV", manualValue: 9.936 }),
          expect.objectContaining({ variable: "P_T", description: "TOTAL", manualValue: 65.136 }),
        ]),
        items: [expect.objectContaining({ code: "01.01" })],
      }),
      expect.objectContaining({
        kind: "SUB_BUDGET",
        itemCount: 1,
        apuCount: 1,
        generalExpensesRate: 0.1,
        utilityRate: 0.05,
        igvRate: 0.18,
        footerRows: expect.arrayContaining([
          expect.objectContaining({ variable: "PGG", description: "GASTOS GENERALES", manualValue: 4.8 }),
          expect.objectContaining({ variable: "IGV", description: "IGV", manualValue: 9.936 }),
          expect.objectContaining({ variable: "P_T", description: "TOTAL", manualValue: 65.136 }),
        ]),
        items: [expect.objectContaining({ code: "01.01" })],
      }),
    ]);
    expect(preview.sampleItems).toEqual([
      expect.objectContaining({
        code: "01.01",
        unit: "m3",
        quantity: 4,
        partial: 48,
        apuResourceCount: 1,
        apuStatus: "OK",
        calculatedApuUnitPrice: 12,
        unitPriceDifference: 0,
      }),
    ]);
  });

  it("includes hierarchy rows when the import snapshot carries budget levels", () => {
    const preview = createS10ImportDraftPreview(
      {
        ...snapshot,
        budgetLevels: [
          {
            CodPresupuesto: "0201003",
            CodSubpresupuesto: "001",
            Codigo: "01",
            Descripcion: "ESTRUCTURAS",
            Nivel: 1,
            Tipo: "TITLE",
            SortOrder: 1,
          },
          {
            CodPresupuesto: "0201003",
            CodSubpresupuesto: "001",
            Codigo: "01.01",
            Descripcion: "CONCRETO SIMPLE",
            Nivel: 2,
            Tipo: "SUBTITLE",
            ParentCodigo: "01",
            SortOrder: 2,
          },
        ],
        subpresupuestoDetalles: [
          {
            ...snapshot.subpresupuestoDetalles![0],
            CodPresupuesto: "0201003",
            CodSubpresupuesto: "001",
            Descripcion: "EXCAVACION",
            Item: "01.01.01",
            CodPartida: "01",
            LevelCode: "01.01",
          },
        ],
      },
      { sampleItemLimit: 1 },
    );

    const subBudget = preview.budgets.find((budget) => budget.kind === "SUB_BUDGET");
    expect(subBudget?.rows).toEqual([
      expect.objectContaining({ kind: "LEVEL", code: "01", description: "ESTRUCTURAS", depth: 1 }),
      expect.objectContaining({ kind: "LEVEL", code: "01.01", description: "CONCRETO SIMPLE", depth: 2 }),
      expect.objectContaining({ kind: "ITEM", code: "01.01.01", description: "EXCAVACION", levelCode: "01.01", depth: 3 }),
    ]);
  });
});

describe("parseS10ExportSnapshotJson", () => {
  it("parses JSON snapshots with a UTF-8 BOM", () => {
    expect(parseS10ExportSnapshotJson(`\uFEFF${JSON.stringify(snapshot)}`)).toEqual(snapshot);
  });

  it("rejects JSON without S10 snapshot arrays", () => {
    expect(() => parseS10ExportSnapshotJson("{}")).toThrow("El JSON no tiene la estructura esperada");
  });
});
