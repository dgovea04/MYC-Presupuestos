import { describe, expect, it } from "vitest";
import { parseReviewConfiguration } from "./validation";

describe("parseReviewConfiguration", () => {
  it("acepta configuración V0 y rechaza límites excedidos", () => {
    const validConfiguration = {
      maxFiles: 10,
      maxPdfPages: 300,
      maxFileSizeMb: 50,
      maxXlsxSheets: 20,
      tolerancePercent: "1.00",
      findingTypes: ["QUANTITY_MISMATCH"],
    };

    expect(() => parseReviewConfiguration(validConfiguration)).not.toThrow();
    expect(() =>
      parseReviewConfiguration({ ...validConfiguration, maxFiles: 11 }),
    ).toThrow();
    expect(() =>
      parseReviewConfiguration({ ...validConfiguration, maxPdfPages: 301 }),
    ).toThrow();
    expect(() =>
      parseReviewConfiguration({ ...validConfiguration, maxFileSizeMb: 51 }),
    ).toThrow();
    expect(() =>
      parseReviewConfiguration({ ...validConfiguration, maxXlsxSheets: 21 }),
    ).toThrow();
  });

  it("rechaza tipos de hallazgo fuera del catálogo V0", () => {
    expect(() =>
      parseReviewConfiguration({
        maxFiles: 10,
        maxPdfPages: 300,
        maxFileSizeMb: 50,
        maxXlsxSheets: 20,
        tolerancePercent: "1.00",
        findingTypes: ["UNSUPPORTED_FINDING"],
      }),
    ).toThrow();
  });
});
