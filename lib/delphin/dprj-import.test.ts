import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDelphinDprjToS10Snapshot } from "@/lib/delphin/dprj-import";
import { createMycImportDraftFromS10 } from "@/lib/s10/import-mapper";

describe("parseDelphinDprjToS10Snapshot", () => {
  it("maps a Delphin Express DPRJ export into an importable MYC draft", () => {
    const buffer = readFileSync(resolve("presupuesto-ejemplo/de/PROYECTOdelfin.dprj"));
    const snapshot = parseDelphinDprjToS10Snapshot({
      buffer,
      fileName: "PROYECTOdelfin.dprj",
    });
    const draft = createMycImportDraftFromS10(snapshot, { sourceSystem: "DELPHIN" });

    expect(snapshot.presupuestos).toHaveLength(1);
    expect(snapshot.subpresupuestos[0]).toMatchObject({
      Descripcion: "ESTRUCTURAS.",
    });
    expect(snapshot.partidas.length).toBeGreaterThanOrEqual(3);
    expect(snapshot.apuDetalles.length).toBeGreaterThan(0);
    expect(draft.source).toBe("DELPHIN");
    expect(draft.budgets.length).toBeGreaterThanOrEqual(2);

    const estructuras = draft.budgets.find((budget) => budget.kind === "SUB_BUDGET" && budget.name === "ESTRUCTURAS.");
    expect(estructuras?.levels).toEqual([
      expect.objectContaining({ code: "OE.2.1", name: "MOVIMIENTO DE TIERRAS", type: "TITLE" }),
      expect.objectContaining({ code: "OE.2.1.1", name: "NIVELACIÓN DE TERRENO", type: "SUBTITLE" }),
      expect.objectContaining({ code: "OE.2.1.2", name: "EXCAVACIONES", type: "SUBTITLE" }),
      expect.objectContaining({ code: "OE.2.1.3", name: "CORTES", type: "SUBTITLE" }),
      expect.objectContaining({ code: "OE.2.1.4", name: "RELLENOS", type: "SUBTITLE" }),
    ]);
    expect(estructuras?.items).toEqual([
      expect.objectContaining({
        code: "OE.2.1.1.1",
        description: "Acarreo de lladrillo pastelero",
        unit: "und",
        quantity: 20,
        unitPrice: 0.01,
      }),
      expect.objectContaining({
        code: "OE.2.1.2.1",
        description: "Concreto f'c=140 kg/cm2, para columna (Preparación y vaciado)",
        unit: "m3",
        quantity: 10,
        unitPrice: 421.14,
      }),
      expect.objectContaining({
        code: "OE.2.1.4.1",
        description: "Desencofrado de columna típica",
        unit: "m2",
        quantity: 40,
        unitPrice: 0.63,
      }),
    ]);
    expect(draft.resources.some((resource) => resource.description === "Peón")).toBe(true);
    expect(draft.itemMetadata.filter((metadata) => metadata.apuStatus !== "OK")).toHaveLength(0);
  }, 30000);
  it("keeps Delphin budgets as sub budgets when they contain their own title tree", () => {
    const buffer = readFileSync(resolve("presupuesto-ejemplo/de/Hospital.dprj"));
    const snapshot = parseDelphinDprjToS10Snapshot({
      buffer,
      fileName: "Hospital.dprj",
    });

    expect(snapshot.subpresupuestos).toEqual([
      expect.objectContaining({ CodSubpresupuesto: "1", Descripcion: "ARQUITECTURA" }),
      expect.objectContaining({ CodSubpresupuesto: "2", Descripcion: "ESTRUCTURAS" }),
      expect.objectContaining({ CodSubpresupuesto: "3", Descripcion: "INSTALACIONES SANITARIAS" }),
      expect.objectContaining({ CodSubpresupuesto: "4", Descripcion: "INSTALACIONES ELECTROMECANICAS" }),
    ]);
    expect(snapshot.budgetLevels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          CodSubpresupuesto: "1",
          Codigo: "1.1",
          Descripcion: "MUROS DE LADRILLO KING KONG DE ARCILLA ( A MAQUINA O ARTESANALMENTE )",
          Tipo: "TITLE",
          ParentCodigo: null,
        }),
        expect.objectContaining({
          CodSubpresupuesto: "1",
          Codigo: "1.6.1",
          Descripcion: "CONTRAPISOS",
          Tipo: "SUBTITLE",
          ParentCodigo: "1.6",
        }),
        expect.objectContaining({
          CodSubpresupuesto: "2",
          Codigo: "2.1",
          Descripcion: "OBRAS PROVISIONALES",
          Tipo: "TITLE",
          ParentCodigo: null,
        }),
      ]),
    );
    expect(snapshot.subpresupuestoDetalles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          CodSubpresupuesto: "1",
          Item: "1.1.1",
          LevelCode: "1.1",
        }),
      ]),
    );

    const draft = createMycImportDraftFromS10(snapshot, { sourceSystem: "DELPHIN" });
    const arquitectura = draft.budgets.find((budget) => budget.kind === "SUB_BUDGET" && budget.name === "ARQUITECTURA");
    const porcelanato = arquitectura?.items.find((item) => item.description === "PISO DE PORCELANATO 40x40 CM");
    const porcelanatoMetadata = draft.itemMetadata.find((metadata) => metadata.budgetItemId === porcelanato?.id);
    const aluzinc = arquitectura?.items.find((item) => item.description === "REVESTIMIENTO DE FACHADA CON ALUZINC");
    const aluzincMetadata = draft.itemMetadata.find((metadata) => metadata.budgetItemId === aluzinc?.id);
    const electromecanicas = draft.budgets.find((budget) => budget.kind === "SUB_BUDGET" && budget.name === "INSTALACIONES ELECTROMECANICAS");
    const drenajes = electromecanicas?.items.filter((item) => item.description === "INSTALACION DE DRENAJE") ?? [];

    expect(porcelanato?.apu?.resources).toHaveLength(8);
    expect(porcelanatoMetadata).toMatchObject({
      apuStatus: "OK",
      s10UnitPrice: 89.36,
      calculatedApuUnitPrice: 89.36,
      unitPriceDifference: 0,
    });
    expect(aluzinc?.apu?.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: "ACCESORIOS DE FIJACION",
          unit: "%",
          quantity: 20,
          unitPrice: 232.76,
          subtotal: 46.55,
        }),
      ]),
    );
    expect(aluzincMetadata).toMatchObject({
      apuStatus: "OK",
      s10UnitPrice: 345.48,
      calculatedApuUnitPrice: 345.48,
      unitPriceDifference: 0,
    });
    expect(drenajes).toHaveLength(3);
    for (const drenaje of drenajes) {
      const metadata = draft.itemMetadata.find((entry) => entry.budgetItemId === drenaje.id);
      expect(drenaje.apu?.resources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            description: "HERRAMIENTAS MANUALES",
            unit: "%MO",
            quantity: 3,
            unitPrice: 20.95,
            subtotal: 0.63,
          }),
        ]),
      );
      expect(metadata).toMatchObject({
        apuStatus: "OK",
        s10UnitPrice: 73.96,
        calculatedApuUnitPrice: 73.96,
        unitPriceDifference: 0,
      });
    }
  }, 30000);
});
