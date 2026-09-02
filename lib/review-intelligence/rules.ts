import Decimal from "decimal.js";
import { calculatePriority } from "./priority";
import { calculateQuantityDifference } from "./calculations";
import { normalizeUnit } from "./units";
import type { ConfidenceLevel, ReviewFindingType } from "./types";

export interface ReviewRuleItem {
  id: string;
  quantity?: Decimal;
  unit?: string;
  unitPrice?: Decimal;
  technicalSpecification?: string;
  apuComponents?: string[];
}

export interface ReviewRuleEvidence {
  id: string;
  primary: boolean;
  quantity?: Decimal;
  unit?: string;
  technicalSpecification?: string;
  apuComponents?: string[];
}

export interface RuleLink { evidenceId: string; confidence: ConfidenceLevel; score: Decimal; }

export interface FindingComparison {
  documentValue?: string;
  budgetValue?: string;
  difference?: string;
  percentage?: string;
  potentialImpact?: Decimal;
  unit?: string;
  details?: Record<string, string>;
}

export interface ReviewRuleInput {
  item: ReviewRuleItem;
  evidence: ReviewRuleEvidence;
  link?: RuleLink;
  tolerance: Decimal;
  ruleTypes?: ReviewFindingType[];
}

export interface FindingCandidate {
  type: ReviewFindingType;
  budgetItemId: string;
  evidenceId: string;
  message: string;
  confidence: ConfidenceLevel;
  severity: "LOW" | "MEDIUM" | "HIGH";
  priority: "LOW" | "MEDIUM" | "HIGH";
  priorityScore: Decimal;
  priorityVersion: string;
  comparison?: FindingComparison;
  humanReviewRequired: true;
  automaticBudgetMutation: false;
}

const MISSING_DOCUMENTATION_MESSAGE = "No encontramos documentación relacionada con suficiente confianza.";
const RULE_VERSION = "review-rules-v1";

function enabled(input: ReviewRuleInput, type: ReviewFindingType): boolean { return input.ruleTypes === undefined || input.ruleTypes.includes(type); }
function comparableText(value: string | undefined): string { return (value ?? "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, ""); }
function primaryLink(input: ReviewRuleInput): boolean { return input.evidence.primary && input.link?.evidenceId === input.evidence.id && input.link.confidence !== "LOW"; }
function candidate(input: ReviewRuleInput, type: ReviewFindingType, message: string, severity: "LOW" | "MEDIUM" | "HIGH", comparison?: FindingCandidate["comparison"]): FindingCandidate {
  const priority = calculatePriority({ evidenceConfidence: input.evidence.primary ? "HIGH" : "LOW", linkConfidence: input.link?.confidence ?? "LOW", technicalSeverity: severity, potentialImpact: comparison?.potentialImpact ?? new Decimal(0) });
  return { type, budgetItemId: input.item.id, evidenceId: input.evidence.id, message, confidence: input.link?.confidence ?? "LOW", severity, priority: priority.priority, priorityScore: priority.score, priorityVersion: priority.version, comparison, humanReviewRequired: true, automaticBudgetMutation: false };
}

export function evaluateFindingRules(input: ReviewRuleInput): FindingCandidate[] {
  const findings: FindingCandidate[] = [];
  if (enabled(input, "MISSING_DOCUMENTATION") && input.evidence.primary && !input.link) {
    findings.push(candidate({ ...input, link: undefined }, "MISSING_DOCUMENTATION", MISSING_DOCUMENTATION_MESSAGE, "MEDIUM"));
  }
  if (!primaryLink(input)) return findings;
  if (enabled(input, "QUANTITY_MISMATCH") && input.item.quantity !== undefined && input.evidence.quantity !== undefined) {
    const comparison = calculateQuantityDifference({ documentValue: input.evidence.quantity, budgetValue: input.item.quantity, unitPrice: input.item.unitPrice, tolerance: input.tolerance });
    if (comparison.exceedsTolerance) findings.push(candidate(input, "QUANTITY_MISMATCH", "La cantidad documentada supera la tolerancia configurada.", "HIGH", { documentValue: comparison.documentValue.toString(), budgetValue: comparison.budgetValue.toString(), difference: comparison.difference.toString(), percentage: comparison.percentage?.toString(), potentialImpact: comparison.potentialImpact ?? undefined, unit: input.item.unit }));
  }
  if (enabled(input, "UNIT_INCONSISTENCY") && input.item.unit && input.evidence.unit && normalizeUnit(input.item.unit).canonical !== normalizeUnit(input.evidence.unit).canonical) findings.push(candidate(input, "UNIT_INCONSISTENCY", "La unidad documentada puede ser inconsistente con la partida.", "HIGH", { unit: input.item.unit, details: { documentUnit: input.evidence.unit } }));
  if (enabled(input, "TECHNICAL_SPEC_MISMATCH") && input.item.technicalSpecification && input.evidence.technicalSpecification && comparableText(input.item.technicalSpecification) !== comparableText(input.evidence.technicalSpecification)) findings.push(candidate(input, "TECHNICAL_SPEC_MISMATCH", "La especificación técnica documentada puede ser incompatible.", "HIGH", { details: { budgetSpecification: input.item.technicalSpecification, documentSpecification: input.evidence.technicalSpecification } }));
  if (enabled(input, "INCOMPLETE_APU") && input.item.apuComponents && input.evidence.apuComponents && input.item.apuComponents.some((component) => !input.evidence.apuComponents?.some((seen) => comparableText(seen) === comparableText(component)))) findings.push(candidate(input, "INCOMPLETE_APU", "El APU documentado puede estar incompleto.", "MEDIUM", { details: { missingComponents: input.item.apuComponents.filter((component) => !input.evidence.apuComponents?.some((seen) => comparableText(seen) === comparableText(component))).join(", ") } }));
  return findings;
}

export { MISSING_DOCUMENTATION_MESSAGE, RULE_VERSION };
