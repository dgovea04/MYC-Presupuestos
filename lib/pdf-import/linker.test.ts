import { describe, expect, it } from "vitest";

import { linkPdfImportDraft, normalizePdfImportCode, normalizePdfImportUnit } from "./linker";
import type { PdfAiImportDraft } from "./types";

describe("pdf import linker", () => {
  it("normalizes common construction units", () => {
    expect(normalizePdfImportUnit("M2")).toBe("m2");
    expect(normalizePdfImportUnit("m³")).toBe("m3");
    expect(normalizePdfImportUnit("UND.")).toBe("und");
    expect(normalizePdfImportUnit("Global")).toBe("glb");
  });

  it("matches budget items to APUs by normalized code", () => {
    const draft = createDraft({
      itemCode: "01.01.001",
      apuCode: "1.1.1",
      itemDescription: "Concreto f'c=210 kg/cm2 en columnas",
      apuName: "Concreto f'c=210 kg/cm2 en columnas",
    });

    const result = linkPdfImportDraft(draft, { priceTolerance: "0.01" });

    expect(result.links).toContainEqual(
      expect.objectContaining({
        fromId: "item-1",
        toId: "apu-1",
        kind: "BUDGET_ITEM_APU",
        status: "MATCHED",
      }),
    );
  });

  it("marks price mismatches when APU and budget unit prices exceed tolerance", () => {
    const draft = createDraft({
      itemCode: "02.01",
      apuCode: "02.01",
      itemDescription: "Tarrajeo en muros interiores",
      apuName: "Tarrajeo en muros interiores",
      itemUnitPrice: "45",
      apuTotalUnitCost: "50",
    });

    const result = linkPdfImportDraft(draft, { priceTolerance: "0.01" });

    expect(result.links).toContainEqual(
      expect.objectContaining({
        fromId: "item-1",
        toId: "apu-1",
        status: "PRICE_MISMATCH",
      }),
    );
    expect(result.validations).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "PRICE_MISMATCH",
        entityId: "item-1",
      }),
    );
  });

  it("marks APUs without matching budget items", () => {
    const draft = createDraft({
      itemCode: "01.01",
      apuCode: "99.99",
      itemDescription: "Trazo y replanteo",
      apuName: "Partida no presupuestada",
    });

    const result = linkPdfImportDraft(draft, { priceTolerance: "0.01" });

    expect(result.links).toContainEqual(
      expect.objectContaining({
        fromId: "apu-1",
        kind: "BUDGET_ITEM_APU",
        status: "MISSING_BUDGET_ITEM",
      }),
    );
  });
});

function createDraft(options: {
  itemCode: string;
  apuCode: string;
  itemDescription: string;
  apuName: string;
  itemUnitPrice?: string;
  apuTotalUnitCost?: string;
}): PdfAiImportDraft {
  const evidence = {
    sourceFileName: "documento.pdf",
    sourcePage: 1,
    rawText: `${options.itemCode} ${options.itemDescription}`,
    confidence: 0.9,
  };

  return {
    source: "PDF_AI",
    project: { name: "Proyecto PDF", currency: "PEN" },
    sourceFiles: [{ id: "file-1", fileName: "documento.pdf", role: "AUTO", pageCount: 1, confidence: 0.9 }],
    budgets: [
      {
        id: "budget-1",
        name: "General",
        kind: "SUB_BUDGET",
        currency: "PEN",
        levels: [],
        items: [
          {
            id: "item-1",
            code: options.itemCode,
            description: options.itemDescription,
            unit: "m3",
            quantity: "2",
            unitPrice: options.itemUnitPrice ?? "10",
            partial: "20",
            sortOrder: 1,
            evidence,
          },
        ],
      },
    ],
    apus: [
      {
        id: "apu-1",
        budgetItemCode: options.apuCode,
        name: options.apuName,
        unit: "m3",
        performance: "1",
        totalUnitCost: options.apuTotalUnitCost ?? "10",
        rows: [],
        evidence,
      },
    ],
    subpartidas: [],
    resources: [],
    links: [],
    validations: [],
    warnings: [],
  };
}
