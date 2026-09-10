import Decimal from "decimal.js";
import { calculatePriority } from "./priority";
import { calculateQuantityDifference } from "./calculations";
import { normalizeUnit } from "./units";
import type { ConfidenceLevel, ReviewFindingType } from "./types";

export interface ReviewRuleItem {
  id: string;
  description: string;
  quantity?: Decimal;
  yield?: Decimal;
  unit?: string;
  unitPrice?: Decimal;
  technicalSpecification?: string;
  apuComponents?: string[];
}

export interface ReviewRuleEvidence {
  id: string;
  primary: boolean;
  description?: string;
  quantity?: Decimal;
  yield?: Decimal;
  unit?: string;
  unitPrice?: Decimal;
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
  hasIncompleteSourceCoverage?: boolean;
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
function comparableText(value: string | undefined): string { return (value ?? "").toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, ""); }
function comparableComponent(value: string): string {
  const parts = value.split("|").map((part) => part.trim());
  return comparableText(parts.length >= 3 ? parts.slice(2).join("|") : value);
}
function primaryLink(input: ReviewRuleInput): boolean { return input.evidence.primary && input.link?.evidenceId === input.evidence.id && input.link.confidence !== "LOW"; }
function hasComparableUnits(input: ReviewRuleInput): boolean {
  if (!input.item.unit || !input.evidence.unit) return false;
  const budgetUnit = normalizeUnit(input.item.unit);
  const evidenceUnit = normalizeUnit(input.evidence.unit);
  return budgetUnit.comparable && evidenceUnit.comparable && budgetUnit.canonical === evidenceUnit.canonical;
}
function hasNonEmptyComparableText(value: string | undefined): boolean { return comparableText(value).length > 0; }
function candidate(input: ReviewRuleInput, type: ReviewFindingType, message: string, severity: "LOW" | "MEDIUM" | "HIGH", comparison?: FindingCandidate["comparison"]): FindingCandidate {
  const priority = calculatePriority({ evidenceConfidence: input.evidence.primary ? "HIGH" : "LOW", linkConfidence: input.link?.confidence ?? "LOW", technicalSeverity: severity, potentialImpact: comparison?.potentialImpact ?? new Decimal(0) });
  return { type, budgetItemId: input.item.id, evidenceId: input.evidence.id, message, confidence: input.link?.confidence ?? "LOW", severity, priority: priority.priority, priorityScore: priority.score, priorityVersion: priority.version, comparison, humanReviewRequired: true, automaticBudgetMutation: false };
}

