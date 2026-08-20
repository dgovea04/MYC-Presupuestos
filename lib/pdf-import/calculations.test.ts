import { describe, expect, it } from "vitest";

import { calculatePdfImportDraftTotals } from "./calculations";
import type { PdfAiImportDraft } from "./types";

describe("pdf import calculations", () => {
  it("recalculates budget partials and APU row subtotals with decimal-safe math", () => {
    const draft = createCalculationDraft();

    const result = calculatePdfImportDraftTotals(draft);

    expect(result.budgets[0]?.items[0]?.partial).toBe("3.00");
    expect(result.apus[0]?.rows[0]?.subtotal).toBe("3.00");
    expect(result.apus[0]?.totalUnitCost).toBe("3.00");
  });
});

function createCalculationDraft(): PdfAiImportDraft {
  const evidence = {
    sourceFileName: "apu.pdf",
    sourcePage: 1,
    rawText: "fila",
    confidence: 0.8,
  };

  return {
    source: "PDF_AI",
    project: { name: "Proyecto", currency: "PEN" },
    sourceFiles: [{ id: "file-1", fileName: "apu.pdf", role: "APU", pageCount: 1, confidence: 0.8 }],
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
            code: "01",
            description: "Partida",
            unit: "m2",
            quantity: "0.1",
            unitPrice: "30",
            partial: "999",
            sortOrder: 1,
            evidence,
          },
        ],
      },
    ],
    apus: [
      {
        id: "apu-1",
        budgetItemCode: "01",
        name: "Partida",
        unit: "m2",
        performance: "1",
        totalUnitCost: "999",
        rows: [
          {
            id: "row-1",
            description: "Mano de obra",
            unit: "hh",
            resourceType: "LABOR",
            quantity: "0.1",
            unitPrice: "30",
            subtotal: "999",
            sortOrder: 1,
            evidence,
          },
        ],
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
