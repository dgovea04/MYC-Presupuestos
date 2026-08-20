import { describe, expect, it } from "vitest";

import { pdfAiImportDraftSchema, pdfImportDecimalSchema, pdfImportSourceEvidenceSchema } from "./validation";

describe("pdf import validation", () => {
  it("accepts decimal strings and rejects non numeric values", () => {
    expect(pdfImportDecimalSchema.parse("1234.5678")).toBe("1234.5678");
    expect(pdfImportDecimalSchema.parse(15.25)).toBe("15.25");
    expect(() => pdfImportDecimalSchema.parse("12 soles")).toThrow();
    expect(() => pdfImportDecimalSchema.parse(Number.NaN)).toThrow();
  });

  it("requires source evidence for imported entities", () => {
    expect(
      pdfImportSourceEvidenceSchema.parse({
        sourceFileName: "apu.pdf",
        sourcePage: 3,
        rawText: "01.01 Concreto f'c=210",
        confidence: 0.82,
      }),
    ).toMatchObject({ sourceFileName: "apu.pdf", sourcePage: 3 });

    expect(() =>
      pdfImportSourceEvidenceSchema.parse({
        sourceFileName: "",
        sourcePage: 0,
        rawText: "",
        confidence: 1.2,
      }),
    ).toThrow();
  });

  it("validates a minimal draft with budget item evidence", () => {
    const draft = pdfAiImportDraftSchema.parse({
      source: "PDF_AI",
      project: { name: "Colegio inicial", currency: "PEN" },
      sourceFiles: [{ id: "file-1", fileName: "presupuesto.pdf", role: "BUDGET", pageCount: 2, confidence: 0.9 }],
      budgets: [
        {
          id: "budget-1",
          name: "Arquitectura",
          kind: "SUB_BUDGET",
          currency: "PEN",
          levels: [],
          items: [
            {
              id: "item-1",
              code: "01.01",
              description: "Trazo y replanteo",
              unit: "m2",
              quantity: "100",
              unitPrice: "2.5",
              partial: "250",
              sortOrder: 1,
              evidence: {
                sourceFileName: "presupuesto.pdf",
                sourcePage: 1,
                rawText: "01.01 Trazo y replanteo m2 100 2.50 250.00",
                confidence: 0.9,
              },
            },
          ],
        },
      ],
      apus: [],
      subpartidas: [],
      resources: [],
      links: [],
      validations: [],
      warnings: [],
    });

    expect(draft.budgets[0]?.items[0]?.quantity).toBe("100");
  });
});
