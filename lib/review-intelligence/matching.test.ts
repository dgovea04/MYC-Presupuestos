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

  it("adds normalized specification, yield, and APU component signals when technical data is compatible", () => {
    const [candidate] = matchBudgetItemToEvidence({
      ...item,
      technicalSpecification: "Concreto f'c 210 kg/cm²",
      yield: new Decimal("0.125"),
      apuComponents: ["Material | 1 | Cemento Portland", "Agregado | 2 | Arena gruesa"],
    }, [evidence({
      technicalSpecification: "CONCRETO FC 210 KG/CM2",
      yield: new Decimal("0.125"),
      apuComponents: ["agregado 2 arena gruesa", "Material 1 cemento portland", "Agua"],
    })]);

    expect(candidate.signals).toMatchObject({ yield: 1, apuComponents: 1, unitAlias: 1 });
    expect(candidate.signals.specification).toBeGreaterThan(0);
    expect(candidate.explanation).toEqual(expect.arrayContaining([
      expect.stringContaining("specification="),
      "yield=1.000",
      "apuComponents=1.000",
      "unitAlias=1.000",
    ]));
  });

  it("recognizes equivalent units through the unit alias signal", () => {
    const [candidate] = matchBudgetItemToEvidence({ ...item, unit: "m3" }, [evidence({ unit: "M3" })]);

    expect(candidate.signals.unit).toBe(1);
    expect(candidate.signals.unitAlias).toBe(1);
  });

  it("keeps optional technical signals out of score normalization when they are missing", () => {
    const [baseline] = matchBudgetItemToEvidence({ id: "item-3", description: "Concreto", unit: "m3" }, [{ id: "evidence-3", primary: true, description: "Concreto", unit: "m3" }]);
    const [withMissingTechnicalFields] = matchBudgetItemToEvidence({ id: "item-3", description: "Concreto", unit: "m3", technicalSpecification: undefined, yield: undefined, apuComponents: undefined }, [{ id: "evidence-3", primary: true, description: "Concreto", unit: "m3", technicalSpecification: undefined, yield: undefined, apuComponents: undefined }]);

    expect(withMissingTechnicalFields.score.equals(baseline.score)).toBe(true);
  });

  it("does not normalize a match against evidence-only code and unit fields", () => {
    const [candidate] = matchBudgetItemToEvidence(
      { id: "item-one-sided", description: "Concreto" },
      [{ id: "evidence-one-sided", primary: true, code: "A-1", description: "Concreto", unit: "m3" }],
    );

    expect(candidate.score.equals(1)).toBe(true);
    expect(candidate.confidence).toBe("HIGH");
  });

  it("keeps empty APU component arrays out of score normalization", () => {
    const [baseline] = matchBudgetItemToEvidence({ id: "item-empty-components", description: "Concreto" }, [{ id: "evidence-empty-components", primary: true, description: "Concreto" }]);
    const [withEmptyComponents] = matchBudgetItemToEvidence({ id: "item-empty-components", description: "Concreto", apuComponents: [] }, [{ id: "evidence-empty-components", primary: true, description: "Concreto", apuComponents: [] }]);

    expect(withEmptyComponents.score.equals(baseline.score)).toBe(true);
  });
});
