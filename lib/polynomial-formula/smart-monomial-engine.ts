import Decimal from "decimal.js";

import {
  normalizeUnifiedIndexCodeForPolynomialFormula,
  type PolynomialIuFamily,
} from "@/lib/polynomial-formula/iu-family-classifier";
import {
  POLYNOMIAL_FORMULA_DEFAULT_COEFFICIENT_DECIMALS,
  POLYNOMIAL_FORMULA_DEFAULT_MAX_MONOMIALS,
  POLYNOMIAL_FORMULA_DEFAULT_MIN_COEFFICIENT,
  POLYNOMIAL_FORMULA_DEFAULT_MIN_PRELIMINARY_MONOMIALS,
  type SmartMonomialBroadGroup,
  type SmartMonomialBroadGroupSummary,
  type SmartMonomialCompositionRow,
  type SmartMonomialDiagnostic,
  type SmartMonomialEngineOptions,
  type SmartMonomialEngineResult,
  type SmartMonomialInputItem,
  type SmartMonomialProposal,
  type SmartMonomialProposalReason,
  type SmartMonomialProposalStatus,
} from "@/lib/polynomial-formula/smart-monomial-types";

const ZERO = new Decimal(0);
const ONE = new Decimal(1);
const COMPOSITION_DECIMALS = 6;

const broadGroupOrder: readonly SmartMonomialBroadGroup[] = [
  "LABOR",
  "MATERIALS",
  "EQUIPMENT",
  "OTHERS",
  "GENERAL_EXPENSES_PROFIT",
];

const broadGroupLabels: Record<SmartMonomialBroadGroup, string> = {
  LABOR: "Mano de obra",
  MATERIALS: "Materiales",
  EQUIPMENT: "Equipos",
  OTHERS: "Otros",
  GENERAL_EXPENSES_PROFIT: "Gastos generales y utilidad",
};

const iuFamilyLabels: Record<PolynomialIuFamily, string> = {
  LABOR: "Mano de obra",
  GENERAL_EXPENSES: "Gastos generales",
  STEEL: "Acero",
  CEMENT: "Cemento",
  AGGREGATES: "Agregados",
  MASONRY: "Albanileria",
  WOOD: "Madera",
  FINISHES: "Acabados",
  SANITARY_INSTALLATIONS: "Instalaciones sanitarias",
  ELECTRICAL_INSTALLATIONS: "Instalaciones electricas",
  EQUIPMENT: "Equipos",
  OTHERS: "Otros",
};

type NormalizedOptions = SmartMonomialEngineOptions;

type DraftMonomial = {
  readonly id: string;
  readonly key: string;
  label: string;
  readonly broadGroup: SmartMonomialBroadGroup;
  representativeUnifiedIndexCode?: string;
  representativeUnifiedIndexName?: string;
  amount: Decimal;
  sourceItemIds: string[];
  items: SmartMonomialInputItem[];
  readonly locked: boolean;
  statuses: SmartMonomialProposalStatus[];
  reasons: SmartMonomialProposalReason[];
};

function normalizeOptions(options?: Partial<SmartMonomialEngineOptions>): NormalizedOptions {
  return {
    minCoefficientThreshold:
      options?.minCoefficientThreshold ?? POLYNOMIAL_FORMULA_DEFAULT_MIN_COEFFICIENT,
    minPreliminaryMonomials:
      options?.minPreliminaryMonomials ?? POLYNOMIAL_FORMULA_DEFAULT_MIN_PRELIMINARY_MONOMIALS,
    maxMonomials: options?.maxMonomials ?? POLYNOMIAL_FORMULA_DEFAULT_MAX_MONOMIALS,
    coefficientDecimals:
      options?.coefficientDecimals ?? POLYNOMIAL_FORMULA_DEFAULT_COEFFICIENT_DECIMALS,
  };
}

function amountOf(items: readonly SmartMonomialInputItem[]): Decimal {
  return items.reduce((total, item) => total.plus(item.amount), ZERO);
}

function positiveItems(items: readonly SmartMonomialInputItem[]): SmartMonomialInputItem[] {
  return items.filter((item) => item.amount.greaterThan(ZERO));
}

function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function addUniqueStatus(draft: DraftMonomial, status: SmartMonomialProposalStatus): void {
  if (!draft.statuses.includes(status)) {
    draft.statuses.push(status);
  }
}

function addUniqueReason(draft: DraftMonomial, reason: SmartMonomialProposalReason): void {
  if (!draft.reasons.includes(reason)) {
    draft.reasons.push(reason);
  }
}

function sourceIds(items: readonly SmartMonomialInputItem[]): string[] {
  return uniqueValues(items.map((item) => item.id));
}

