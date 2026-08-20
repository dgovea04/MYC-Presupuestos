import { describe, expect, it } from "vitest";

import { buildPdfImportStructurePrompt, PDF_IMPORT_OUTPUT_JSON_SHAPE } from "./prompts";

describe("pdf import prompts", () => {
  it("asks the model for strict JSON without invented values", () => {
    const prompt = buildPdfImportStructurePrompt({
      files: [{ fileName: "presupuesto.pdf", role: "BUDGET", text: "01.01 Trazo m2 10 2.5 25" }],
      outputShape: PDF_IMPORT_OUTPUT_JSON_SHAPE,
    });

    expect(prompt).toContain("JSON valido");
    expect(prompt).toContain("No inventes");
    expect(prompt).toContain("presupuesto.pdf");
    expect(prompt).toContain("01.01 Trazo");
  });
});
