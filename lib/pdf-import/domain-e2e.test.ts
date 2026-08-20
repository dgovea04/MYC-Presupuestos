import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createPdfAiImportDraftFromText } from "./import-preview";

const fixtureRoot = join(process.cwd(), "test-fixtures", "pdf-import");

describe("pdf import domain e2e", () => {
  it("builds a linked draft from synthetic extracted PDF text", () => {
    const draft = createPdfAiImportDraftFromText({
      companyId: "company-1",
      projectName: "Proyecto fixture",
      priceTolerance: "0.01",
      files: [
        {
          id: "file-budget",
          fileName: "digital-budget-simple.txt",
          role: "BUDGET",
          text: readFixture("digital-budget-simple.txt"),
          pageCount: 1,
          confidence: 0.9,
        },
        {
          id: "file-apu",
          fileName: "apu-with-subpartida.txt",
          role: "APU",
          text: readFixture("apu-with-subpartida.txt"),
          pageCount: 1,
          confidence: 0.88,
        },
      ],
    });

    expect(draft.project.name).toBe("Proyecto fixture");
    expect(draft.budgets[0]?.items).toHaveLength(1);
    expect(draft.apus).toHaveLength(1);
    expect(draft.links).toContainEqual(expect.objectContaining({ kind: "BUDGET_ITEM_APU", status: "MATCHED" }));
    expect(draft.budgets[0]?.items[0]?.partial).toBe("25.00");
    expect(draft.apus[0]?.totalUnitCost).toBe("2.50");
  });

  it("surfaces missing APUs, orphan APUs, price mismatches and low OCR confidence", () => {
    const draft = createPdfAiImportDraftFromText({
      companyId: "company-1",
      projectName: "Proyecto con observaciones",
      priceTolerance: "0.01",
      files: [
        {
          id: "file-budget-missing-apu",
          fileName: "budget-without-apu.txt",
          role: "BUDGET",
          text: readFixture("budget-without-apu.txt"),
          pageCount: 1,
          confidence: 0.9,
        },
        {
          id: "file-budget-low-confidence",
          fileName: "ocr-budget-low-confidence.txt",
          role: "BUDGET",
          text: readFixture("ocr-budget-low-confidence.txt"),
          pageCount: 1,
          confidence: 0.4,
        },
        {
          id: "file-orphan-apu",
          fileName: "apu-without-budget-item.txt",
          role: "APU",
          text: readFixture("apu-without-budget-item.txt"),
          pageCount: 1,
          confidence: 0.9,
        },
        {
          id: "file-price-mismatch-apu",
          fileName: "price-mismatch-package.txt",
          role: "APU",
          text: readFixture("price-mismatch-package.txt"),
          pageCount: 1,
          confidence: 0.9,
        },
      ],
    });

    expect(draft.links).toContainEqual(expect.objectContaining({ status: "MISSING_APU" }));
    expect(draft.validations).toContainEqual(expect.objectContaining({ code: "PRICE_MISMATCH", severity: "error" }));
    expect(draft.validations).toContainEqual(expect.objectContaining({ code: "LOW_CONFIDENCE_OCR", severity: "warning" }));
    expect(draft.warnings.some((warning) => warning.includes("baja confianza"))).toBe(true);
  });
});

function readFixture(fileName: string) {
  return readFileSync(join(fixtureRoot, fileName), "utf8");
}