function firstDefined<T>(values: readonly (T | undefined)[]): T | undefined {
  return values.find((value) => value !== undefined);
}

function makeDraft(input: {
  key: string;
  label: string;
  broadGroup: SmartMonomialBroadGroup;
  items: readonly SmartMonomialInputItem[];
  locked: boolean;
  statuses: readonly SmartMonomialProposalStatus[];
  reasons: readonly SmartMonomialProposalReason[];
}): DraftMonomial {
  const itemList = [...input.items];

  return {
    id: input.key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    key: input.key,
    label: input.label,
    broadGroup: input.broadGroup,
    representativeUnifiedIndexCode:
      firstDefined(itemList.map((item) => normalizeUnifiedIndexCodeForPolynomialFormula(item.unifiedIndexCode))) ||
      undefined,
    representativeUnifiedIndexName: firstDefined(itemList.map((item) => item.unifiedIndexName)),
    amount: amountOf(itemList),
    sourceItemIds: sourceIds(itemList),
    items: itemList,
    locked: input.locked,
    statuses: [...input.statuses],
    reasons: [...input.reasons],
  };
}

function groupByBroadGroup(
  items: readonly SmartMonomialInputItem[],
): Map<SmartMonomialBroadGroup, SmartMonomialInputItem[]> {
  const grouped = new Map<SmartMonomialBroadGroup, SmartMonomialInputItem[]>(
    broadGroupOrder.map((broadGroup) => [broadGroup, []]),
  );

  for (const item of items) {
    grouped.get(item.broadGroup)?.push(item);
  }

  return grouped;
}

function groupByMaterialIuPreservingOrder(
  items: readonly SmartMonomialInputItem[],
): Array<[{ key: string; label: string }, SmartMonomialInputItem[]]> {
  const grouped = new Map<string, { label: string; items: SmartMonomialInputItem[] }>();

  for (const item of items) {
    const normalizedCode = normalizeUnifiedIndexCodeForPolynomialFormula(item.unifiedIndexCode);
    const key = normalizedCode ? `IU:${normalizedCode}` : `FAMILY:${item.iuFamily}`;
    const label = normalizedCode
      ? `IU ${normalizedCode}${item.unifiedIndexName ? ` - ${item.unifiedIndexName}` : ""}`
      : iuFamilyLabels[item.iuFamily];
    const existing = grouped.get(key);

    if (existing) {
      existing.items.push(item);
    } else {
      grouped.set(key, { label, items: [item] });
    }
  }

  return [...grouped.entries()].map(([key, value]) => [{ key, label: value.label }, value.items]);
}

function buildInitialDrafts(items: readonly SmartMonomialInputItem[]): DraftMonomial[] {
  const byBroadGroup = groupByBroadGroup(positiveItems(items));
  const drafts: DraftMonomial[] = [];

  const laborItems = byBroadGroup.get("LABOR") ?? [];
  if (laborItems.length > 0) {
    drafts.push(
      makeDraft({
        key: "LABOR",
        label: broadGroupLabels.LABOR,
        broadGroup: "LABOR",
        items: laborItems,
        locked: true,
        statuses: ["LOCKED"],
        reasons: ["LOCKED_MONOMIAL"],
      }),
    );
  }

  for (const [materialGroup, familyItems] of groupByMaterialIuPreservingOrder(
    byBroadGroup.get("MATERIALS") ?? [],
  )) {
    const isSplitByIuCode = materialGroup.key.startsWith("IU:");
    drafts.push(
      makeDraft({
        key: `MATERIALS:${materialGroup.key}`,
        label: `${broadGroupLabels.MATERIALS} - ${materialGroup.label}`,
        broadGroup: "MATERIALS",
        items: familyItems,
        locked: false,
        statuses: [isSplitByIuCode ? "SPLIT_BY_IU_CODE" : "SPLIT_BY_IU_FAMILY", "ACCEPTED"],
        reasons: [isSplitByIuCode ? "SPLIT_BY_IU_CODE" : "SPLIT_BY_IU_FAMILY", "ACCEPTED"],
      }),
    );
  }

  const equipmentItems = byBroadGroup.get("EQUIPMENT") ?? [];
  if (equipmentItems.length > 0) {
    drafts.push(
      makeDraft({
        key: "EQUIPMENT",
        label: broadGroupLabels.EQUIPMENT,
        broadGroup: "EQUIPMENT",
        items: equipmentItems,
        locked: false,
        statuses: ["ACCEPTED"],
        reasons: ["ACCEPTED"],
      }),
    );
  }

  const otherItems = byBroadGroup.get("OTHERS") ?? [];
  if (otherItems.length > 0) {
    drafts.push(
      makeDraft({
        key: "OTHERS",
        label: broadGroupLabels.OTHERS,
        broadGroup: "OTHERS",
        items: otherItems,
        locked: false,
        statuses: ["ACCEPTED"],
        reasons: ["ACCEPTED"],
      }),
    );
  }

  const generalItems = byBroadGroup.get("GENERAL_EXPENSES_PROFIT") ?? [];
  if (generalItems.length > 0) {
    drafts.push(
      makeDraft({
        key: "GENERAL_EXPENSES_PROFIT",
        label: broadGroupLabels.GENERAL_EXPENSES_PROFIT,
        broadGroup: "GENERAL_EXPENSES_PROFIT",
        items: generalItems,
        locked: true,
        statuses: ["LOCKED"],
        reasons: ["LOCKED_MONOMIAL"],
      }),
    );
  }

  return drafts;
}

