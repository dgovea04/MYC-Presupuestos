import { describe, expect, it } from "vitest";
import { calculateCatalogCostMinor, findAiModelCatalogEntry, listAiModelCatalog } from "@/lib/ai/model-catalog";

describe("AI model catalog", () => {
  it("lists active models and resolves by provider/model", () => {
    expect(listAiModelCatalog().length).toBeGreaterThan(0);
    expect(findAiModelCatalogEntry("openai", "gpt-4o-mini")?.provider).toBe("OPENAI");
    expect(findAiModelCatalogEntry("OPENAI", "missing-model")).toBeNull();
  });

  it("calculates costs in minor units without floating-point drift", () => {
    const entry = findAiModelCatalogEntry("OPENAI", "gpt-4o-mini");
    if (!entry) throw new Error("catalog fixture missing");
    expect(calculateCatalogCostMinor({ entry, inputTokens: 1_000_000, outputTokens: 1_000_000 })).toBe(75);
  });
});
