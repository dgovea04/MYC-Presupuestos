import Decimal from "decimal.js";

import { calculateMonomialCoefficients } from "@/lib/calculations/polynomial-formula";
import {
  DEFAULT_FINAL_ADJUSTMENT_OPTIONS,
  type FinalAdjustmentDiagnostic,
  type FinalAdjustmentExperienceHint,
  type FinalAdjustmentMergePlanEntry,
  type FinalAdjustmentMergeReason,
  type FinalAdjustmentOptions,
  type FinalAdjustmentResult,
} from "@/lib/polynomial-formula/final-adjustment-types";
import { normalizeUnifiedIndexCodeForPolynomialFormula } from "@/lib/polynomial-formula/iu-family-classifier";
import type {
  PolynomialMonomialCompositionRecord,
  PolynomialMonomialRecord,
} from "@/types/polynomial-formula";

const ZERO = new Decimal(0);
const AMOUNT_DECIMALS = 4;
const COMPOSITION_DECIMALS = 6;

const compatibleFamilyClusters: readonly (readonly string[])[] = [
  ["CEMENT", "AGGREGATES", "MASONRY"],
  ["STEEL"],
  ["WOOD"],
  ["FINISHES"],
  ["SANITARY_INSTALLATIONS"],
  ["ELECTRICAL_INSTALLATIONS"],
  ["EQUIPMENT"],
  ["OTHERS"],
];

type MutableMonomial = PolynomialMonomialRecord & {
  amountDecimal: Decimal;
};

function toDecimal(value: string): Decimal {
  return new Decimal(value);
}

function formatFixed(value: Decimal.Value, decimalPlaces: number): string {
  return new Decimal(value).toDecimalPlaces(decimalPlaces).toFixed(decimalPlaces);
}

function cloneMonomial(monomial: PolynomialMonomialRecord): MutableMonomial {
  return {
    ...monomial,
    composition: monomial.composition.map((row) => ({ ...row })),
    amountDecimal: toDecimal(monomial.amount),
  };
}

function cloneMonomials(monomials: readonly PolynomialMonomialRecord[]): PolynomialMonomialRecord[] {
  return monomials.map((monomial) => ({
    ...monomial,
    composition: monomial.composition.map((row) => ({ ...row })),
  }));
}

function primaryIuFamily(monomial: PolynomialMonomialRecord): string | undefined {
  return monomial.composition.find((row) => row.iuFamily)?.iuFamily;
}

function primaryUnifiedIndexCode(monomial: PolynomialMonomialRecord): string | undefined {
  const code = monomial.composition.find((row) => row.unifiedIndexCode)?.unifiedIndexCode ?? monomial.baseIndexCode;
  const normalized = normalizeUnifiedIndexCodeForPolynomialFormula(code);
  return normalized || undefined;
}

function isLocked(monomial: PolynomialMonomialRecord): boolean {
  return monomial.costGroupKey === "LABOR" || monomial.costGroupKey === "GENERAL_EXPENSES_PROFIT";
}

