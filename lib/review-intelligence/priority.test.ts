import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { calculatePriority, type PriorityInput } from "./priority";

const input = (overrides: Partial<PriorityInput> = {}): PriorityInput => ({
  evidenceConfidence: "HIGH",
  linkConfidence: "HIGH",
  technicalSeverity: "HIGH",
  potentialImpact: new Decimal("1000"),
  ...overrides,
});

describe("calculatePriority", () => {
  it("returns a deterministic versioned score and high priority for a strong finding", () => {
    const result = calculatePriority(input());

    expect(result.priority).toBe("HIGH");
    expect(result.score).toBeInstanceOf(Decimal);
    expect(result.score.toFixed(6)).toBe("1.000000");
    expect(result.version).toBe("priority-v1");
  });

  it("orders high evidence and impact above weak findings", () => {
    const strong = calculatePriority(input());
    const weak = calculatePriority(input({
      evidenceConfidence: "LOW",
      linkConfidence: "LOW",
      technicalSeverity: "LOW",
      potentialImpact: new Decimal("0"),
    }));

    expect(strong.score.greaterThan(weak.score)).toBe(true);
    expect(strong.priority).toBe("HIGH");
    expect(weak.priority).toBe("LOW");
  });

  it("does not let a negative impact create a negative score", () => {
    const result = calculatePriority(input({ potentialImpact: new Decimal("-250") }));

    expect(result.score.greaterThanOrEqualTo(0)).toBe(true);
    expect(result.impactFactor.greaterThanOrEqualTo(0)).toBe(true);
  });
});
