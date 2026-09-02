import Decimal from "decimal.js";

export type PriorityConfidence = "LOW" | "MEDIUM" | "HIGH";
export type TechnicalSeverity = "LOW" | "MEDIUM" | "HIGH";

export interface PriorityInput {
  evidenceConfidence: PriorityConfidence;
  linkConfidence: PriorityConfidence;
  technicalSeverity: TechnicalSeverity;
  potentialImpact: Decimal;
}

export interface PriorityResult {
  priority: "LOW" | "MEDIUM" | "HIGH";
  score: Decimal;
  version: string;
  evidenceFactor: Decimal;
  linkFactor: Decimal;
  severityFactor: Decimal;
  impactFactor: Decimal;
}

const VERSION = "priority-v1";
const ONE = new Decimal(1);
const IMPACT_CAP = new Decimal("1000");

function confidenceFactor(value: PriorityConfidence): Decimal {
  if (value === "HIGH") return ONE;
  if (value === "MEDIUM") return new Decimal("0.66");
  return new Decimal("0.33");
}

function impactFactor(value: Decimal): Decimal {
  return Decimal.min(value.abs().dividedBy(IMPACT_CAP), ONE);
}

export function calculatePriority(input: PriorityInput): PriorityResult {
  const evidenceFactor = confidenceFactor(input.evidenceConfidence);
  const linkFactor = confidenceFactor(input.linkConfidence);
  const severityFactor = confidenceFactor(input.technicalSeverity);
  const impact = impactFactor(input.potentialImpact);
  const score = evidenceFactor.times(linkFactor).times(severityFactor).times(impact);

  return {
    priority: score.greaterThanOrEqualTo(new Decimal("0.8"))
      ? "HIGH"
      : score.greaterThanOrEqualTo(new Decimal("0.5"))
        ? "MEDIUM"
        : "LOW",
    score,
    version: VERSION,
    evidenceFactor,
    linkFactor,
    severityFactor,
    impactFactor: impact,
  };
}
