import { describe, expect, it } from "vitest";
import { resourcePriceProviderConfigSchema, resourcePriceUpdateRequestSchema } from "@/lib/validations/resource-pricing";

describe("resource pricing validations", () => {
  it("accepts a request without provider selection", () => {
    expect(resourcePriceUpdateRequestSchema.parse({ resourceIds: ["resource-1"], mode: "ON_DEMAND" })).toMatchObject({ mode: "ON_DEMAND" });
  });

  it("rejects provider injection from a user request", () => {
    expect(() => resourcePriceUpdateRequestSchema.parse({ provider: "fake" })).toThrow();
    expect(() => resourcePriceUpdateRequestSchema.parse({ baseUrl: "https://example.com" })).toThrow();
  });

  it("validates an admin provider configuration", () => {
    expect(resourcePriceProviderConfigSchema.parse({ provider: "mc-presupuestos-price-api", status: "DISABLED" })).toMatchObject({ apiVersion: "v1" });
  });
});
