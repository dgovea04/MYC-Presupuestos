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
      expect.objectContaining({ kind: "GENERAL", itemCount: 1, apuCount: 0, items: [expect.objectContaining({ code: "01.01" })] }),
      expect.objectContaining({ kind: "SUB_BUDGET", itemCount: 1, apuCount: 1, items: [expect.objectContaining({ code: "01.01" })] }),
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
});

describe("parseS10ExportSnapshotJson", () => {
  it("parses JSON snapshots with a UTF-8 BOM", () => {
    expect(parseS10ExportSnapshotJson(`\uFEFF${JSON.stringify(snapshot)}`)).toEqual(snapshot);
  });

  it("rejects JSON without S10 snapshot arrays", () => {
    expect(() => parseS10ExportSnapshotJson("{}")).toThrow("El JSON no tiene la estructura esperada");
  });
});
