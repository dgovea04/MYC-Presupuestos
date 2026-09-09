import { describe, expect, it } from "vitest";

import { createPdfAiImportDraftFromText } from "./import-preview";

describe("pdf import preview", () => {
  it("uses the deterministic digital-PDF parser for OCR rows with segment markers", () => {
    const draft = createPdfAiImportDraftFromText({
      files: [{
        id: "file-ocr-budget",
        fileName: "solo-dos-hojas.pdf",
        role: "BUDGET",
        requiresOcr: true,
        ocrApplied: true,
        text: [
          "Pagina 1, segmento 1:",
          "01.01.01.01\tAlquiler de Oficina, vestuario y almacén\tmes\t4.00\t2500.00\t10000.00",
          "Pagina 2, segmento 1:",
          "01.01.02.02.03\tLimpieza final de la obra\tgbl\t1.00\t3056.70\t3056.70",
        ].join("\n"),
      }],
    });

    expect(draft.budgets[0]?.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "01.01.01.01", description: "Alquiler de Oficina, vestuario y almacén" }),
      expect.objectContaining({ code: "01.01.02.02.03", unit: "gbl", quantity: "1.00", partial: "3056.70" }),
    ]));
  });

  it("deduplicates a row repeated across OCR segment overlap", () => {
    const draft = createPdfAiImportDraftFromText({
      files: [{
        id: "file-overlap",
        fileName: "scan.pdf",
        role: "BUDGET",
        requiresOcr: true,
        ocrApplied: true,
        text: [
          "Pagina 1, segmento 2:",
          "01.01.01.01\tAlquiler de oficina\tmes\t4.00\t2500.00\t10000.00",
          "Pagina 1, segmento 3:",
          "01.01.01.01\tAlquiler de oficina\tmes\t4.00\t2500.00\t10000.00",
        ].join("\n"),
      }],
    });

    expect(draft.budgets[0]?.items.filter((item) => item.code === "01.01.01.01")).toHaveLength(1);
  });

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

  it("parses digital analysis and subpartida sections and links them deterministically", () => {
    const draft = createPdfAiImportDraftFromText({
      files: [
        {
          id: "file-budget-real-format",
          fileName: "Presupuesto.pdf",
          role: "BUDGET",
          text: "Pagina 1:\nPRESUPUESTO ITEM PARTIDA UNIDAD METRADO CU PARCIAL MOVILIZACION Y DESMOVILIZACION DE EQUIPOS 1.1 GLB 1.00 910,909.61 910,909.61",
        },
        {
          id: "file-apu-real-format",
          fileName: "Análisis_de_Costos.pdf",
          role: "APU",
          text: "Pagina 1:\nANÁLISIS DE COSTOS UNITARIOS PROYECTO: CARRETERA MONEDA: SOLES 1.1 MOVILIZACION Y DESMOVILIZACION DE EQUIPOS Rendimiento: 1.0000 GLB/DIA Unidad: GLB Costo Unitario: 910,909.61 x [GLB] Insumo Unidad Cuadrilla Cantidad PU Parcial PRODUCCION CONCRETO M3 1.00 910,909.61 910,909.61 Materiales: 910,909.61 Sub Partidas: 0.00",
        },
        {
          id: "file-subpartidas-real-format",
          fileName: "Sub_partidas.pdf",
          role: "SUBPARTIDAS",
          text: "Pagina 1:\nSUBPARTIDAS - ANÁLISIS DE COSTOS UNITARIOS PROYECTO: CARRETERA MONEDA: SOLES PRODUCCION CONCRETO Rendimiento: 120.0000 M3/DIA Unidad: M3 Costo Unitario: 327.41 x [M3] Insumo Unidad Cuadrilla Cantidad PU Parcial CEMENTO BLS 1.0000 23.32 23.32 Materiales: 23.32",
        },
      ],
    });

    expect(draft.apus).toHaveLength(1);
    expect(draft.apus[0]).toMatchObject({ budgetItemCode: "1.1", unit: "GLB", totalUnitCost: "910909.61" });
    expect(draft.apus[0]?.rows).toHaveLength(1);
    expect(draft.subpartidas).toHaveLength(1);
    expect(draft.subpartidas[0]).toMatchObject({ description: "PRODUCCION CONCRETO", unit: "M3", unitPrice: "23.32" });
    expect(draft.links).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "BUDGET_ITEM_APU", status: "MATCHED" }),
      expect.objectContaining({ kind: "APU_SUBPARTIDA", status: "MATCHED" }),
    ]));
  });

  it("assumes performance 1 and flags an APU when the PDF omits its numeric performance", () => {
    const draft = createPdfAiImportDraftFromText({
      files: [
        {
          id: "file-budget-missing-performance",
          fileName: "Presupuesto.pdf",
          role: "BUDGET",
          text: "Pagina 1:\nEXCAVACION EN EXPLANACIONES EN ROCA FIJA 2.4 M3 1.00 27.62 27.62",
        },
        {
          id: "file-apu-missing-performance",
          fileName: "Análisis_de_Costos.pdf",
          role: "APU",
          text: "Pagina 1:\nANÁLISIS DE COSTOS UNITARIOS PROYECTO: CARRETERA MONEDA: SOLES 2.4 EXCAVACION EN EXPLANACIONES EN ROCA FIJA Rendimiento: M3/DIA Unidad: M3 Costo Unitario: 27.62 x [M3] Insumo Unidad Cuadrilla Cantidad PU Parcial MANO DE OBRA HH 1.00 10.00 10.00",
        },
      ],
    });

    expect(draft.apus).toEqual([
      expect.objectContaining({ budgetItemCode: "2.4", performance: "1", performanceMissing: true }),
    ]);
    expect(draft.validations).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "MISSING_PERFORMANCE", entityId: "apu-2-4" }),
    ]));
  });

  it("keeps regular APUs when the same analysis PDF also has missing performances", () => {
    const draft = createPdfAiImportDraftFromText({
      files: [{
        id: "file-apu-mixed-performance",
        fileName: "Análisis_de_Costos.pdf",
        role: "APU",
        text: "Pagina 1: MONEDA: SOLES 1.1 MOVILIZACION Rendimiento: 1.0000 GLB/DIA Unidad: GLB Costo Unitario: 10.00 x [GLB] Insumo Unidad Cuadrilla Cantidad PU Parcial RECURSO GLB 1.00 10.00 10.00 2.4 EXCAVACION EN EXPLANACIONES EN ROCA FIJA Rendimiento: M3/DIA Unidad: M3 Costo Unitario: 27.62 x [M3] Insumo Unidad Cuadrilla Cantidad PU Parcial ROCA M3 1.00 27.62 27.62 2.5 REMOCION DE DERRUMBES Rendimiento: 375.0000 M3/DIA Unidad: M3 Costo Unitario: 8.31 x [M3] Insumo Unidad Cuadrilla Cantidad PU Parcial ROCA M3 1.00 8.31 8.31",
      }],
    });

    expect(draft.apus.map((apu) => apu.budgetItemCode)).toEqual(expect.arrayContaining(["1.1", "2.4"]));
    expect(draft.apus).toHaveLength(3);
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

  it("extracts multiline budget levels at any hierarchy depth from OCR text", () => {
    const draft = createPdfAiImportDraftFromText({
      files: [{
        id: "file-scanned-budget-levels",
        fileName: "solo-dos-hojas.pdf",
        role: "BUDGET",
        requiresOcr: true,
        ocrApplied: true,
        text: [
          "Pagina 1:",
          "1.01 TRABAJOS PRELIMINARES, OBRAS",
          "PROVISIONALES 346,438.12",
          "01.01.01 Obras Provisionales 43,319.02",
          "01.01.01.01 Alquiler de Oficina, vestuario y almacén mes 4.00 2,500.00 10,000.00",
          "01.01.02 Trabajos Preliminares 210,644.46",
          "Pagina 2:",
          "01.01.02.01 Trazo y replanteo 23,111.25",
          "01.01.02.01.01 Trazo y replanteo inicial gbl 1.00 2,664.53 2,664.53",
        ].join("\n"),
      }],
    });

    expect(draft.budgets[0]?.levels).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "1.01", name: "TRABAJOS PRELIMINARES, OBRAS PROVISIONALES" }),
      expect.objectContaining({ code: "01.01.01", name: "OBRAS PROVISIONALES" }),
      expect.objectContaining({ code: "01.01.02.01", name: "TRAZO Y REPLANTEO" }),
    ]));
    expect(draft.budgets[0]?.levels.find((level) => level.code === "01.01.02.01")?.parentId)
      .toBe(draft.budgets[0]?.levels.find((level) => level.code === "01.01.02")?.id);
    expect(draft.budgets[0]?.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "01.01.01.01", levelId: expect.any(String) }),
      expect.objectContaining({ code: "01.01.02.01.01", levelId: expect.any(String) }),
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

  it("uses project and subbudget names from the PDF header", () => {
    const draft = createPdfAiImportDraftFromText({
      files: [{
        id: "file-budget-header",
        fileName: "Presupuesto.pdf",
        role: "BUDGET",
        text: "PRESUPUESTO PROYECTO: CARRETERA SUBPRESUPUESTO: SUB PRESUPUESTO 1 CLIENTE: MUNICIPALIDAD ITEM PARTIDA UNIDAD METRADO CU PARCIAL TRABAJOS PRELIMINARES 1 100.00 TRAZO Y REPLANTEO 1.1 M2 10.00 2.00 20.00",
      }],
    });

    expect(draft.project.name).toBe("CARRETERA");
    expect(draft.budgets[0]?.name).toBe("SUB PRESUPUESTO 1");
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

  it("normalizes Gemini OCR tables and preserves the OCR text backup", () => {
    const ocrText = [
      "Pagina 1:",
      "Items | DescripciÃ³n | Unid. | Cant. | Precio | Total",
      "01.01.01.01 | Alquiler de Oficina | mes | 4.00 | S/2,500.00 | S/10,000.00",
      "Pagina 2:",
      "01.01.01.02 | Cartel de Obra | und | 2.00 | S/1,559.51 | S/3,119.02",
    ].join("\n");

    const draft = createPdfAiImportDraftFromText({
      files: [{
        id: "file-gemini-ocr",
        fileName: "scan.pdf",
        role: "BUDGET",
        text: ocrText,
        pageCount: 2,
        confidence: 0.75,
        requiresOcr: true,
        ocrApplied: true,
      }],
    });

    expect(draft.budgets[0]?.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "01.01.01.01", unit: "mes", quantity: "4.00", unitPrice: "2500.00", partial: "10000.00", evidence: expect.objectContaining({ sourcePage: 1 }) }),
      expect.objectContaining({ code: "01.01.01.02", unit: "und", evidence: expect.objectContaining({ sourcePage: 2 }) }),
    ]));
    expect(draft.sourceFiles[0]?.ocrText).toBe(ocrText);
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
