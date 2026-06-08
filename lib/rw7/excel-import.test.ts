import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRw7WorkbookToS10Snapshot } from "@/lib/rw7/excel-import";
import { createMycImportDraftFromS10 } from "@/lib/s10/import-mapper";

describe("parseRw7WorkbookToS10Snapshot", () => {
  it("maps a Sistemas RW7 Excel export into an importable MYC draft", async () => {
    const buffer = readFileSync(resolve("presupuesto-ejemplo/rw7/Centro-Educativo-en-RW7o.xlsx"));
    const snapshot = await parseRw7WorkbookToS10Snapshot({
      buffer,
      fileName: "Centro-Educativo-en-RW7o.xlsx",
    });
    const draft = createMycImportDraftFromS10(snapshot, { sourceSystem: "RW7" });

    expect(snapshot.presupuestos).toHaveLength(1);
    expect(snapshot.partidas).toHaveLength(94);
    expect(snapshot.subpresupuestoDetalles).toHaveLength(94);
    expect(snapshot.apuDetalles).toHaveLength(646);
    expect(snapshot.resultadoPieSubpresupuestos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          CodSubpresupuesto: "001",
          Descripcion: "GASTOS GENERALES (15% CD)",
          Formula: "PGG",
          Valor1: 52904.56,
        }),
        expect.objectContaining({
          CodSubpresupuesto: "001",
          Descripcion: "UTILIDAD (10% CD)",
          Formula: "UTI",
          Valor1: 35269.71,
        }),
        expect.objectContaining({
          CodSubpresupuesto: "001",
          Descripcion: "IMPUESTO (IGV) (18%ST)",
          Formula: "IGV",
          Valor1: 79356.84,
        }),
        expect.objectContaining({
          CodSubpresupuesto: "999",
          Descripcion: "TOTAL",
          Formula: "P_T",
          Valor1: 533233.89,
        }),
      ]),
    );
    expect(draft.source).toBe("RW7");
    expect(draft.resources.length).toBeGreaterThan(150);
    expect(snapshot.subpresupuestos[0]).toMatchObject({
      CodSubpresupuesto: "001",
      Descripcion: "Centro Educativo en RW7o",
    });
    expect(draft.budgets).toHaveLength(2);
    const budget = draft.budgets.find((entry) => entry.kind === "SUB_BUDGET" && entry.name === "Centro Educativo en RW7o");
    expect(budget?.items[0]).toMatchObject({
      code: "01.01.01",
      description: "TRAZO Y REPLANTEO INICIAL",
      unit: "m2",
      quantity: 200,
      unitPrice: 3.02,
    });
    expect(budget).toMatchObject({
      generalExpensesRate: 0.15,
      utilityRate: 0.1,
      igvRate: 0.18,
    });
    expect(draft.budgets.find((budget) => budget.kind === "GENERAL")).toMatchObject({
      generalExpensesRate: 0.15,
      utilityRate: 0.1,
      igvRate: 0.18,
    });

    const budgetFooter = draft.budgetFooterRows.find((footerRows) => footerRows.budgetId === budget?.id);
    expect(budgetFooter?.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ variable: "PGG", manualValue: 52904.56 }),
        expect.objectContaining({ variable: "UTI", manualValue: 35269.71 }),
        expect.objectContaining({ variable: "IGV", manualValue: 79356.84 }),
        expect.objectContaining({ variable: "P_T", manualValue: 533233.89 }),
      ]),
    );

    const estructuras = budget?.levels.find((level) => level.code === "01");
    const concretoSimple = budget?.levels.find((level) => level.code === "01.05");
    const solados = budget?.levels.find((level) => level.code === "01.05.01");
    const soladoItem = budget?.items.find((item) => item.code === "01.05.01.01");

    expect(estructuras).toMatchObject({
      name: "ESTRUCTURAS",
      type: "TITLE",
      parentId: null,
    });
    expect(concretoSimple).toMatchObject({
      name: "CONCRETO SIMPLE",
      type: "SUBTITLE",
      parentId: estructuras?.id,
    });
    expect(solados).toMatchObject({
      name: "SOLADOS",
      type: "SUBTITLE",
      parentId: concretoSimple?.id,
    });
    expect(soladoItem).toMatchObject({
      description: "SOLADO e=3\"",
      levelId: solados?.id,
    });
    expect(draft.itemMetadata.filter((metadata) => metadata.apuStatus !== "OK")).toHaveLength(0);
  }, 20000);

  it("uses RW7 T/STn markers as the hierarchy source for Departamentos", async () => {
    const buffer = readFileSync(resolve("presupuesto-ejemplo/rw7/Departamentos-en-RW7o.xlsx"));
    const snapshot = await parseRw7WorkbookToS10Snapshot({
      buffer,
      fileName: "Departamentos-en-RW7o.xlsx",
    });
    const draft = createMycImportDraftFromS10(snapshot, { sourceSystem: "RW7" });

    expect(snapshot.subpresupuestos).toEqual([
      expect.objectContaining({
        CodSubpresupuesto: "001",
        Descripcion: "Departamentos en RW7o",
      }),
    ]);
    expect(snapshot.partidas).toHaveLength(320);
    expect(snapshot.budgetLevels).toHaveLength(143);

    const budget = draft.budgets.find((entry) => entry.kind === "SUB_BUDGET");
    const obrasProvisionales = budget?.levels.find((level) => level.code === "01");
    const construcciones = budget?.levels.find((level) => level.code === "01.01.01");
    const instalaciones = budget?.levels.find((level) => level.code === "01.01.02");
    const agua = budget?.levels.find((level) => level.code === "01.01.02.01");
    const estructuras = budget?.levels.find((level) => level.code === "02");
    const aguaItem = budget?.items.find((item) => item.code === "01.01.02.01.01");

    expect(obrasProvisionales).toMatchObject({
      name: "OBRAS PROVISIONALES, TRABAJOS PRELIMINARES, SEGURIDAD Y SALUD",
      type: "TITLE",
      parentId: null,
    });
    expect(construcciones).toMatchObject({
      name: "CONSTRUCCIONES PROVISIONALES",
      type: "SUBTITLE",
      parentId: budget?.levels.find((level) => level.code === "01.01")?.id,
    });
    expect(instalaciones).toMatchObject({
      name: "INSTALACIONES PROVISIONALES",
      type: "SUBTITLE",
      parentId: budget?.levels.find((level) => level.code === "01.01")?.id,
    });
    expect(agua).toMatchObject({
      name: "AGUA PARA LA CONSTRUCCION",
      type: "SUBTITLE",
      parentId: instalaciones?.id,
    });
    expect(estructuras).toMatchObject({
      name: "ESTRUCTURAS",
      type: "TITLE",
      parentId: null,
    });
    expect(aguaItem).toMatchObject({
      description: "CONSUMO DE AGUA POTABLE DURANTE LA OBRA",
      levelId: agua?.id,
    });

    const excavacionMasiva = budget?.items.find((item) => item.code === "02.01.01.01");
    const excavacionMetadata = draft.itemMetadata.find((metadata) => metadata.budgetItemId === excavacionMasiva?.id);
    const herramientas = excavacionMasiva?.apu?.resources.find((resource) => resource.unit === "%MO");

    expect(excavacionMasiva).toMatchObject({
      description: "EXCAVACION MASIVA A MAQUINA EN TERRENO NORMAL\"C\"/RETRO .5Y3",
      unitPrice: 21.71,
      apu: expect.objectContaining({
        totalUnitCost: 21.71,
      }),
    });
    expect(excavacionMetadata).toMatchObject({
      apuStatus: "OK",
      calculatedApuUnitPrice: 21.71,
      unitPriceDifference: 0,
    });
    expect(herramientas).toMatchObject({
      quantity: 1,
      unitPrice: 3.66,
      subtotal: 0.04,
    });

    const concretoVigas = budget?.items.find((item) => item.code === "02.03.07.01");
    const concretoMetadata = draft.itemMetadata.find((metadata) => metadata.budgetItemId === concretoVigas?.id);
    const reglaAluminio = concretoVigas?.apu?.resources.find((resource) => resource.description === "REGLA DE ALUMINIO DE 1 1/4\" X 4\" X 6 M");
    const herramientasConcreto = concretoVigas?.apu?.resources.find((resource) => resource.description === "HERRAMIENTAS MANUALES");

    expect(concretoVigas).toMatchObject({
      description: "CONCRETO PREMEZCLADO EN VIGAS F'C=210 KG/CM2",
      unitPrice: 509.16,
      apu: expect.objectContaining({
        totalUnitCost: 509.16,
      }),
    });
    expect(concretoMetadata).toMatchObject({
      apuStatus: "OK",
      calculatedApuUnitPrice: 509.16,
      unitPriceDifference: 0,
    });
    expect(herramientasConcreto).toMatchObject({
      unit: "%MO",
      quantity: 5,
      subtotal: 1.55,
    });
    expect(reglaAluminio).toMatchObject({
      unit: "u",
      quantity: 0.5,
      unitPrice: 29.98,
      subtotal: 14.99,
    });
  }, 30000);
});