function rawCoefficient(amount: Decimal, totalAmount: Decimal): Decimal {
  if (totalAmount.equals(ZERO)) return ZERO;
  return amount.dividedBy(totalAmount);
}

function diagnostic(input: SmartMonomialDiagnostic): SmartMonomialDiagnostic {
  return input;
}

function addBelowMinimumDiagnostic(
  diagnostics: SmartMonomialDiagnostic[],
  draft: DraftMonomial,
  coefficient: Decimal,
  minCoefficientThreshold: Decimal,
): void {
  diagnostics.push(
    diagnostic({
      code: "BELOW_MINIMUM_COEFFICIENT",
      severity: "WARNING",
      message: `${draft.key} coefficient ${coefficient.toFixed(3)} is below ${minCoefficientThreshold.toFixed(3)}.`,
      monomialId: draft.id,
      sourceItemIds: draft.sourceItemIds,
    }),
  );
}

function mergeDrafts(
  target: DraftMonomial,
  source: DraftMonomial,
  diagnostics: SmartMonomialDiagnostic[],
): void {
  target.amount = target.amount.plus(source.amount);
  target.items = [...target.items, ...source.items];
  target.sourceItemIds = uniqueValues([...target.sourceItemIds, ...source.sourceItemIds]);
  target.label = `${target.label} + ${source.label}`;
  target.representativeUnifiedIndexCode ??= source.representativeUnifiedIndexCode;
  target.representativeUnifiedIndexName ??= source.representativeUnifiedIndexName;

  for (const status of source.statuses) {
    addUniqueStatus(target, status);
  }
  for (const reason of source.reasons) {
    addUniqueReason(target, reason);
  }
  addUniqueStatus(target, "MERGED_PRELIMINARILY");
  addUniqueStatus(target, "USER_MERGE_CANDIDATE");
  addUniqueReason(target, "MERGED_PRELIMINARILY");
  addUniqueReason(target, "USER_MERGE_CANDIDATE");

  diagnostics.push(
    diagnostic({
      code: "MERGED_PRELIMINARILY",
      severity: "INFO",
      message: `${source.key} was preliminarily merged into ${target.key}.`,
      monomialId: target.id,
      sourceItemIds: source.sourceItemIds,
    }),
  );
}

function chooseMergeTarget(
  source: DraftMonomial,
  drafts: readonly DraftMonomial[],
): DraftMonomial | undefined {
  const unlockedCandidates = drafts.filter((candidate) => candidate !== source && !candidate.locked);
  const candidates =
    unlockedCandidates.length > 0
      ? unlockedCandidates
      : drafts.filter((candidate) => candidate !== source);
  if (candidates.length === 0) return undefined;

  const compatibleCandidates = candidates.filter(
    (candidate) => candidate.broadGroup === source.broadGroup,
  );
  const targetPool = compatibleCandidates.length > 0 ? compatibleCandidates : candidates;

  return [...targetPool].sort((left, right) => {
    const amountDifference = right.amount.comparedTo(left.amount);
    if (amountDifference !== 0) return amountDifference;

    return left.key.localeCompare(right.key);
  })[0];
}

