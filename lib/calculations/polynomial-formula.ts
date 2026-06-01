import Decimal from "decimal.js";

import type {
  AdjustmentAmountCalculationInput,
  AdjustmentAmountCalculationResult,
  BudgetCostGroupCalculationInput,
  BudgetCostGroupCalculationResult,
  CoefficientKCalculationInput,
  CoefficientKCalculationResult,
  MonomialCoefficientCalculationInput,
  PolynomialValidationMonomialInput,
} from "@/lib/polynomial-formula/types";
import { POLYNOMIAL_FORMULA_DEFAULT_MAX_MONOMIALS } from "@/lib/polynomial-formula/smart-monomial-types";
import type {
  PolynomialCompositionDiagnostic,
  PolynomialFormulaValidationResult,
} from "@/types/polynomial-formula";

const COEFFICIENT_DECIMALS = 3;
const K_VALUE_DECIMALS = 3;
const CURRENCY_DECIMALS = 2;
const GROUP_AMOUNT_DECIMALS = 4;
const K_RAW_DECIMALS = 4;
const COEFFICIENT_SCALE = new Decimal(10).pow(COEFFICIENT_DECIMALS);
const COEFFICIENT_SUM_TARGET = new Decimal(1);
const COEFFICIENT_SUM_TOLERANCE = new Decimal("0.001");
const MINIMUM_COEFFICIENT_WARNING = new Decimal("0.05");
const COMPOSITION_COVERAGE_TOLERANCE = new Decimal("0.001");
const ZERO = new Decimal(0);

function toDecimal(value: string): Decimal {
  return new Decimal(value);
}

function formatFixed(value: Decimal.Value, decimalPlaces: number): string {
  return new Decimal(value).toDecimalPlaces(decimalPlaces).toFixed(decimalPlaces);
}

function assertPositiveIndex(value: string, label: string, monomialName: string): void {
  if (toDecimal(value).lessThanOrEqualTo(ZERO)) {
    throw new Error(`${label} for ${monomialName} must be greater than zero`);
  }
}

function isMissingOrNonPositive(value: string | null | undefined): boolean {
  return value === null || value === undefined || toDecimal(value).lessThanOrEqualTo(ZERO);
}

function getMonomialLabel(monomial: PolynomialValidationMonomialInput): string {
  const name = monomial.name?.trim();
  if (name) return name;

  const code = monomial.code?.trim();
  if (code) return code;

  return "Monomio";
}

