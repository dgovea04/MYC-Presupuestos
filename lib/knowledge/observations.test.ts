import { describe, expect, it, vi } from "vitest";
import { createPriceObservation } from "./observations";

vi.mock("@/lib/db/prisma", () => ({ prisma: { priceObservation: { create: vi.fn().mockResolvedValue({ id: "p1" }) } } }));

describe("knowledge observations", () => {
  it("persists a positive Decimal price as an observed value", async () => {
    const result = await createPriceObservation({ scope: "COMPANY", companyId: "c1", resourceId: "r1", sourceId: "s1", value: "31.50", unit: "bolsa", observedAt: new Date("2026-09-07"), confidence: "HIGH" });
    expect(result).toEqual({ id: "p1" });
  });
});

