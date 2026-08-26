import { describe, expect, it } from "vitest";
import { acquisitionOffers } from "@/components/landing/acquisition/acquisition-landing-content";

describe("acquisition landing offer positioning", () => {
  it("keeps the free plan primary and mentions Pro as the only upgrade path", () => {
    expect(acquisitionOffers).toHaveLength(1);
    expect(acquisitionOffers.map((offer) => offer.name)).toEqual(["Starter"]);
    expect(acquisitionOffers[0]?.highlighted).toBe(true);
  });
});