function mergeBelowMinimumDrafts(
  drafts: DraftMonomial[],
  diagnostics: SmartMonomialDiagnostic[],
  totalAmount: Decimal,
  minCoefficientThreshold: Decimal,
  minPreliminaryMonomials: number,
  maxMonomials: number,
): DraftMonomial[] {
  const sortedDrafts = [...drafts].sort((left, right) => {
    const amountDifference = left.amount.comparedTo(right.amount);
    if (amountDifference !== 0) return amountDifference;

    return left.key.localeCompare(right.key);
  });

  const remaining = [...drafts];
  const shouldPreserveManualReductionRoom = drafts.length >= minPreliminaryMonomials;
  const preservedManualReductionFloor = shouldPreserveManualReductionRoom
    ? Math.min(drafts.length, maxMonomials)
    : 0;

  for (const draft of sortedDrafts) {
    if (draft.locked || !remaining.includes(draft)) continue;

    const coefficient = rawCoefficient(draft.amount, totalAmount);
    const isBelowMinimum = coefficient.greaterThan(ZERO) && coefficient.lessThan(minCoefficientThreshold);
    const mustNotStandAlone =
      draft.broadGroup === "EQUIPMENT" || draft.broadGroup === "OTHERS" || isBelowMinimum;

    if (!mustNotStandAlone || !isBelowMinimum) continue;

    addUniqueStatus(draft, "BELOW_MINIMUM_COEFFICIENT");
    addUniqueReason(draft, "BELOW_MINIMUM_COEFFICIENT");
    addBelowMinimumDiagnostic(diagnostics, draft, coefficient, minCoefficientThreshold);

    if (shouldPreserveManualReductionRoom && remaining.length <= preservedManualReductionFloor) {
      addUniqueStatus(draft, "USER_MERGE_CANDIDATE");
      addUniqueReason(draft, "USER_MERGE_CANDIDATE");
      continue;
    }

    const target = chooseMergeTarget(draft, remaining);
    if (!target) continue;

    mergeDrafts(target, draft, diagnostics);
    remaining.splice(remaining.indexOf(draft), 1);
  }

  return remaining;
}

function mergeToMaxMonomials(
  drafts: DraftMonomial[],
  diagnostics: SmartMonomialDiagnostic[],
  maxMonomials: number,
): DraftMonomial[] {
  const remaining = [...drafts];

  while (remaining.length > maxMonomials) {
    const nonLocked = remaining.filter((draft) => !draft.locked);
    if (nonLocked.length < 2) break;

    const [source, target] = [...nonLocked].sort((left, right) => {
      const amountDifference = left.amount.comparedTo(right.amount);
      if (amountDifference !== 0) return amountDifference;

      return left.key.localeCompare(right.key);
    });

    mergeDrafts(target, source, diagnostics);
    remaining.splice(remaining.indexOf(source), 1);
  }

  return remaining;
}

function buildCompositionRows(
  items: readonly SmartMonomialInputItem[],
  monomialAmount: Decimal,
  totalAmount: Decimal,
): SmartMonomialCompositionRow[] {
  const grouped = new Map<string, SmartMonomialInputItem[]>();

  for (const item of items) {
    const normalizedCode = normalizeUnifiedIndexCodeForPolynomialFormula(item.unifiedIndexCode);
    const rowKey = [
      normalizedCode,
      item.unifiedIndexName ?? "",
      item.iuFamily,
    ].join("|");
    const existing = grouped.get(rowKey);
    if (existing) {
      existing.push(item);
    } else {
      grouped.set(rowKey, [item]);
    }
  }

  return [...grouped.values()].map((rowItems) => {
    const amount = amountOf(rowItems);

    return {
      unifiedIndexCode:
        firstDefined(rowItems.map((item) => normalizeUnifiedIndexCodeForPolynomialFormula(item.unifiedIndexCode))) ||
        undefined,
      unifiedIndexName: firstDefined(rowItems.map((item) => item.unifiedIndexName)),
      iuFamily: rowItems[0].iuFamily,
      amount,
      participationPercentage: monomialAmount.equals(ZERO)
        ? ZERO
        : amount.dividedBy(monomialAmount).toDecimalPlaces(COMPOSITION_DECIMALS),
      coefficientContribution: totalAmount.equals(ZERO)
        ? ZERO
        : amount.dividedBy(totalAmount).toDecimalPlaces(COMPOSITION_DECIMALS),
      sourceItemIds: sourceIds(rowItems),
    };
  });
}

function finalizeDrafts(
  drafts: readonly DraftMonomial[],
  totalAmount: Decimal,
  coefficientDecimals: number,
): SmartMonomialProposal[] {
  const coefficients = allocateRoundedCoefficients(
    drafts.map((draft) => draft.amount),
    coefficientDecimals,
  );

  return drafts.map((draft, index) => ({
    id: draft.id,
    key: draft.key,
    label: draft.label,
    broadGroup: draft.broadGroup,
    representativeUnifiedIndexCode: draft.representativeUnifiedIndexCode,
    representativeUnifiedIndexName: draft.representativeUnifiedIndexName,
    amount: draft.amount,
    coefficient: coefficients[index],
    sourceItemIds: draft.sourceItemIds,
    compositionRows: buildCompositionRows(draft.items, draft.amount, totalAmount),
    locked: draft.locked,
    statuses: draft.statuses,
    reasons: draft.reasons,
  }));
}

