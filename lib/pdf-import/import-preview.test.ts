import { describe, expect, it } from "vitest";

import { createPdfAiImportDraftFromText } from "./import-preview";

describe("pdf import preview", () => {
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
