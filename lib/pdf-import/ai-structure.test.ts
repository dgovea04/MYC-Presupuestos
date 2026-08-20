import { describe, expect, it, vi } from "vitest";

import { structurePdfImportWithAi, type PdfImportAiExecutor } from "./ai-structure";

describe("pdf import ai structure", () => {
  it("structures valid AI JSON into a PDF import draft fragment", async () => {
    const executeAi: PdfImportAiExecutor = vi.fn().mockResolvedValue({
      answer: JSON.stringify({
        project: { name: "Colegio Santa Rosa", currency: "PEN" },
        budgets: [
          {
            name: "Arquitectura",
            items: [
              {
                code: "01.01",
                description: "Trazo y replanteo",
                unit: "m2",
                quantity: "10",
                unitPrice: "2.50",
                partial: "25.00",
                sourcePage: 1,
                confidence: 0.86,
              },
            ],
          },
        ],
        apus: [],
        subpartidas: [],
        resources: [],
        warnings: [],
      }),
      provider: "openai",
      model: "gpt-test",
      requestedModel: "gpt-test",
      fallbackUsed: false,
      warnings: [],
    });

    const result = await structurePdfImportWithAi({
      executeAi,
      userId: "user-1",
      companyId: "company-1",
      files: [{ id: "file-1", fileName: "scan.pdf", role: "BUDGET", text: "texto OCR", pageCount: 1, requiresOcr: true, confidence: 0.2 }],
    });

    expect(result.draft.project.name).toBe("Colegio Santa Rosa");
    expect(result.draft.budgets[0]?.items[0]).toMatchObject({
      code: "01.01",
      needsReview: false,
    });
    expect(result.metadata.provider).toBe("openai");
  });

  it("repairs AI output when valid JSON is wrapped in text", async () => {
    const executeAi: PdfImportAiExecutor = vi.fn().mockResolvedValue({
      answer: `Resultado:\n${JSON.stringify({
        project: { name: "Proyecto envuelto", currency: "PEN" },
        budgets: [],
        apus: [],
        subpartidas: [],
        resources: [],
        warnings: ["Sin tablas detectadas"],
      })}\nFin`,
      provider: "gemini",
      model: "gemini-test",
      requestedModel: "gemini-test",
      fallbackUsed: false,
      warnings: [],
    });

    const result = await structurePdfImportWithAi({
      executeAi,
      userId: "user-1",
      companyId: "company-1",
      files: [{ id: "file-1", fileName: "scan.pdf", role: "AUTO", text: "texto OCR", pageCount: 1, requiresOcr: true, confidence: 0.2 }],
    });

    expect(result.metadata.structuredParseStatus).toBe("repaired");
    expect(result.draft.warnings).toContain("Sin tablas detectadas");
  });

  it("returns a controlled failure when AI output cannot be parsed", async () => {
    const executeAi: PdfImportAiExecutor = vi.fn().mockResolvedValue({
      answer: "no hay json aqui",
      provider: "openai",
      model: "gpt-test",
      requestedModel: "gpt-test",
      fallbackUsed: false,
      warnings: [],
    });

    await expect(
      structurePdfImportWithAi({
        executeAi,
        userId: "user-1",
        companyId: "company-1",
        files: [{ id: "file-1", fileName: "scan.pdf", role: "AUTO", text: "texto OCR", pageCount: 1, requiresOcr: true, confidence: 0.2 }],
      }),
    ).rejects.toThrow("No se pudo estructurar");
  });

  it("structures subpartidas and links APU rows that reference them", async () => {
    const executeAi: PdfImportAiExecutor = vi.fn().mockResolvedValue({
      answer: JSON.stringify({
        project: { name: "Proyecto con subpartidas", currency: "PEN" },
        budgets: [
          {
            name: "Estructuras",
            items: [
              {
                code: "01.01",
                description: "Concreto en columnas",
                unit: "m3",
                quantity: "1",
                unitPrice: "120",
                partial: "120",
                sourcePage: 1,
                confidence: 0.9,
              },
            ],
          },
        ],
        apus: [
          {
            budgetItemCode: "01.01",
            name: "Concreto en columnas",
            unit: "m3",
            performance: "1",
            totalUnitCost: "120",
            sourcePage: 2,
            confidence: 0.9,
            rows: [
              {
                description: "Preparacion de concreto fc 210",
                unit: "m3",
                resourceType: "SUBPARTIDA",
                quantity: "1",
                unitPrice: "120",
                subtotal: "120",
                sourcePage: 2,
                confidence: 0.86,
              },
            ],
          },
        ],
        subpartidas: [
          {
            code: "SP-01",
            description: "Preparacion de concreto fc 210",
            unit: "m3",
            unitPrice: "120",
            performance: "1",
            sourcePage: 5,
            confidence: 0.88,
            rows: [
              {
                description: "Cemento portland",
                unit: "bol",
                resourceType: "MATERIAL",
                quantity: "8",
                unitPrice: "15",
                subtotal: "120",
                sourcePage: 5,
                confidence: 0.88,
              },
            ],
          },
        ],
        resources: [],
        warnings: [],
      }),
      provider: "openai",
      model: "gpt-test",
      requestedModel: "gpt-test",
      fallbackUsed: false,
      warnings: [],
    });

    const result = await structurePdfImportWithAi({
      executeAi,
      userId: "user-1",
      companyId: "company-1",
      files: [{ id: "file-1", fileName: "paquete.pdf", role: "AUTO", text: "texto OCR", pageCount: 5, requiresOcr: true, confidence: 0.2 }],
    });

    expect(result.draft.subpartidas[0]).toMatchObject({
      code: "SP-01",
      description: "Preparacion de concreto fc 210",
    });
    expect(result.draft.links).toContainEqual(
      expect.objectContaining({
        kind: "APU_SUBPARTIDA",
        status: "MATCHED",
      }),
    );
  });
});
