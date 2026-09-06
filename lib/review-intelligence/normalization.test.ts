import { describe, expect, it } from "vitest";
import {
  classifyEvidenceType,
  normalizeEvidenceMetadata,
  parseDecimalText,
} from "./normalization";

describe("parseDecimalText", () => {
  it("parses complete numeric text with comma decimals", () => {
    expect(parseDecimalText(" 12,50 ")?.toFixed(2)).toBe("12.50");
    expect(parseDecimalText("-0.125")?.toFixed(3)).toBe("-0.125");
  });

  it("rejects incomplete, blank, formula, NaN, and infinite values", () => {
    expect(parseDecimalText("12 kg")).toBeUndefined();
    expect(parseDecimalText("[FORMULA:B2*2]")).toBeUndefined();
    expect(parseDecimalText("NaN")).toBeUndefined();
    expect(parseDecimalText("Infinity")).toBeUndefined();
    expect(parseDecimalText("   ")).toBeUndefined();
  });
});

describe("normalizeEvidenceMetadata", () => {
  it("normaliza aliases de especificación, rendimiento y componentes APU", () => {
    const result = normalizeEvidenceMetadata({
      spec: "f'c 210",
      rendimiento: "0,125",
      componente: "cemento; arena",
      cantidad: "12,50",
      unidad: "M²",
    });

    expect(result.technicalSpecification).toBe("f'c 210");
    expect(result.yield?.toFixed(3)).toBe("0.125");
    expect(result.quantity?.toFixed(2)).toBe("12.50");
    expect(result.apuComponents).toEqual(["cemento", "arena"]);
    expect(result.unit).toBe("m²");
    expect(parseDecimalText("[FORMULA:B2*2]")).toBeUndefined();
  });

  it("recognizes aliases case-insensitively without executing formulas", () => {
    const result = normalizeEvidenceMetadata({
      TECHNICALSPECIFICATION: "cárcamo",
      QTY: "4",
      PERFORMANCE: "0.5",
      RECURSO: "agua, , cemento | arena",
    });

    expect(result.technicalSpecification).toBe("cárcamo");
    expect(result.quantity?.toString()).toBe("4");
    expect(result.yield?.toString()).toBe("0.5");
    expect(result.apuComponents).toEqual(["agua", "cemento", "arena"]);
  });

  it("preserves arbitrary source attributes as strings", () => {
    const result = normalizeEvidenceMetadata({
      material: 210,
      sourceFlag: true,
      empty: null,
    });

    expect(result.attributes).toEqual({ material: "210", sourceFlag: "true", empty: "" });
    expect(Object.values(result.attributes ?? {}).every((value) => typeof value === "string")).toBe(true);
  });

  it("leaves unknown units unchanged and canonicalizes known units", () => {
    expect(normalizeEvidenceMetadata({ unit: "  XYZ  " }).unit).toBe("XYZ");
    expect(normalizeEvidenceMetadata({ unit: " M2 " }).unit).toBe("m²");
  });
});

describe("classifyEvidenceType", () => {
  it("uses the required deterministic priority", () => {
    expect(classifyEvidenceType({ quantity: parseDecimalText("1"), technicalSpecification: "f'c 210", apuComponents: ["cemento"], unit: "m3" })).toBe("QUANTITY");
    expect(classifyEvidenceType({ technicalSpecification: "f'c 210", apuComponents: ["cemento"], unit: "m3" })).toBe("TECHNICAL_SPECIFICATION");
    expect(classifyEvidenceType({ apuComponents: ["cemento"], unit: "m3" })).toBe("APU_COMPONENT");
    expect(classifyEvidenceType({ unit: "m3" })).toBe("UNIT");
    expect(classifyEvidenceType({ description: "sin señales" })).toBe("OTHER");
  });
});
