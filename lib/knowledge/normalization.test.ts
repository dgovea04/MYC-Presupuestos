import { describe, expect, it } from "vitest";
import { normalizeKnowledgeText, normalizeKnowledgeUnit } from "./normalization";

describe("knowledge normalization", () => {
  it("normalizes case, accents, whitespace and punctuation deterministically", () => {
    expect(normalizeKnowledgeText("  Excavación   MANUAL de zanjas ")).toBe("excavacion manual de zanjas");
  });

  it("canonicalizes common construction units", () => {
    expect(normalizeKnowledgeUnit("M2")).toBe("M²");
    expect(normalizeKnowledgeUnit(" bolsa ")).toBe("BOL");
    expect(normalizeKnowledgeUnit("XYZ")).toBe("XYZ");
  });
});

