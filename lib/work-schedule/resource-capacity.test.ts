import { describe, expect, it } from "vitest";
import { detectResourceOverallocations } from "./resource-capacity";

describe("detectResourceOverallocations", () => {
  it("returns no alerts when demand is under capacity", () => {
    const result = detectResourceOverallocations({
      demands: [{ resourceId: "r1", resourceName: "Acero", periodKey: "2026-03", demandQuantity: 50 }],
      limits: [{ resourceId: "r1", periodKey: "2026-03", quantityCapacity: 100 }],
    });
    expect(result).toEqual([]);
  });

  it("returns no alerts when demand equals capacity", () => {
    const result = detectResourceOverallocations({
      demands: [{ resourceId: "r1", resourceName: "Acero", periodKey: "2026-03", demandQuantity: 100 }],
      limits: [{ resourceId: "r1", periodKey: "2026-03", quantityCapacity: 100 }],
    });
    expect(result).toEqual([]);
  });

  it("returns an alert when demand exceeds capacity", () => {
    const result = detectResourceOverallocations({
      demands: [{ resourceId: "r1", resourceName: "Acero", periodKey: "2026-03", demandQuantity: 150 }],
      limits: [{ resourceId: "r1", periodKey: "2026-03", quantityCapacity: 100 }],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      resourceId: "r1",
      resourceName: "Acero",
      periodKey: "2026-03",
      demandQuantity: 150,
      capacityQuantity: 100,
      excessQuantity: 50,
    });
  });

  it("ignores missing capacity", () => {
    const result = detectResourceOverallocations({
      demands: [{ resourceId: "r1", resourceName: "Acero", periodKey: "2026-03", demandQuantity: 150 }],
      limits: [],
    });
    expect(result).toEqual([]);
  });
});