function uniqueNonEmptyValues(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

export function roundCoefficient(value: string): string {
  return formatFixed(value, COEFFICIENT_DECIMALS);
}

export function roundKValue(value: string): string {
  return formatFixed(value, K_VALUE_DECIMALS);
}

export function roundCurrency(value: string): string {
  return formatFixed(value, CURRENCY_DECIMALS);
}

export function calculateBudgetCostGroups(
  input: BudgetCostGroupCalculationInput,
): BudgetCostGroupCalculationResult {
  const groups = [
    {
      key: "LABOR" as const,
      amount: formatFixed(input.directCostBreakdown.labor, GROUP_AMOUNT_DECIMALS),
    },
    {
      key: "MATERIALS" as const,
      amount: formatFixed(
        input.directCostBreakdown.materials,
        GROUP_AMOUNT_DECIMALS,
      ),
    },
    {
      key: "EQUIPMENT" as const,
      amount: formatFixed(
        input.directCostBreakdown.equipment,
        GROUP_AMOUNT_DECIMALS,
      ),
    },
    {
      key: "OTHERS" as const,
      amount: formatFixed(input.directCostBreakdown.others, GROUP_AMOUNT_DECIMALS),
    },
    {
      key: "GENERAL_EXPENSES_PROFIT" as const,
      amount: formatFixed(
        toDecimal(input.generalExpenses).plus(input.utility),
        GROUP_AMOUNT_DECIMALS,
      ),
    },
  ];

  const totalBaseAmount = groups.reduce(
    (total, group) => total.plus(group.amount),
    ZERO,
  );

  return {
    groups,
    totalBaseAmount: formatFixed(totalBaseAmount, GROUP_AMOUNT_DECIMALS),
  };
}

export function calculateMonomialCoefficients(
  groups: MonomialCoefficientCalculationInput[],
): Array<MonomialCoefficientCalculationInput & { coefficient: string }> {
  const totalAmount = groups.reduce((total, group) => total.plus(group.amount), ZERO);

  if (totalAmount.equals(ZERO)) {
    return groups.map((group) => ({
      ...group,
      coefficient: roundCoefficient("0"),
    }));
  }

  const allocations = groups.map((group, index) => {
    const rawCoefficient = toDecimal(group.amount).dividedBy(totalAmount);
    const scaledRawCoefficient = rawCoefficient.times(COEFFICIENT_SCALE);
    const baseUnits = scaledRawCoefficient.floor();

    return {
      group,
      index,
      rawCoefficient,
      baseUnits,
      remainder: scaledRawCoefficient.minus(baseUnits),
    };
  });

  const allocatedBaseUnits = allocations.reduce(
    (total, allocation) => total.plus(allocation.baseUnits),
    ZERO,
  );
  const residualUnits = COEFFICIENT_SCALE.minus(allocatedBaseUnits).toNumber();

  const prioritizedAllocations = [...allocations].sort((left, right) => {
    const remainderDifference = right.remainder.comparedTo(left.remainder);
    if (remainderDifference !== 0) {
      return remainderDifference;
    }

    const rawDifference = right.rawCoefficient.comparedTo(left.rawCoefficient);
    if (rawDifference !== 0) {
      return rawDifference;
    }

    return left.group.key.localeCompare(right.group.key);
  });

  for (let index = 0; index < residualUnits; index += 1) {
    prioritizedAllocations[index].baseUnits =
      prioritizedAllocations[index].baseUnits.plus(1);
  }

  const unitsByOriginalIndex = new Map(
    allocations.map((allocation) => [allocation.index, allocation.baseUnits]),
  );

  return groups.map((group, index) => ({
    ...group,
    coefficient: formatFixed(
      unitsByOriginalIndex.get(index)?.dividedBy(COEFFICIENT_SCALE) ?? ZERO,
      COEFFICIENT_DECIMALS,
    ),
  }));
}

export function buildPolynomialCompositionDiagnostics(
  monomials: PolynomialValidationMonomialInput[],
): PolynomialCompositionDiagnostic[] {
  const diagnostics: PolynomialCompositionDiagnostic[] = [];

  for (const monomial of monomials) {
    const monomialName = getMonomialLabel(monomial);
    const coefficient = toDecimal(monomial.coefficient);

    if (coefficient.lessThan(MINIMUM_COEFFICIENT_WARNING)) {
      diagnostics.push({
        code: "LOW_COEFFICIENT_REVIEW",
        severity: "WARNING",
        monomialName,
        message: `${monomialName}: coeficiente ${formatFixed(coefficient, COEFFICIENT_DECIMALS)} menor a 0.050; revisar fusion o agrupacion.`,
      });
    }

    const composition = monomial.composition ?? [];
    if (composition.length === 0) {
      continue;
    }

    const iuFamilies = uniqueNonEmptyValues(
      composition.map((row) => row.iuFamily),
    );
    const unifiedIndexCodes = uniqueNonEmptyValues(
      composition.map((row) => row.unifiedIndexCode),
    );

    if (iuFamilies.length > 1 || unifiedIndexCodes.length > 1) {
      const familyCountLabel =
        iuFamilies.length === 1 ? "1 familia IU" : `${iuFamilies.length} familias IU`;
      const codeCountLabel =
        unifiedIndexCodes.length === 1
          ? "1 codigo IU"
          : `${unifiedIndexCodes.length} codigos IU`;

      diagnostics.push({
        code: "MIXED_IU_GROUPING_REVIEW",
        severity: "WARNING",
        monomialName,
        message: `${monomialName}: agrupa ${familyCountLabel} y ${codeCountLabel}; revisar fusion preliminar o agrupacion manual.`,
      });
    }

    const contributionRows = composition.filter(
      (row) => row.coefficientContribution !== null && row.coefficientContribution !== undefined,
    );

    if (contributionRows.length === 0) {
      continue;
    }

    const contributionTotal = contributionRows.reduce(
      (total, row) => total.plus(row.coefficientContribution ?? ZERO),
      ZERO,
    );

    if (
      contributionTotal
        .minus(coefficient)
        .abs()
        .greaterThan(COMPOSITION_COVERAGE_TOLERANCE)
    ) {
      diagnostics.push({
        code: "COMPOSITION_COVERAGE_REVIEW",
        severity: "WARNING",
        monomialName,
        message: `${monomialName}: aportes de composicion suman ${formatFixed(contributionTotal, COEFFICIENT_DECIMALS)} vs coeficiente ${formatFixed(coefficient, COEFFICIENT_DECIMALS)}; revisar cobertura.`,
      });
    }
  }

  return diagnostics;
}

export function validatePolynomialFormula(
  monomials: PolynomialValidationMonomialInput[],
): PolynomialFormulaValidationResult {
  const coefficientSum = monomials.reduce(
    (total, monomial) => total.plus(monomial.coefficient),
    ZERO,
  );
  const isCoefficientSumValid = coefficientSum
    .minus(COEFFICIENT_SUM_TARGET)
    .abs()
    .lessThanOrEqualTo(COEFFICIENT_SUM_TOLERANCE);
  const hasMaximumTermsValid =
    monomials.length <= POLYNOMIAL_FORMULA_DEFAULT_MAX_MONOMIALS;
  const compositionDiagnostics = buildPolynomialCompositionDiagnostics(monomials);

  const minimumCoefficientWarnings = compositionDiagnostics
    .filter((diagnostic) => diagnostic.code === "LOW_COEFFICIENT_REVIEW")
    .map((diagnostic) => diagnostic.message);

  const missingBaseIndexWarnings = monomials
    .filter((monomial) => isMissingOrNonPositive(monomial.baseIndexValue))
    .map((monomial) => `${monomial.name ?? "Monomial"} must have a base index greater than zero`);

  const missingAdjustmentIndexWarnings = monomials
    .filter((monomial) => isMissingOrNonPositive(monomial.adjustmentIndexValue))
    .map(
      (monomial) =>
        `${monomial.name ?? "Monomial"} must have an adjustment index greater than zero`,
    );

  return {
    isValid:
      isCoefficientSumValid &&
      hasMaximumTermsValid &&
      missingBaseIndexWarnings.length === 0 &&
      missingAdjustmentIndexWarnings.length === 0,
    coefficientSum: roundCoefficient(coefficientSum.toString()),
    isCoefficientSumValid,
    hasMaximumTermsValid,
    minimumCoefficientWarnings,
    missingBaseIndexWarnings,
    missingAdjustmentIndexWarnings,
    compositionDiagnostics,
  };
}

export function calculateCoefficientK(
  monomials: CoefficientKCalculationInput[],
): CoefficientKCalculationResult {
  let kRaw = ZERO;

  const terms = monomials.map((monomial) => {
    assertPositiveIndex(monomial.baseIndexValue, "Base index", monomial.name);
    assertPositiveIndex(
      monomial.adjustmentIndexValue,
      "Adjustment index",
      monomial.name,
    );

    const ratio = toDecimal(monomial.adjustmentIndexValue).dividedBy(
      monomial.baseIndexValue,
    );
    const partial = toDecimal(monomial.coefficient).times(ratio);
    kRaw = kRaw.plus(partial);

    return {
      ...monomial,
      ratio: formatFixed(ratio, K_RAW_DECIMALS),
      partial: formatFixed(partial, K_RAW_DECIMALS),
    };
  });

  return {
    terms,
    kRaw: formatFixed(kRaw, K_RAW_DECIMALS),
    kRounded: roundKValue(kRaw.toString()),
  };
}

export function calculateAdjustmentAmounts(
  input: AdjustmentAmountCalculationInput,
): AdjustmentAmountCalculationResult {
  const originalAmount = toDecimal(input.originalAmount);
  const adjustedAmount = originalAmount.times(input.kRounded);
  const adjustmentAmount = adjustedAmount.minus(originalAmount);

  return {
    originalAmount: roundCurrency(originalAmount.toString()),
    adjustedAmount: roundCurrency(adjustedAmount.toString()),
    adjustmentAmount: roundCurrency(adjustmentAmount.toString()),
    kRounded: roundKValue(input.kRounded),
  };
}
