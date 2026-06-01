import Decimal from "decimal.js";

import type { PolynomialIuFamily } from "./iu-family-classifier";

export const POLYNOMIAL_FORMULA_DEFAULT_MIN_COEFFICIENT = new Decimal("0.050");
export const POLYNOMIAL_FORMULA_DEFAULT_MAX_MONOMIALS = 10;
export const POLYNOMIAL_FORMULA_DEFAULT_COEFFICIENT_DECIMALS = 3;

export type SmartMonomialBroadGroup =
  | "LABOR"
  | "MATERIALS"
  | "EQUIPMENT"
  | "OTHERS"
  | "GENERAL_EXPENSES_PROFIT";

export type SmartMonomialProposalStatus =
  | "LOCKED"
  | "ACCEPTED"
  | "BELOW_MINIMUM_COEFFICIENT"
  | "MERGED_PRELIMINARILY"
  | "USER_MERGE_CANDIDATE"
  | "SPLIT_BY_IU_FAMILY"
  | "ZERO_COEFFICIENT";

export type SmartMonomialProposalReason =
  | "LOCKED_MONOMIAL"
  | "ACCEPTED"
  | "BELOW_MINIMUM_COEFFICIENT"
  | "MERGED_PRELIMINARILY"
  | "USER_MERGE_CANDIDATE"
  | "SPLIT_BY_IU_FAMILY"
  | "ZERO_COEFFICIENT";

export type SmartMonomialSourceLabel = {
  readonly label: string;
  readonly value: string;
};

export type SmartMonomialInputItem = {
  readonly id: string;
  readonly sourceId: string;
  readonly broadGroup: SmartMonomialBroadGroup;
  readonly amount: Decimal;
  readonly baseAmount: Decimal;
  readonly iuFamily: PolynomialIuFamily;
  readonly unifiedIndexCode?: string;
  readonly unifiedIndexName?: string;
  readonly displayName?: string;
  readonly categoryLabel?: string;
  readonly sourceLabel?: string;
  readonly sourceLabels?: readonly SmartMonomialSourceLabel[];
};

export type SmartMonomialCompositionRow = {
  readonly unifiedIndexCode?: string;
  readonly unifiedIndexName?: string;
  readonly iuFamily: PolynomialIuFamily;
  readonly amount: Decimal;
  readonly participationPercentage: Decimal;
  readonly coefficientContribution: Decimal;
  readonly sourceItemIds: readonly string[];
};

export type SmartMonomialProposal = {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly broadGroup: SmartMonomialBroadGroup;
  readonly representativeUnifiedIndexCode?: string;
  readonly representativeUnifiedIndexName?: string;
  readonly amount: Decimal;
  readonly coefficient: Decimal;
  readonly sourceItemIds: readonly string[];
  readonly compositionRows: readonly SmartMonomialCompositionRow[];
  readonly locked: boolean;
  readonly statuses: readonly SmartMonomialProposalStatus[];
  readonly reasons: readonly SmartMonomialProposalReason[];
};

export type SmartMonomialEngineOptions = {
  readonly minCoefficientThreshold: Decimal;
  readonly maxMonomials: number;
  readonly coefficientDecimals: number;
};

export type SmartMonomialDiagnosticSeverity = "INFO" | "WARNING" | "ERROR";

export type SmartMonomialDiagnostic = {
  readonly code: SmartMonomialProposalReason;
  readonly severity: SmartMonomialDiagnosticSeverity;
  readonly message: string;
  readonly monomialId?: string;
  readonly sourceItemIds?: readonly string[];
};

export type SmartMonomialBroadGroupSummary = {
  readonly broadGroup: SmartMonomialBroadGroup;
  readonly amount: Decimal;
  readonly coefficient: Decimal;
  readonly sourceItemIds: readonly string[];
};

export type SmartMonomialEngineResult = {
  readonly proposedMonomials: readonly SmartMonomialProposal[];
  readonly diagnostics: readonly SmartMonomialDiagnostic[];
  readonly initialBroadGroupSummary: readonly SmartMonomialBroadGroupSummary[];
};
