import { describe, expect, it } from "vitest";

import { createPdfAiImportDraftFromText } from "./import-preview";

describe("pdf import preview", () => {
  it("parses flattened rows from generated digital PDF text without AI", () => {
    const draft = createPdfAiImportDraftFromText({
      files: [
        {
          id: "file-generated-budget",
          fileName: "Presupuesto.pdf",
          role: "BUDGET",
          text: "Pagina 1:\nPRESUPUESTO ITEM PARTIDA UNIDAD METRADO CU PARCIAL TRABAJOS PRELIMINARES 1 3,789,769.42 MOVILIZACION Y DESMOVILIZACION DE EQUIPOS 1.1 GLB 1.00 910,909.61 910,909.61 TOPOGRAFIA Y GEOREFERENCIACION 1.2 KM 48.94 2,136.38 104,554.44",
        },
      ],
    });

    expect(draft.budgets[0]?.items).toHaveLength(2);
    expect(draft.budgets[0]?.items[0]).toMatchObject({
      code: "1.1",
      description: "MOVILIZACION Y DESMOVILIZACION DE EQUIPOS",
      unit: "GLB",
      quantity: "1.00",
      unitPrice: "910909.61",
      partial: "910909.61",
    });
  });

  it("creates title and subtitle levels and links detail items to them", () => {
    const draft = createPdfAiImportDraftFromText({
      files: [
        {
          id: "file-generated-budget-levels",
          fileName: "Presupuesto.pdf",
          role: "BUDGET",
          text: "Pagina 1:\nPROTECCION AMBIENTAL 8 6,728,769.76 PROGRAMA DE CIERRE DE OBRA 8.1 5,973,187.72 RETIRO Y ALMACENAMIENTO DE TOP SOIL 8.1.1 M2 424,410.34 2.00 848,820.68",
        },
      ],
    });

    expect(draft.budgets[0]?.levels).toEqual([
      expect.objectContaining({ code: "8", name: "PROTECCION AMBIENTAL", type: "TITLE" }),
      expect.objectContaining({ code: "8.1", name: "PROGRAMA DE CIERRE DE OBRA", type: "SUBTITLE", parentId: expect.stringContaining("level-8") }),
    ]);
    expect(draft.budgets[0]?.items[0]).toMatchObject({ code: "8.1.1", levelId: expect.stringContaining("level-8-1") });
  });

  it("preserves punctuation, embedded numbers, and rows after numeric descriptions", () => {
    const draft = createPdfAiImportDraftFromText({
      files: [
        {
          id: "file-budget-special-descriptions",
          fileName: "Presupuesto.pdf",
          role: "BUDGET",
          text: "Pagina 2:\nITEM PARTIDA UNIDAD METRADO CU PARCIAL CONCRETO CLASE C (F'C=280 KG/CM2) 5.9 M3 1,160.46 453.81 526,628.35 CONCRETO CICLOPEO (F'C=175 KG/CM2 + 30% PM) 5.12 M3 7,864.35 331.43 2,606,481.52 TUBERIA CORRUGADA MULTIPLATE ABOVEDADA (4.04x2.84m) 5.19 ML 21.06 4,025.45 84,775.98 SUBDREN TIPO 1 5.20 ML 11,172.00 176.81 1,975,321.32 DESCARGA DE SUBDRENES TIPO 1 5.21 ML 2,250.00 134.20 301,950.00",
        },
      ],
    });

    expect(draft.budgets[0]?.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "5.9", description: "CONCRETO CLASE C (F'C=280 KG/CM2)" }),
      expect.objectContaining({ code: "5.12", description: "CONCRETO CICLOPEO (F'C=175 KG/CM2 + 30% PM)" }),
      expect.objectContaining({ code: "5.19", description: "TUBERIA CORRUGADA MULTIPLATE ABOVEDADA (4.04x2.84m)" }),
      expect.objectContaining({ code: "5.20", description: "SUBDREN TIPO 1" }),
      expect.objectContaining({ code: "5.21", description: "DESCARGA DE SUBDRENES TIPO 1" }),
    ]));
  });

  it("extracts the budget summary and footer rows", () => {
    const draft = createPdfAiImportDraftFromText({
      files: [{
        id: "file-budget-footer",
        fileName: "Presupuesto.pdf",
        role: "BUDGET",
        text: "Pagina 1:\nPARTIDA ITEM COSTO DIRECTO 247,080,264.77 GASTOS GENERALES 12% 30,347,133.39 UTILIDAD 10% 24,708,026.48 SUB TOTAL 302,135,424.64 IGV 18% 54,384,376.44 TOTAL PRESUPUESTO 356,519,801.08",
      }],
    });

    expect(draft.budgets[0]?.footerRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ variable: "CD", value: "247080264.77" }),
      expect.objectContaining({ variable: "PGG", rate: "12%", value: "30347133.39" }),
      expect.objectContaining({ variable: "TOTAL", value: "356519801.08" }),
    ]));
  });

  it("keeps section 8 subtitles and rows with encoded units separated", () => {
    const draft = createPdfAiImportDraftFromText({
      files: [{
        id: "file-budget-section-8",
        fileName: "Presupuesto.pdf",
        role: "BUDGET",
        text: "Pagina 1:\nPROTECCION AMBIENTAL 8 6,728,769.76 PROGRAMA DE CIERRE DE OBRA 8.1 5,973,187.72 RETIRO Y ALMACENAMIENTO DE TOP SOIL 8.1.1 M2 424,410.34 2.00 848,820.68 PROGRAMA DE MONITOREO AMBIENTAL 8.2 272,092.00 MONITOREO DE CALIDAD DE AIRE 8.2.1 CPÃ‘A 8.00 15,080.00 120,640.00 SUBPROGRAMA DE SEÑALIZACION Y SEGURIDAD VIAL 8.3 47,583.47 SEÑALES INFORMATIVAS AMBIENTAL PERMANENTE 8.3.1 M2 38.88 534.09 20,765.42",
      }],
    });

    expect(draft.budgets[0]?.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "8.1.1", description: "RETIRO Y ALMACENAMIENTO DE TOP SOIL" }),
        expect.objectContaining({ code: "8.2.1", description: "MONITOREO DE CALIDAD DE AIRE", unit: "CPÑA" }),
      expect.objectContaining({ code: "8.3.1", description: "SEÑALES INFORMATIVAS AMBIENTAL PERMANENTE" }),
    ]));
  });

  it("normalizes known mojibake units and preserves unknown units", () => {
    const draft = createPdfAiImportDraftFromText({
      files: [{
        id: "file-budget-unknown-unit",
        fileName: "Presupuesto.pdf",
        role: "BUDGET",
        text: "8.2.1 MONITOREO DE CALIDAD DE AIRE CPÃ‘A 8.00 15,080.00 120,640.00",
      }],
    });

    expect(draft.budgets[0]?.items[0]).toMatchObject({ code: "8.2.1", unit: "CPÑA" });

    const unknownUnitDraft = createPdfAiImportDraftFromText({
      files: [{
        id: "file-budget-truly-unknown-unit",
        fileName: "Presupuesto.pdf",
        role: "BUDGET",
        text: "8.2.2 MONITOREO DE CALIDAD DE AGUA ZZ¤ 8.00 3,267.00 26,136.00",
      }],
    });
    expect(unknownUnitDraft.budgets[0]?.items[0]).toMatchObject({ code: "8.2.2", unit: "ZZ¤" });
  });

  it("creates a draft from simple extracted budget and APU lines", () => {
    const draft = createPdfAiImportDraftFromText({
      companyId: "company-1",
      projectName: "Colegio inicial",
      currency: "PEN",
      priceTolerance: "0.01",
      files: [
        {
          id: "file-budget",
          fileName: "presupuesto.pdf",
          role: "BUDGET",
          text: "01.01 Trazo y replanteo m2 10 2.50 25.00",
        },
        {
          id: "file-apu",
          fileName: "apu.pdf",
          role: "APU",
          text: "APU 01.01 Trazo y replanteo m2 2.50\nRECURSO Mano de obra hh 1 2.50 2.50",
        },
      ],
    });

    expect(draft.project.name).toBe("Colegio inicial");
    expect(draft.budgets[0]?.items).toHaveLength(1);
    expect(draft.apus).toHaveLength(1);
    expect(draft.links).toContainEqual(expect.objectContaining({ status: "MATCHED" }));
  });

  it("adds OCR warnings for scanned files depending on provider outcome", () => {
    const draft = createPdfAiImportDraftFromText({
      files: [
        {
          id: "file-scan",
          fileName: "scan.pdf",
          role: "BUDGET",
          text: "",
          pageCount: 1,
          confidence: 0.2,
          requiresOcr: true,
          ocrApplied: false,
        },
      ],
    });

    expect(draft.warnings).toContain("scan.pdf parece escaneado y no tuvo OCR automatico disponible. Configura una API key cloud en Configuracion > IA > Proveedores Cloud IA.");
  });
});