export function evaluateFindingRules(input: ReviewRuleInput): FindingCandidate[] {
  const findings: FindingCandidate[] = [];
  if (enabled(input, "MISSING_DOCUMENTATION") && !input.hasIncompleteSourceCoverage && input.evidence.primary && (!input.link || input.link.confidence === "LOW")) {
    findings.push(candidate({ ...input, link: undefined }, "MISSING_DOCUMENTATION", MISSING_DOCUMENTATION_MESSAGE, "MEDIUM"));
  }
  if (!primaryLink(input)) return findings;
  if (enabled(input, "QUANTITY_MISMATCH") && input.item.quantity !== undefined && input.evidence.quantity !== undefined) {
    if (hasComparableUnits(input)) {
      const comparison = calculateQuantityDifference({ documentValue: input.evidence.quantity, budgetValue: input.item.quantity, unitPrice: input.item.unitPrice, tolerance: input.tolerance });
      if (comparison.exceedsTolerance) findings.push(candidate(input, "QUANTITY_MISMATCH", "La cantidad documentada supera la tolerancia configurada.", "HIGH", { documentValue: comparison.documentValue.toString(), budgetValue: comparison.budgetValue.toString(), difference: comparison.difference.toString(), percentage: comparison.percentage?.toString(), potentialImpact: comparison.potentialImpact ?? undefined, unit: input.item.unit }));
    }
  }
  if (enabled(input, "YIELD_MISMATCH") && input.item.yield?.isFinite() && input.evidence.yield?.isFinite() && hasComparableUnits(input)) {
    const comparison = calculateQuantityDifference({ documentValue: input.evidence.yield, budgetValue: input.item.yield, tolerance: input.tolerance, minimumAbsoluteTolerance: new Decimal(0) });
    if (comparison.exceedsTolerance) {
      findings.push(candidate(input, "YIELD_MISMATCH", "El rendimiento documentado supera la tolerancia configurada.", "HIGH", {
        documentValue: comparison.documentValue.toString(),
        budgetValue: comparison.budgetValue.toString(),
        difference: comparison.difference.toString(),
        percentage: comparison.percentage?.toString(),
        unit: input.item.unit,
        details: { documentYield: comparison.documentValue.toString(), budgetYield: comparison.budgetValue.toString() },
      }));
    }
  }
  if (enabled(input, "PRICE_MISMATCH") && input.item.unitPrice?.isFinite() && input.evidence.unitPrice?.isFinite()) {
    const comparison = calculateQuantityDifference({
      documentValue: input.evidence.unitPrice,
      budgetValue: input.item.unitPrice,
      tolerance: input.tolerance,
      minimumAbsoluteTolerance: new Decimal("0.01"),
    });
    if (comparison.exceedsTolerance) {
      findings.push(candidate(input, "PRICE_MISMATCH", "El precio unitario documentado supera la tolerancia configurada.", "HIGH", {
        documentValue: comparison.documentValue.toString(),
        budgetValue: comparison.budgetValue.toString(),
        difference: comparison.difference.toString(),
        percentage: comparison.percentage?.toString(),
        unit: input.item.unit,
        details: { documentUnitPrice: comparison.documentValue.toString(), budgetUnitPrice: comparison.budgetValue.toString() },
      }));
    }
  }
  if (enabled(input, "UNIT_INCONSISTENCY") && input.item.unit && input.evidence.unit && normalizeUnit(input.item.unit).canonical !== normalizeUnit(input.evidence.unit).canonical) findings.push(candidate(input, "UNIT_INCONSISTENCY", "La unidad documentada puede ser inconsistente con la partida.", "HIGH", { unit: input.item.unit, details: { documentUnit: input.evidence.unit } }));
  const descriptionMismatch = input.item.description !== undefined && input.evidence.description !== undefined && comparableText(input.item.description) !== comparableText(input.evidence.description);
  const technicalSpecificationMismatch = hasNonEmptyComparableText(input.item.technicalSpecification) && hasNonEmptyComparableText(input.evidence.technicalSpecification) && comparableText(input.item.technicalSpecification) !== comparableText(input.evidence.technicalSpecification);
  if (enabled(input, "TECHNICAL_SPEC_MISMATCH") && (descriptionMismatch || technicalSpecificationMismatch)) {
    const details: Record<string, string> = {};
    if (descriptionMismatch) {
      details.budgetDescription = input.item.description;
      details.documentDescription = input.evidence.description!;
    }
    if (technicalSpecificationMismatch) {
      details.budgetSpecification = input.item.technicalSpecification!;
      details.documentSpecification = input.evidence.technicalSpecification!;
    }
    findings.push(candidate(input, "TECHNICAL_SPEC_MISMATCH", "La descripciÃ³n o especificaciÃ³n tÃ©cnica documentada puede ser incompatible.", "HIGH", { details }));
  }
  if (enabled(input, "INCOMPLETE_APU") && input.item.apuComponents && input.evidence.apuComponents) {
    const missingComponents = input.item.apuComponents.filter((component) => !input.evidence.apuComponents?.some((seen) => comparableComponent(seen) === comparableComponent(component)));
    if (missingComponents.length > 0) findings.push(candidate(input, "INCOMPLETE_APU", "El APU documentado puede estar incompleto.", "MEDIUM", { details: { missingComponents: missingComponents.join(", ") } }));
  }
  return findings;
}

export { MISSING_DOCUMENTATION_MESSAGE, RULE_VERSION };
