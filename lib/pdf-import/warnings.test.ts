import { describe, expect, it } from "vitest";

import { createPdfImportWarnings } from "./warnings";
import type { PdfAiImportDraft } from "./types";

describe("pdf import warnings", () => {
  it("generates blocking and non-blocking validations from recalculated totals and evidence", () => {
    const draft = createDraft();

    const result = createPdfImportWarnings(draft, { priceTolerance: "0.01", confidenceThreshold: 0.65 });

    expect(result.validations).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        code: "BUDGET_PARTIAL_RECALCULATED",
        entityId: "item-1",
      }),
    );
    expect(result.validations).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "PRICE_MISMATCH",
        entityId: "item-1",
      }),
    );
    expect(result.validations).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        code: "LOW_CONFIDENCE_OCR",
        entityId: "item-1",
      }),
    );
    expect(result.warnings).toContain("La partida 01.01 tiene parcial 999.00; recalculado esperado 25.00.");
  });

  it("deduplicates validations already present in the draft", () => {
    const draft = createDraft();
    draft.validations.push({
      id: "existing-low-confidence",
      severity: "warning",
      code: "LOW_CONFIDENCE_OCR",
      message: "Ya existe",
      entityId: "item-1",
    });

    const result = createPdfImportWarnings(draft, { priceTolerance: "0.01", confidenceThreshold: 0.65 });

    expect(result.validations.filter((validation) => validation.code === "LOW_CONFIDENCE_OCR" && validation.entityId === "item-1")).toHaveLength(1);
  });
});

function createDraft(): PdfAiImportDraft {
  const lowConfidenceEvidence = {
    sourceFileName: "scan.pdf",
    sourcePage: 1,
    rawText: "01.01 Trazo m2 10 2.50 999.00",
    confidence: 0.42,
  };
  const apuEvidence = {
    sourceFileName: "apu.pdf",
    sourcePage: 1,
    rawText: "APU 01.01 Trazo m2 2.00",
    confidence: 0.9,
  };

  return {
    source: "PDF_AI",
    project: { name: "Proyecto", currency: "PEN" },
    sourceFiles: [{ id: "file-1", fileName: "scan.pdf", role: "BUDGET", pageCount: 1, confidence: 0.42 }],
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
            code: "01.01",
            description: "Trazo",
            unit: "m2",
            quantity: "10",
            unitPrice: "2.50",
            partial: "999.00",
            sortOrder: 1,
            evidence: lowConfidenceEvidence,
          },
        ],
      },
    ],
    apus: [
      {
        id: "apu-1",
        budgetItemCode: "01.01",
        name: "Trazo",
        unit: "m2",
        performance: "1",
        totalUnitCost: "2.00",
        rows: [],
        evidence: apuEvidence,
      },
    ],
    subpartidas: [],
    resources: [],
    links: [
      {
        id: "link-item-apu",
        fromId: "item-1",
        toId: "apu-1",
        kind: "BUDGET_ITEM_APU",
        status: "MATCHED",
        confidence: 0.98,
        reason: "Codigo de partida coincidente.",
      },
    ],
    validations: [],
    warnings: [],
  };
}
