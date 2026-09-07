import { describe, expect, it } from "vitest";
import { validateKnowledgeScope, validateObservationValue } from "./validation";

describe("validateKnowledgeScope", () => {
  it("requires the tenant identifiers implied by the scope", () => {
    expect(() => validateKnowledgeScope({ scope: "GLOBAL" })).not.toThrow();
    expect(() => validateKnowledgeScope({ scope: "COMPANY" })).toThrow("companyId");
    expect(() => validateKnowledgeScope({ scope: "PROJECT", companyId: "c1" })).toThrow("projectId");
    expect(() => validateKnowledgeScope({ scope: "USER", userId: "u1" })).not.toThrow();
  });
});

describe("validateObservationValue", () => {
  it("accepts positive Decimal-compatible values and rejects invalid values", () => {
    expect(validateObservationValue("31.50").toFixed(2)).toBe("31.50");
    expect(() => validateObservationValue("0")).toThrow("positive");
    expect(() => validateObservationValue("not-a-number")).toThrow("Decimal");
  });
});

