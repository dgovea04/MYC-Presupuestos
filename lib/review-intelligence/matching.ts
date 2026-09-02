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
  hierarchy?: string[];
  sectionHeader?: string;
  crossReferences?: string[];
  previouslyConfirmedEvidenceIds?: string[];
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
  hierarchy?: string[];
  sectionHeader?: string;
  crossReferences?: string[];
  previouslyConfirmed?: boolean;
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
  explanation: string[];
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

function validateThresholds(options: Required<MatchingOptions>): void {
  if (!Number.isFinite(options.highThreshold) || !Number.isFinite(options.mediumThreshold)
    || options.highThreshold < 0 || options.highThreshold > 1
    || options.mediumThreshold < 0 || options.mediumThreshold > 1
    || options.highThreshold <= options.mediumThreshold) {
    throw new Error("Matching thresholds must be finite, within 0..1, and highThreshold must exceed mediumThreshold.");
  }
}

function listSignal(left: string[] | undefined, right: string[] | undefined): number {
  if (!left?.length || !right?.length) return 0;
  const normalizedRight = new Set(right.map((value) => normalizedText(value)));
  const matches = left.filter((value) => normalizedRight.has(normalizedText(value))).length;
  return matches / left.length;
}

function hierarchySignal(left: string[] | undefined, right: string[] | undefined): number {
  if (!left?.length || !right?.length) return 0;
  let common = 0;
  while (common < left.length && common < right.length && normalizedText(left[common]) === normalizedText(right[common])) common += 1;
  return common / Math.max(left.length, right.length);
}

export function matchBudgetItemToEvidence(
  item: BudgetItemMatchInput,
  evidence: EvidenceMatchInput[],
  options: MatchingOptions = {},
): EntityLinkCandidate[] {
  const thresholds = { ...DEFAULTS, ...options };
  validateThresholds(thresholds);
  return evidence.map((entry) => {
    const signals: SignalsJson = {
      code: item.code !== undefined && entry.code !== undefined && normalizedText(item.code) === normalizedText(entry.code) ? 1 : 0,
      description: descriptionSignal(item.description, entry.description),
      unit: item.unit && entry.unit ? (normalizeUnit(item.unit).canonical === normalizeUnit(entry.unit).canonical ? 1 : 0) : 0,
      discipline: item.discipline && entry.discipline && normalizedText(item.discipline) === normalizedText(entry.discipline) ? 1 : 0,
      attributes: attributesSignal(item.attributes, entry.attributes),
      proximity: proximitySignal(item.location, entry.location),
      hierarchy: hierarchySignal(item.hierarchy, entry.hierarchy),
      sectionHeader: item.sectionHeader && entry.sectionHeader && normalizedText(item.sectionHeader) === normalizedText(entry.sectionHeader) ? 1 : 0,
      crossReference: listSignal(item.crossReferences, entry.crossReferences),
      confirmedMatch: item.previouslyConfirmedEvidenceIds?.includes(entry.id) || entry.previouslyConfirmed === true ? 1 : 0,
    };
    const weights: Readonly<Record<string, string>> = { code: "0.3", description: "0.2", unit: "0.12", discipline: "0.08", attributes: "0.08", proximity: "0.05", hierarchy: "0.06", sectionHeader: "0.04", crossReference: "0.03", confirmedMatch: "0.04" };
    const available: Readonly<Record<string, boolean>> = {
      code: entry.code !== undefined, description: entry.description !== undefined, unit: entry.unit !== undefined,
      discipline: entry.discipline !== undefined, attributes: entry.attributes !== undefined, proximity: entry.location?.row !== undefined,
      hierarchy: entry.hierarchy !== undefined, sectionHeader: entry.sectionHeader !== undefined, crossReference: entry.crossReferences !== undefined,
      confirmedMatch: entry.previouslyConfirmed !== undefined || item.previouslyConfirmedEvidenceIds !== undefined,
    };
    const activeWeight = Object.entries(available).reduce((total, [signal, isAvailable]) => total.plus(isAvailable ? new Decimal(weights[signal]) : new Decimal(0)), new Decimal(0));
    const weightedScore = new Decimal(signals.code).times(weights.code)
      .plus(new Decimal(signals.description).times("0.25"))
      .plus(new Decimal(signals.unit).times(weights.unit))
      .plus(new Decimal(signals.discipline).times(weights.discipline))
      .plus(new Decimal(signals.attributes).times(weights.attributes))
      .plus(new Decimal(signals.proximity).times(weights.proximity))
      .plus(new Decimal(signals.hierarchy).times(weights.hierarchy))
      .plus(new Decimal(signals.sectionHeader).times(weights.sectionHeader))
      .plus(new Decimal(signals.crossReference).times(weights.crossReference))
      .plus(new Decimal(signals.confirmedMatch).times(weights.confirmedMatch));
    const score = activeWeight.isZero() ? new Decimal(0) : weightedScore.dividedBy(activeWeight);
    const confidence = confidenceFor(score.toNumber(), thresholds);
    const explanation = Object.entries(signals).filter(([, value]) => value > 0).map(([signal, value]) => `${signal}=${value.toFixed(3)}`);
    return { budgetItemId: item.id, evidenceId: entry.id, score, confidence, eligibleForFindings: confidence !== "LOW", signals, explanation };
  }).sort((left, right) => right.score.comparedTo(left.score));
}
