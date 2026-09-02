import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { evaluateFindingRules, type ReviewRuleInput } from "./rules";

const baseInput = (): ReviewRuleInput => ({
  item: {
    id: "item-1",
    quantity: new Decimal("10"),
    unit: "m3",
    unitPrice: new Decimal("25.50"),
    technicalSpecification: "concreto f'c 210",
    apuComponents: ["cemento", "arena"],
  },
  evidence: {
    id: "evidence-1",
    primary: true,
    quantity: new Decimal("12"),
    unit: "m2",
    technicalSpecification: "concreto f'c 280",
    apuComponents: ["cemento"],
  },
  link: { evidenceId: "evidence-1", confidence: "HIGH", score: new Decimal("0.9") },
  tolerance: new Decimal("0.01"),
});

describe("evaluateFindingRules", () => {
  it("produces quantity, unit, technical and incomplete APU findings from primary evidence", () => {
    const findings = evaluateFindingRules(baseInput());
    expect(findings.map((finding) => finding.type)).toEqual([
      "QUANTITY_MISMATCH",
      "UNIT_INCONSISTENCY",
      "TECHNICAL_SPEC_MISMATCH",
      "INCOMPLETE_APU",
    ]);
    expect(findings.every((finding) => finding.evidenceId === "evidence-1")).toBe(true);
    expect(findings.every((finding) => finding.humanReviewRequired && !finding.automaticBudgetMutation)).toBe(true);
    expect(findings[0].comparison?.potentialImpact?.toFixed(2)).toBe("51.00");
    expect(findings[0].priorityVersion).toBe("priority-v1");
  });

  it("reports insufficient documentation with the exact required text and primary coverage evidence", () => {
    const input = baseInput();
    const findings = evaluateFindingRules({ ...input, evidence: { id: "document-1", primary: true }, link: undefined });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ type: "MISSING_DOCUMENTATION", evidenceId: "document-1", message: "No encontramos documentación relacionada con suficiente confianza." });
  });

  it("does not create inconsistencies from a low-confidence candidate", () => {
    const input = baseInput();
    const findings = evaluateFindingRules({ ...input, link: { evidenceId: "evidence-1", confidence: "LOW", score: new Decimal("0.2") } });

    expect(findings).toHaveLength(0);
  });

  it("never publishes a finding without primary evidence and never adds APU resources", () => {
    const input = baseInput();
    const findings = evaluateFindingRules({ ...input, evidence: { ...input.evidence, primary: false } });

    expect(findings).toHaveLength(0);
    expect(input.item.apuComponents).toEqual(["cemento", "arena"]);
  });
});
