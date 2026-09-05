import { describe, expect, it } from "vitest";
import { suggestDocumentClassification } from "./classification";

describe("suggestDocumentClassification", () => {
  it("suggests quantity takeoff from an XLSX filename and its headers", () => {
    expect(suggestDocumentClassification({
      fileName: "Metrados estructura.xlsx",
      extension: ".xlsx",
      headers: ["Código", "Partida", "Unidad", "Metrado"],
    })).toEqual(expect.objectContaining({
      category: "QUANTITY_TAKEOFF",
      score: expect.any(Number),
      signals: expect.arrayContaining(["filename:metrado", "extension:xlsx", "header:metrado"]),
    }));
  });

  it("uses deterministic filename and extension signals for APU documents", () => {
    const input = { fileName: "APU concreto.pdf", extension: ".pdf", headers: [] };
    expect(suggestDocumentClassification(input)).toEqual(suggestDocumentClassification(input));
    expect(suggestDocumentClassification(input)).toMatchObject({ category: "APU", signals: expect.arrayContaining(["filename:apu", "extension:pdf"]) });
  });

  it("falls back to OTHER when no supported signal is present", () => {
    expect(suggestDocumentClassification({ fileName: "adjunto.bin", extension: ".bin", headers: [] })).toEqual({
      category: "OTHER",
      score: 0,
      signals: ["fallback:other"],
    });
  });
});
