import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { evaluateFindingRules, type ReviewRuleInput } from "./rules";

const baseInput = (): ReviewRuleInput => ({
  item: {
    id: "item-1",
    description: "Concreto",
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
  it("detects comparable Decimal yields beyond tolerance with deterministic review details", () => {
    const input = baseInput();
    const findings = evaluateFindingRules({
      ...input,
      item: { ...input.item, yield: new Decimal("100.000") },
      evidence: { ...input.evidence, unit: "m3", yield: new Decimal("102.500") },
      tolerance: new Decimal("1"),
    });

    expect(findings.find((finding) => finding.type === "YIELD_MISMATCH")).toMatchObject({
      type: "YIELD_MISMATCH",
      severity: "HIGH",
      priority: "LOW",
      humanReviewRequired: true,
      automaticBudgetMutation: false,
      comparison: {
        documentValue: "102.5",
        budgetValue: "100",
        difference: "2.5",
        percentage: "2.5",
        unit: "m3",
        details: { documentYield: "102.5", budgetYield: "100" },
      },
    });
  });

  it("does not detect yields within Decimal tolerance", () => {
    const input = baseInput();
    const findings = evaluateFindingRules({
      ...input,
      item: { ...input.item, yield: new Decimal("100") },
      evidence: { ...input.evidence, unit: "m3", yield: new Decimal("101") },
      tolerance: new Decimal("1"),
    });

    expect(findings.some((finding) => finding.type === "YIELD_MISMATCH")).toBe(false);
  });

  it("detects a percentage mismatch for fractional yields without an absolute floor", () => {
    const input = baseInput();
    const findings = evaluateFindingRules({
      ...input,
      item: { ...input.item, yield: new Decimal("0.125") },
      evidence: { ...input.evidence, unit: "m3", yield: new Decimal("0.130") },
      tolerance: new Decimal("1"),
      ruleTypes: ["YIELD_MISMATCH"],
    });

    expect(findings.find((finding) => finding.type === "YIELD_MISMATCH")?.comparison).toMatchObject({
      documentValue: "0.13",
      budgetValue: "0.125",
      difference: "0.005",
      percentage: "4",
    });
  });

  it("produces quantity, unit, technical and incomplete APU findings from primary evidence", () => {
    const input = baseInput();
    const findings = evaluateFindingRules({ ...input, evidence: { ...input.evidence, unit: "m3" } });
    expect(findings.map((finding) => finding.type)).toEqual([
      "QUANTITY_MISMATCH",
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

  it("suppresses missing documentation when the relevant source coverage is incomplete", () => {
    const input = baseInput();

    const findings = evaluateFindingRules({ ...input, evidence: { id: "document-1", primary: true }, link: undefined, hasIncompleteSourceCoverage: true });

    expect(findings).toEqual([]);
  });

  it("does not create inconsistencies from a low-confidence candidate", () => {
    const input = baseInput();
    const findings = evaluateFindingRules({ ...input, link: { evidenceId: "evidence-1", confidence: "LOW", score: new Decimal("0.2") } });

    expect(findings).toHaveLength(1);
    expect(findings[0].type).toBe("MISSING_DOCUMENTATION");
    expect(findings[0].message).toBe("No encontramos documentación relacionada con suficiente confianza.");
  });

  it("never publishes a finding without primary evidence and never adds APU resources", () => {
    const input = baseInput();
    const findings = evaluateFindingRules({ ...input, evidence: { ...input.evidence, primary: false } });

    expect(findings).toHaveLength(0);
    expect(input.item.apuComponents).toEqual(["cemento", "arena"]);
  });

  it("flags an incomplete APU independently of technical specification evidence", () => {
    const input = baseInput();
    const findings = evaluateFindingRules({ ...input, evidence: { ...input.evidence, technicalSpecification: undefined } });

    expect(findings.find((finding) => finding.type === "INCOMPLETE_APU")?.comparison?.details).toEqual({
      missingComponents: "arena",
    });
  });

  it("compares simple resource names with structured budget APU components", () => {
    const input = baseInput();
    const findings = evaluateFindingRules({
      ...input,
      item: {
        ...input.item,
        apuComponents: ["MATERIAL | 0.250 | Cemento", "MATERIAL | 0.500 | Arena gruesa"],
      },
      evidence: {
        ...input.evidence,
        technicalSpecification: input.item.technicalSpecification,
        apuComponents: ["Cemento", "Arena gruesa"],
      },
      ruleTypes: ["INCOMPLETE_APU"],
    });

    expect(findings.some((finding) => finding.type === "INCOMPLETE_APU")).toBe(false);
  });

  it("does not calculate quantity mismatch for incompatible units", () => {
    const findings = evaluateFindingRules(baseInput());

    expect(findings.some((finding) => finding.type === "QUANTITY_MISMATCH")).toBe(false);
  });

  it("does not compare yields without finite values, comparable units, or a trusted primary link", () => {
    const input = baseInput();
    const scenarios: ReviewRuleInput[] = [
      { ...input, item: { ...input.item, yield: undefined }, evidence: { ...input.evidence, unit: "m3", yield: new Decimal("102") } },
      { ...input, item: { ...input.item, yield: new Decimal("100") }, evidence: { ...input.evidence, unit: "m2", yield: new Decimal("102") } },
      { ...input, item: { ...input.item, yield: new Decimal("NaN") }, evidence: { ...input.evidence, unit: "m3", yield: new Decimal("102") } },
      { ...input, item: { ...input.item, yield: new Decimal("100") }, evidence: { ...input.evidence, unit: "m3", yield: new Decimal("102"), primary: false } },
      { ...input, item: { ...input.item, yield: new Decimal("100") }, evidence: { ...input.evidence, unit: "m3", yield: new Decimal("102") }, link: { evidenceId: "evidence-1", confidence: "LOW", score: new Decimal("0.2") } },
    ];

    for (const scenario of scenarios) {
      expect(evaluateFindingRules(scenario).some((finding) => finding.type === "YIELD_MISMATCH")).toBe(false);
    }
  });

  it("normalizes diacritics when comparing technical specifications", () => {
    const input = baseInput();
    const findings = evaluateFindingRules({ ...input, evidence: { ...input.evidence, unit: "m3", technicalSpecification: "Concréto f'c 210" } });

    expect(findings.some((finding) => finding.type === "TECHNICAL_SPEC_MISMATCH")).toBe(false);
  });

  it("does not treat absent or empty technical specifications as incompatible", () => {
    const input = baseInput();
    const findings = evaluateFindingRules({
      ...input,
      evidence: { ...input.evidence, unit: "m3", description: input.item.description, technicalSpecification: "" },
    });

    expect(findings.some((finding) => finding.type === "TECHNICAL_SPEC_MISMATCH")).toBe(false);
  });

  it("reports the missing APU component from trusted evidence", () => {
    const input = baseInput();
    const findings = evaluateFindingRules({
      ...input,
      evidence: { ...input.evidence, unit: "m3", description: input.item.description, technicalSpecification: input.item.technicalSpecification, apuComponents: ["cemento"] },
    });

    expect(findings.find((finding) => finding.type === "INCOMPLETE_APU")?.comparison?.details).toEqual({
      missingComponents: "arena",
    });
  });

  it("detects a different budget item description in the primary document", () => {
    const input = baseInput();
    const findings = evaluateFindingRules({
      ...input,
      item: { ...input.item, description: "EXCAVACION EN EXPLANACIONES EN ROCA FIJA" },
      evidence: { ...input.evidence, unit: "m3", technicalSpecification: input.item.technicalSpecification, description: "EXCAVACION EN EXPLANACIONES EN ROCA DESCONOCIDA" },
    });

    expect(findings.filter((finding) => finding.type === "TECHNICAL_SPEC_MISMATCH")).toHaveLength(1);
    expect(findings.find((finding) => finding.type === "TECHNICAL_SPEC_MISMATCH")?.comparison?.details).toEqual({
      budgetDescription: "EXCAVACION EN EXPLANACIONES EN ROCA FIJA",
      documentDescription: "EXCAVACION EN EXPLANACIONES EN ROCA DESCONOCIDA",
    });
  });
});
