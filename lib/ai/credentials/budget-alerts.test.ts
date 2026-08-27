import { describe, expect, it } from "vitest";
import { getCrossedAlertThresholds } from "@/lib/ai/credentials/budget-alerts";

describe("getCrossedAlertThresholds", () => {
  it("returns only thresholds crossed by the current usage", () => {
    expect(getCrossedAlertThresholds(79, 101, [80, 90, 100, 100])).toEqual([80, 90, 100]);
    expect(getCrossedAlertThresholds(90, 90, [80, 90, 100])).toEqual([]);
  });
});
