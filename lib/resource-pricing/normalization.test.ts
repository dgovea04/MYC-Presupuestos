import { describe, expect, it } from "vitest";
import { normalizePriceQuote, parsePrice } from "@/lib/resource-pricing/normalization";

describe("resource price normalization", () => {
  it("normalizes currency and keeps four decimal places", () => {
    const result = normalizePriceQuote({
      externalResourceId: "ext-1",
      externalCode: "MAT-1",
      description: " Cemento ",
      category: "MATERIAL",
      unit: "bol",
      currency: "pen",
      price: "25.123456",
      observedAt: "2026-08-17T00:00:00.000Z",
      sourceLabel: " provider ",
      rawHash: "hash",
    });
    expect(result).toMatchObject({ description: "Cemento", currency: "PEN", price: "25.1235", sourceLabel: "provider" });
  });

  it("rejects invalid and negative prices", () => {
    expect(() => parsePrice("NaN")).toThrow();
    expect(() => parsePrice("-1")).toThrow();
  });
});
