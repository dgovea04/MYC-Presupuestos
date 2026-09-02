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

  it("returns low-confidence candidates without making them eligible for inconsistency findings", () => {
    const [candidate] = matchBudgetItemToEvidence(item, [evidence({ code: "99", description: "Puerta de madera", unit: "und", discipline: "arquitectura", attributes: {}, location: { row: 300, column: 1 } })], { highThreshold: 0.9, mediumThreshold: 0.8 });

    expect(candidate.confidence).toBe("LOW");
    expect(candidate.eligibleForFindings).toBe(false);
    expect(candidate.signals.proximity).toBe(0);
  });
});
