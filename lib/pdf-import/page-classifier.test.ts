import { describe, expect, it } from "vitest";

import { classifyPdfImportPage, isLikelyScannedPdfPage } from "./page-classifier";

describe("pdf import page classifier", () => {
  it("detects budget, APU and subpartida pages from construction keywords", () => {
    expect(classifyPdfImportPage("PRESUPUESTO\nItem Descripcion Und Metrado Precio Parcial")).toBe("BUDGET");
    expect(classifyPdfImportPage("ANALISIS DE PRECIOS UNITARIOS\nMano de obra Materiales Equipos")).toBe("APU");
    expect(classifyPdfImportPage("SUBPARTIDAS\nAnalisis de sub partidas")).toBe("SUBPARTIDAS");
  });

  it("marks pages with very little text as likely scanned", () => {
    expect(isLikelyScannedPdfPage("")).toBe(true);
    expect(isLikelyScannedPdfPage("PRESUPUESTO 01.01 Trazo m2 10 2 20")).toBe(false);
  });
});
