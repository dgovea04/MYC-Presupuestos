import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { matchBudgetItemToEvidence, type BudgetItemMatchInput, type EvidenceMatchInput } from "./matching";

const item: BudgetItemMatchInput = {
  id: "item-1",
  code: "01.01.003",
  description: "Concreto f'c 210 kg/cm2 para zapata",
  unit: "m3",
  discipline: "estructuras",
  attributes: { material: "concreto", strength: "210" },
  location: { row: 12, column: 1 },
};

const evidence = (overrides: Partial<EvidenceMatchInput> = {}): EvidenceMatchInput => ({
  id: "evidence-1",
  primary: true,
  code: "01.01.003",
  description: "Concreto f'c 210 kg/cm2 para zapata",
  unit: "M3",
  discipline: "estructuras",
  attributes: { material: "concreto", strength: "210" },
  location: { row: 13, column: 2 },
  ...overrides,
});

describe("matchBudgetItemToEvidence", () => {
  it("gives explainable high confidence to an exact code match", () => {
    const [candidate] = matchBudgetItemToEvidence(item, [evidence()]);

    expect(candidate).toMatchObject({ evidenceId: "evidence-1", confidence: "HIGH" });
    expect(candidate.score).toBeInstanceOf(Decimal);
    expect(candidate.signals).toMatchObject({ code: 1, description: 1, unit: 1, discipline: 1, attributes: 1 });
  });

  it("uses compatible description and unit signals when code is absent", () => {
    const [candidate] = matchBudgetItemToEvidence(item, [evidence({ code: undefined, description: "Concreto para zapata f'c 210", unit: "m2" })]);

    expect(candidate.confidence).toBe("MEDIUM");
    expect(candidate.signals.description).toBeGreaterThan(0.5);
    expect(candidate.signals.unit).toBe(0);
  });

  it("does not match an evidence row with a different code even when the description is similar", () => {
    const [candidate] = matchBudgetItemToEvidence(item, [evidence({ code: "01.01.004", description: item.description, quantity: new Decimal("999") })]);

    expect(candidate.confidence).toBe("LOW");
    expect(candidate.eligibleForFindings).toBe(false);
    expect(candidate.explanation).toContain("codeConflict=1.000");
  });

  it("keeps an exact code match eligible when description and unit are the mismatched signals", () => {
    const [candidate] = matchBudgetItemToEvidence(
      { ...item, code: "2.7", description: "EXCAVACION EN ROCA", unit: "m3" },
      [evidence({ code: "2.7", description: "RELLENO COMPACTADO", unit: "m2", discipline: undefined, attributes: undefined, location: undefined })],
    );

    expect(candidate.signals.code).toBe(1);
    expect(candidate.eligibleForFindings).toBe(true);
    expect(candidate.confidence).not.toBe("LOW");
  });

  it("treats 2.1 and 2.10 as different textual codes", () => {
    const [candidate] = matchBudgetItemToEvidence({ ...item, code: "2.1" }, [evidence({ code: "2.10", description: "MEJORAMIENTO DE SUBRASANTE" })]);

    expect(candidate.signals.code).toBe(0);
    expect(candidate.eligibleForFindings).toBe(false);
    expect(candidate.explanation).toContain("codeConflict=1.000");
  });

  it("returns low-confidence candidates without making them eligible for inconsistency findings", () => {
    const [candidate] = matchBudgetItemToEvidence(item, [evidence({ code: "99", description: "Puerta de madera", unit: "und", discipline: "arquitectura", attributes: {}, location: { row: 300, column: 1 } })], { highThreshold: 0.9, mediumThreshold: 0.8 });

    expect(candidate.confidence).toBe("LOW");
    expect(candidate.eligibleForFindings).toBe(false);
    expect(candidate.signals.proximity).toBe(0);
  });

  it("includes hierarchy, section, cross-reference, and confirmed-match signals", () => {
    const [candidate] = matchBudgetItemToEvidence({ ...item, hierarchy: ["01", "01.01"], sectionHeader: "Estructuras", crossReferences: ["PL-01"], previouslyConfirmedEvidenceIds: ["evidence-1"] }, [evidence({ hierarchy: ["01", "01.01"], sectionHeader: "Estructuras", crossReferences: ["PL-01"], previouslyConfirmed: true })]);

    expect(candidate.signals).toMatchObject({ hierarchy: 1, sectionHeader: 1, crossReference: 1, confirmedMatch: 1 });
    expect(candidate.explanation).toEqual(expect.arrayContaining([
      expect.stringContaining("hierarchy"),
      expect.stringContaining("sectionHeader"),
      expect.stringContaining("crossReference"),
      expect.stringContaining("confirmedMatch"),
    ]));
  });

  it("rejects non-finite, out-of-range, and inverted confidence thresholds", () => {
    expect(() => matchBudgetItemToEvidence(item, [evidence()], { highThreshold: Number.NaN })).toThrow();
    expect(() => matchBudgetItemToEvidence(item, [evidence()], { mediumThreshold: -0.1 })).toThrow();
    expect(() => matchBudgetItemToEvidence(item, [evidence()], { highThreshold: 0.5, mediumThreshold: 0.5 })).toThrow();
  });

  it("keeps the normalized weighted score at or below one", () => {
    const [candidate] = matchBudgetItemToEvidence({ id: "item-2", code: "A-1", description: "Concreto zapata", unit: "m3" }, [{ id: "evidence-2", primary: true, code: "A-1", description: "Concreto", unit: "m3" }]);

    expect(candidate.score.lessThanOrEqualTo(1)).toBe(true);
    expect(candidate.score.toFixed(9)).toBe("0.838709677");
  });
});
