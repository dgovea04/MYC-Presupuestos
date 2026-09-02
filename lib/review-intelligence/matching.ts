import { normalizeUnit } from "./units";
import type { ConfidenceLevel, SignalsJson } from "./types";
import Decimal from "decimal.js";

export interface MatchLocation { row?: number; column?: number; page?: number; }

export interface BudgetItemMatchInput {
  id: string;
  code?: string;
  description: string;
  unit?: string;
  discipline?: string;
  attributes?: Record<string, string>;
  location?: MatchLocation;
}

export interface EvidenceMatchInput {
  id: string;
  primary: boolean;
  code?: string;
  description?: string;
  unit?: string;
  discipline?: string;
  attributes?: Record<string, string>;
  location?: MatchLocation;
}

export interface MatchingOptions {
  highThreshold?: number;
  mediumThreshold?: number;
}

export interface EntityLinkCandidate {
  budgetItemId: string;
  evidenceId: string;
  score: Decimal;
  confidence: ConfidenceLevel;
  eligibleForFindings: boolean;
  signals: SignalsJson;
}

const DEFAULTS = { highThreshold: 0.8, mediumThreshold: 0.5 } as const;

function normalizedText(value: string | undefined): string {
  return (value ?? "").toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function tokens(value: string | undefined): Set<string> {
  return new Set(normalizedText(value).split(/\s+/).filter(Boolean));
}

function descriptionSignal(left: string, right: string | undefined): number {
  const a = tokens(left); const b = tokens(right);
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

function attributesSignal(left: Record<string, string> | undefined, right: Record<string, string> | undefined): number {
  const entries = Object.entries(left ?? {});
  if (entries.length === 0) return 0;
  let matches = 0;
  for (const [key, value] of entries) if (normalizedText(right?.[key]) === normalizedText(value)) matches += 1;
  return matches / entries.length;
}

function proximitySignal(left: MatchLocation | undefined, right: MatchLocation | undefined): number {
  if (left?.row === undefined || right?.row === undefined) return 0;
  const distance = Math.abs(left.row - right.row) + Math.abs((left.column ?? 0) - (right.column ?? 0));
  return distance <= 5 ? 1 : distance <= 20 ? 0.5 : 0;
}

function confidenceFor(score: number, options: Required<MatchingOptions>): ConfidenceLevel {
  return score >= options.highThreshold ? "HIGH" : score >= options.mediumThreshold ? "MEDIUM" : "LOW";
}

export function matchBudgetItemToEvidence(
  item: BudgetItemMatchInput,
  evidence: EvidenceMatchInput[],
  options: MatchingOptions = {},
): EntityLinkCandidate[] {
  const thresholds = { ...DEFAULTS, ...options };
  return evidence.map((entry) => {
    const signals: SignalsJson = {
      code: item.code !== undefined && entry.code !== undefined && normalizedText(item.code) === normalizedText(entry.code) ? 1 : 0,
      description: descriptionSignal(item.description, entry.description),
      unit: item.unit && entry.unit ? (normalizeUnit(item.unit).canonical === normalizeUnit(entry.unit).canonical ? 1 : 0) : 0,
      discipline: item.discipline && entry.discipline && normalizedText(item.discipline) === normalizedText(entry.discipline) ? 1 : 0,
      attributes: attributesSignal(item.attributes, entry.attributes),
      proximity: proximitySignal(item.location, entry.location),
    };
    const weights: Readonly<Record<string, string>> = { code: "0.35", description: "0.25", unit: "0.15", discipline: "0.1", attributes: "0.1", proximity: "0.05" };
    const activeWeight = Object.entries(signals).reduce((total, [signal, value]) => total.plus(value > 0 || (signal === "description" && entry.description !== undefined) || (signal === "unit" && entry.unit !== undefined) || (signal === "discipline" && entry.discipline !== undefined) || (signal === "attributes" && entry.attributes !== undefined) || (signal === "proximity" && entry.location?.row !== undefined) || (signal === "code" && entry.code !== undefined) ? new Decimal(weights[signal]) : new Decimal(0)), new Decimal(0));
    const weightedScore = new Decimal(signals.code).times(weights.code)
      .plus(new Decimal(signals.description).times("0.25"))
      .plus(new Decimal(signals.unit).times("0.15"))
      .plus(new Decimal(signals.discipline).times("0.1"))
      .plus(new Decimal(signals.attributes).times("0.1"))
      .plus(new Decimal(signals.proximity).times("0.05"));
    const score = activeWeight.isZero() ? new Decimal(0) : weightedScore.dividedBy(activeWeight);
    const confidence = confidenceFor(score.toNumber(), thresholds);
    return { budgetItemId: item.id, evidenceId: entry.id, score, confidence, eligibleForFindings: confidence !== "LOW", signals };
  }).sort((left, right) => right.score.comparedTo(left.score));
}