function clusterIndex(family: string | undefined): number {
  if (!family) return Number.MAX_SAFE_INTEGER;

  const index = compatibleFamilyClusters.findIndex((cluster) => cluster.includes(family));
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function familyOrderWithinSourceCluster(sourceFamily: string | undefined, targetFamily: string | undefined): number {
  if (!sourceFamily || !targetFamily) return Number.MAX_SAFE_INTEGER;

  const cluster = compatibleFamilyClusters.find((candidateCluster) => candidateCluster.includes(sourceFamily));
  if (!cluster) return Number.MAX_SAFE_INTEGER;

  const index = cluster.indexOf(targetFamily);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function experienceScore(
  source: PolynomialMonomialRecord,
  target: PolynomialMonomialRecord,
  hints: readonly FinalAdjustmentExperienceHint[],
): number {
  const sourceFamily = primaryIuFamily(source);
  const targetFamily = primaryIuFamily(target);
  const sourceCode = primaryUnifiedIndexCode(source);
  const targetCode = primaryUnifiedIndexCode(target);

  return hints.reduce((score, hint) => {
    const sourceMatches =
      (!hint.sourceIuFamily || hint.sourceIuFamily === sourceFamily) &&
      (!hint.sourceUnifiedIndexCode ||
        normalizeUnifiedIndexCodeForPolynomialFormula(hint.sourceUnifiedIndexCode) === sourceCode);
    const targetMatches =
      (!hint.targetIuFamily || hint.targetIuFamily === targetFamily) &&
      (!hint.targetUnifiedIndexCode ||
        normalizeUnifiedIndexCodeForPolynomialFormula(hint.targetUnifiedIndexCode) === targetCode) &&
      (!hint.targetCode || hint.targetCode === target.code) &&
      (!hint.targetName || hint.targetName === target.name) &&
      (!hint.costGroupKey || hint.costGroupKey === target.costGroupKey);

    return sourceMatches && targetMatches ? score + hint.weight : score;
  }, 0);
}

function affinityScore(
  source: PolynomialMonomialRecord,
  target: PolynomialMonomialRecord,
  hints: readonly FinalAdjustmentExperienceHint[],
): { score: number; reason: FinalAdjustmentMergeReason } {
  const sourceCode = primaryUnifiedIndexCode(source);
  const targetCode = primaryUnifiedIndexCode(target);
  const sourceFamily = primaryIuFamily(source);
  const targetFamily = primaryIuFamily(target);
  const learnedScore = experienceScore(source, target, hints);

  if (learnedScore > 0) return { score: 1000 + learnedScore, reason: "EXPERIENCE_HINT" };
  if (sourceCode && sourceCode === targetCode) return { score: 900, reason: "SAME_IU_CODE" };
  if (sourceFamily && sourceFamily === targetFamily) return { score: 800, reason: "SAME_IU_FAMILY" };
  if (clusterIndex(sourceFamily) === clusterIndex(targetFamily)) return { score: 700, reason: "COMPATIBLE_FAMILY" };
  if (source.costGroupKey === target.costGroupKey) return { score: 600, reason: "SAME_BROAD_GROUP" };

  return { score: 100, reason: "HIGHEST_INCIDENCE_FALLBACK" };
}

function chooseTarget(
  source: MutableMonomial,
  candidates: readonly MutableMonomial[],
  hints: readonly FinalAdjustmentExperienceHint[],
): { target: MutableMonomial; reason: FinalAdjustmentMergeReason } {
  const unlockedCandidates = candidates.filter((candidate) => !isLocked(candidate));
  const candidatePool = unlockedCandidates.length > 0 ? unlockedCandidates : candidates;

  const ranked = candidatePool
    .filter((candidate) => candidate.id !== source.id)
    .map((candidate) => {
      const affinity = affinityScore(source, candidate, hints);

      return {
        candidate,
        ...affinity,
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;

      if (left.reason === "COMPATIBLE_FAMILY" && right.reason === "COMPATIBLE_FAMILY") {
        const leftFamilyOrder = familyOrderWithinSourceCluster(
          primaryIuFamily(source),
          primaryIuFamily(left.candidate),
        );
        const rightFamilyOrder = familyOrderWithinSourceCluster(
          primaryIuFamily(source),
          primaryIuFamily(right.candidate),
        );

        if (leftFamilyOrder !== rightFamilyOrder) return leftFamilyOrder - rightFamilyOrder;
      }

      const amountComparison = right.candidate.amountDecimal.comparedTo(left.candidate.amountDecimal);
      if (amountComparison !== 0) return amountComparison;

      return left.candidate.sortOrder - right.candidate.sortOrder;
    });

  const selected = ranked[0];
  if (!selected) {
    throw new Error("No hay monomios disponibles para agrupar.");
  }

  return { target: selected.candidate, reason: selected.reason };
}

function createMergeExplanation(
  source: PolynomialMonomialRecord,
  target: PolynomialMonomialRecord,
  reason: FinalAdjustmentMergeReason,
): string {
  switch (reason) {
    case "SAME_IU_CODE":
      return `${source.code} se agrupa en ${target.code} por compartir codigo IU.`;
    case "SAME_IU_FAMILY":
      return `${source.code} se agrupa en ${target.code} por compartir familia IU.`;
    case "COMPATIBLE_FAMILY":
      return `${source.code} se agrupa en ${target.code} por afinidad de familias compatibles.`;
    case "SAME_BROAD_GROUP":
      return `${source.code} se agrupa en ${target.code} por pertenecer al mismo grupo amplio de costo.`;
    case "HIGHEST_INCIDENCE_FALLBACK":
      return `${source.code} se agrupa en ${target.code} por mayor incidencia disponible.`;
    case "EXPERIENCE_HINT":
      return `${source.code} se agrupa en ${target.code} usando aprendizaje previo de experiencia.`;
  }
}

function mergeIntoTarget(
  target: MutableMonomial,
  source: MutableMonomial,
  reason: FinalAdjustmentMergeReason,
  mergePlan: FinalAdjustmentMergePlanEntry[],
): void {
  target.amountDecimal = target.amountDecimal.plus(source.amountDecimal);
  target.amount = formatFixed(target.amountDecimal, AMOUNT_DECIMALS);
  target.composition = [
    ...target.composition,
    ...source.composition.map((row) => ({
      ...row,
      monomialId: target.id,
    })),
  ];

  mergePlan.push({
    targetMonomialId: target.id,
    sourceMonomialIds: [source.id],
    reason,
    explanation: createMergeExplanation(source, target, reason),
  });
}

function sumAmounts(monomials: readonly MutableMonomial[]): Decimal {
  return monomials.reduce((total, monomial) => total.plus(monomial.amountDecimal), ZERO);
}

function normalizeCoefficients(
  monomials: readonly MutableMonomial[],
  coefficientDecimals: number,
): PolynomialMonomialRecord[] {
  const totalAmount = sumAmounts(monomials);
  const allocations = calculateMonomialCoefficients(
    monomials.map((monomial) => ({
      key: monomial.costGroupKey,
      amount: formatFixed(monomial.amountDecimal, AMOUNT_DECIMALS),
    })),
  );

  return monomials.map((monomial, index) => {
    const amount = formatFixed(monomial.amountDecimal, AMOUNT_DECIMALS);
    const coefficient = allocations[index]?.coefficient ?? formatFixed(ZERO, coefficientDecimals);
    const composition = monomial.composition.map(
      (row): PolynomialMonomialCompositionRecord => ({
        ...row,
        monomialId: monomial.id,
        participationPercentage: monomial.amountDecimal.equals(ZERO)
          ? formatFixed(ZERO, COMPOSITION_DECIMALS)
          : formatFixed(toDecimal(row.amount).dividedBy(monomial.amountDecimal), COMPOSITION_DECIMALS),
        coefficientContribution: totalAmount.equals(ZERO)
          ? formatFixed(ZERO, COMPOSITION_DECIMALS)
          : formatFixed(toDecimal(row.amount).dividedBy(totalAmount), COMPOSITION_DECIMALS),
      }),
    );

    const { amountDecimal: _amountDecimal, ...cleanMonomial } = monomial;

    return {
      ...cleanMonomial,
      amount,
      coefficient,
      sortOrder: index,
      composition,
    };
  });
}

function addMergeDiagnostics(
  diagnostics: FinalAdjustmentDiagnostic[],
  source: MutableMonomial,
  target: MutableMonomial,
  reason: FinalAdjustmentMergeReason,
  minCoefficient: string,
): void {
  diagnostics.push({
    code: "LOW_COEFFICIENT_MERGED",
    severity: "INFO",
    message: `${source.code} se agrupo porque estaba por debajo de ${minCoefficient}.`,
    monomialIds: [source.id, target.id],
  });

  if (reason === "EXPERIENCE_HINT") {
    diagnostics.push({
      code: "EXPERIENCE_HINT_USED",
      severity: "INFO",
      message: `${source.code} uso experiencia previa para elegir ${target.code}.`,
      monomialIds: [source.id, target.id],
    });
  }

  if (reason === "HIGHEST_INCIDENCE_FALLBACK") {
    diagnostics.push({
      code: "CROSS_AFFINITY_FALLBACK",
      severity: "WARNING",
      message: `${source.code} se agrupo por mayor incidencia al no encontrar afinidad mejor.`,
      monomialIds: [source.id, target.id],
    });
  }
}

export function createPolynomialFinalAdjustmentProposal(
  monomials: readonly PolynomialMonomialRecord[],
  options: Partial<FinalAdjustmentOptions> = {},
): FinalAdjustmentResult {
  const resolvedOptions: FinalAdjustmentOptions = {
    ...DEFAULT_FINAL_ADJUSTMENT_OPTIONS,
    ...options,
    experienceHints: options.experienceHints ?? DEFAULT_FINAL_ADJUSTMENT_OPTIONS.experienceHints,
  };
  const minCoefficient = toDecimal(resolvedOptions.minCoefficient);
  const working = monomials.map(cloneMonomial);
  const mergePlan: FinalAdjustmentMergePlanEntry[] = [];
  const diagnostics: FinalAdjustmentDiagnostic[] = [];

  let changed = true;
  while (changed) {
    changed = false;

    const totalAmount = sumAmounts(working);
    const low = working
      .filter((monomial) => !isLocked(monomial) && monomial.amountDecimal.greaterThan(ZERO))
      .map((monomial) => ({
        monomial,
        coefficient: totalAmount.equals(ZERO) ? ZERO : monomial.amountDecimal.dividedBy(totalAmount),
      }))
      .filter(({ coefficient }) => coefficient.lessThan(minCoefficient))
      .sort((left, right) => left.coefficient.comparedTo(right.coefficient))[0]?.monomial;

    if (!low) {
      continue;
    }

    const { target, reason } = chooseTarget(
      low,
      working.filter((candidate) => candidate.id !== low.id),
      resolvedOptions.experienceHints ?? [],
    );

    mergeIntoTarget(target, low, reason, mergePlan);
    addMergeDiagnostics(diagnostics, low, target, reason, resolvedOptions.minCoefficient);
    working.splice(
      working.findIndex((item) => item.id === low.id),
      1,
    );
    changed = true;
  }

  while (working.length > resolvedOptions.maxMonomials) {
    const source = [...working]
      .filter((monomial) => !isLocked(monomial))
      .sort((left, right) => left.amountDecimal.comparedTo(right.amountDecimal))[0];

    if (!source) break;

    const { target, reason } = chooseTarget(
      source,
      working.filter((candidate) => candidate.id !== source.id),
      resolvedOptions.experienceHints ?? [],
    );

    mergeIntoTarget(target, source, reason, mergePlan);
    working.splice(
      working.findIndex((item) => item.id === source.id),
      1,
    );
  }

  while (working.length > resolvedOptions.minMonomials) {
    const source = [...working]
      .filter((monomial) => !isLocked(monomial))
      .sort((left, right) => {
        const amountComparison = left.amountDecimal.comparedTo(right.amountDecimal);
        if (amountComparison !== 0) return amountComparison;

        return left.sortOrder - right.sortOrder;
      })[0];

    if (!source) break;

    const { target, reason } = chooseTarget(
      source,
      working.filter((candidate) => candidate.id !== source.id),
      resolvedOptions.experienceHints ?? [],
    );

    mergeIntoTarget(target, source, reason, mergePlan);
    working.splice(
      working.findIndex((item) => item.id === source.id),
      1,
    );
  }

  const finalMonomials = normalizeCoefficients(working, resolvedOptions.coefficientDecimals);
  const unresolvedLow = finalMonomials.filter((monomial) => toDecimal(monomial.coefficient).lessThan(minCoefficient));

  if (finalMonomials.length < resolvedOptions.minMonomials) {
    diagnostics.push({
      code: "FINAL_MONOMIAL_COUNT_BELOW_MINIMUM",
      severity: "WARNING",
      message: `La composicion real solo permite ${finalMonomials.length} monomios economicos sin inventar terminos.`,
    });
  }

  if (finalMonomials.length > resolvedOptions.maxMonomials) {
    diagnostics.push({
      code: "FINAL_MONOMIAL_COUNT_ABOVE_MAXIMUM",
      severity: "ERROR",
      message: `La propuesta mantiene ${finalMonomials.length} monomios y supera el maximo de ${resolvedOptions.maxMonomials}.`,
    });
  }

  if (unresolvedLow.length > 0) {
    diagnostics.push({
      code: "LOW_COEFFICIENT_UNRESOLVED",
      severity: "ERROR",
      message: "La propuesta conserva monomios con coeficiente menor a 0.050.",
      monomialIds: unresolvedLow.map((monomial) => monomial.id),
    });
  }

  diagnostics.push({
    code: "COEFFICIENT_NORMALIZED",
    severity: "INFO",
    message: "Coeficientes recalculados a tres decimales con suma 1.000.",
  });

  return {
    originalMonomials: cloneMonomials(monomials),
    finalMonomials,
    mergePlan,
    diagnostics,
    canApply: !diagnostics.some((diagnostic) => diagnostic.severity === "ERROR"),
  };
}