function buildZeroAmountDiagnostics(
  items: readonly SmartMonomialInputItem[],
): SmartMonomialDiagnostic[] {
  return items
    .filter((item) => item.amount.lessThanOrEqualTo(ZERO))
    .map((item) =>
      diagnostic({
        code: "ZERO_COEFFICIENT",
        severity: "WARNING",
        message: `${item.id} has zero or non-positive amount.`,
        sourceItemIds: [item.id],
      }),
    );
}

function buildBroadGroupSummary(
  items: readonly SmartMonomialInputItem[],
): SmartMonomialBroadGroupSummary[] {
  const grouped = groupByBroadGroup(items);
  const amounts = broadGroupOrder.map((broadGroup) =>
    amountOf((grouped.get(broadGroup) ?? []).filter((item) => item.amount.greaterThan(ZERO))),
  );
  const coefficients = allocateRoundedCoefficients(amounts);

  return broadGroupOrder.map((broadGroup, index) => ({
    broadGroup,
    amount: amounts[index],
    coefficient: coefficients[index],
    sourceItemIds: sourceIds(grouped.get(broadGroup) ?? []),
  }));
}

export function allocateRoundedCoefficients(
  amounts: readonly Decimal[],
  coefficientDecimals = POLYNOMIAL_FORMULA_DEFAULT_COEFFICIENT_DECIMALS,
): Decimal[] {
  const totalAmount = amounts.reduce((total, amount) => total.plus(amount), ZERO);

  if (totalAmount.equals(ZERO)) {
    return amounts.map(() => ZERO.toDecimalPlaces(coefficientDecimals));
  }

  const scale = new Decimal(10).pow(coefficientDecimals);
  const allocations = amounts.map((amount, index) => {
    const raw = amount.dividedBy(totalAmount);
    const scaled = raw.times(scale);
    const baseUnits = scaled.floor();

    return {
      index,
      raw,
      baseUnits,
      remainder: scaled.minus(baseUnits),
    };
  });

  const allocatedBaseUnits = allocations.reduce(
    (total, allocation) => total.plus(allocation.baseUnits),
    ZERO,
  );
  const residualUnits = scale.minus(allocatedBaseUnits).toNumber();

  const prioritizedAllocations = [...allocations].sort((left, right) => {
    const remainderDifference = right.remainder.comparedTo(left.remainder);
    if (remainderDifference !== 0) return remainderDifference;

    const rawDifference = right.raw.comparedTo(left.raw);
    if (rawDifference !== 0) return rawDifference;

    return left.index - right.index;
  });

  for (let index = 0; index < residualUnits; index += 1) {
    prioritizedAllocations[index].baseUnits =
      prioritizedAllocations[index].baseUnits.plus(ONE);
  }

  const unitsByIndex = new Map(
    allocations.map((allocation) => [allocation.index, allocation.baseUnits]),
  );

  return amounts.map((_, index) =>
    (unitsByIndex.get(index) ?? ZERO).dividedBy(scale).toDecimalPlaces(coefficientDecimals),
  );
}

export function createSmartPolynomialMonomialProposal(
  inputItems: readonly SmartMonomialInputItem[],
  options?: Partial<SmartMonomialEngineOptions>,
): SmartMonomialEngineResult {
  const normalizedOptions = normalizeOptions(options);
  const totalAmount = positiveItems(inputItems).reduce(
    (total, item) => total.plus(item.amount),
    ZERO,
  );
  const diagnostics = buildZeroAmountDiagnostics(inputItems);
  const initialBroadGroupSummary = buildBroadGroupSummary(inputItems);
  const initialDrafts = buildInitialDrafts(inputItems);
  const draftsAfterMinimumMerge = mergeBelowMinimumDrafts(
    initialDrafts,
    diagnostics,
    totalAmount,
    normalizedOptions.minCoefficientThreshold,
    Math.min(normalizedOptions.minPreliminaryMonomials, normalizedOptions.maxMonomials),
    normalizedOptions.maxMonomials,
  );
  const draftsAfterMaxMerge = mergeToMaxMonomials(
    draftsAfterMinimumMerge,
    diagnostics,
    normalizedOptions.maxMonomials,
  );

  return {
    proposedMonomials: finalizeDrafts(
      draftsAfterMaxMerge,
      totalAmount,
      normalizedOptions.coefficientDecimals,
    ),
    diagnostics,
    initialBroadGroupSummary,
  };
}
