import { describe, expect, it } from "vitest";
import { FakeResourcePriceProvider, ResourcePriceProviderError } from "@/lib/resource-pricing/provider";

describe("resource price providers", () => {
  it("returns deterministic development quotes without changing the supplied price", async () => {
    const provider = new FakeResourcePriceProvider();
    const quotes = await provider.lookup([{ description: "Cemento", unit: "bol", currency: "PEN", currentPrice: "25.1234", code: "MAT-001" }]);
    expect(quotes[0]).toMatchObject({ price: "25.1234", unit: "bol", currency: "PEN" });
  });

  it("exposes typed provider errors", () => {
    const error = new ResourcePriceProviderError("RATE_LIMITED", "rate limited");
    expect(error.code).toBe("RATE_LIMITED");
    expect(error).toBeInstanceOf(Error);
  });
});
