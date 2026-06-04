import type { PolynomialCostGroupKey, PolynomialMonomialRecord } from "@/types/polynomial-formula";

export type FinalAdjustmentDiagnosticSeverity = "INFO" | "WARNING" | "ERROR";

export type FinalAdjustmentDiagnosticCode =
  | "FINAL_MONOMIAL_COUNT_BELOW_MINIMUM"
  | "FINAL_MONOMIAL_COUNT_ABOVE_MAXIMUM"
  | "LOW_COEFFICIENT_MERGED"
  | "LOW_COEFFICIENT_UNRESOLVED"
  | "CROSS_AFFINITY_FALLBACK"
  | "EXPERIENCE_HINT_USED"
  | "EXPERIENCE_HINT_REJECTED"
  | "COEFFICIENT_NORMALIZED";

export type FinalAdjustmentDiagnostic = {
  readonly code: FinalAdjustmentDiagnosticCode;
  readonly severity: FinalAdjustmentDiagnosticSeverity;
  readonly message: string;
  readonly monomialIds?: readonly string[];
};

export type FinalAdjustmentMergeReason =
  | "SAME_IU_CODE"
  | "SAME_IU_FAMILY"
  | "COMPATIBLE_FAMILY"
  | "SAME_BROAD_GROUP"
  | "HIGHEST_INCIDENCE_FALLBACK"
  | "EXPERIENCE_HINT";

export type FinalAdjustmentMergePlanEntry = {
  readonly targetMonomialId: string;
  readonly sourceMonomialIds: readonly string[];
  readonly reason: FinalAdjustmentMergeReason;
  readonly explanation: string;
};

export type FinalAdjustmentExperienceHint = {
  readonly sourceIuFamily?: string;
  readonly sourceUnifiedIndexCode?: string;
  readonly targetIuFamily?: string;
  readonly targetUnifiedIndexCode?: string;
  readonly targetCode?: string;
  readonly targetName?: string;
  readonly costGroupKey?: PolynomialCostGroupKey;
  readonly weight: number;
  readonly evidenceLabel: string;
};

export type FinalAdjustmentOptions = {
  readonly minCoefficient: string;
  readonly minMonomials: number;
  readonly maxMonomials: number;
  readonly coefficientDecimals: number;
  readonly experienceHints?: readonly FinalAdjustmentExperienceHint[];
};

export type FinalAdjustmentResult = {
  readonly originalMonomials: readonly PolynomialMonomialRecord[];
  readonly finalMonomials: readonly PolynomialMonomialRecord[];
  readonly mergePlan: readonly FinalAdjustmentMergePlanEntry[];
  readonly diagnostics: readonly FinalAdjustmentDiagnostic[];
  readonly canApply: boolean;
};

export const DEFAULT_FINAL_ADJUSTMENT_OPTIONS: FinalAdjustmentOptions = {
  minCoefficient: "0.050",
  minMonomials: 5,
  maxMonomials: 8,
  coefficientDecimals: 3,
  experienceHints: [],
};
