import Decimal from "decimal.js";

import type { BudgetItemRecord, BudgetRecord } from "@/types/budget";

const MONEY_DECIMALS = 4;
const PERCENT_DECIMALS = 4;

export type BudgetComparisonStatus = "ADDED" | "REMOVED" | "CHANGED" | "UNCHANGED";

export type BudgetComparisonItem = {
  key: string;
  status: BudgetComparisonStatus;
  code: string;
  description: string;
  unit: string;
  base: BudgetComparisonItemValues | null;
  target: BudgetComparisonItemValues | null;
  deltas: BudgetComparisonItemDeltas;
};

export type BudgetComparisonItemValues = {
  id: string;
  quantity: number;
  unitPrice: number;
  partial: number;
};

export type BudgetComparisonItemDeltas = {
  quantity: number;
  unitPrice: number;
  partial: number;
  partialPercent: number | null;
};

export type BudgetComparisonTotals = {
  baseTotalDirectCost: number;
  targetTotalDirectCost: number;
  deltaDirectCost: number;
  deltaDirectCostPercent: number | null;
};

export type BudgetComparisonSummary = {
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
  netItemsDelta: number;
};

export type BudgetComparisonResult = {
  baseBudgetId: string;
  targetBudgetId: string;
  baseBudgetName: string;
  targetBudgetName: string;
  currency: string;
  totals: BudgetComparisonTotals;
  summary: BudgetComparisonSummary;
  items: BudgetComparisonItem[];
};

export function compareBudgets(baseBudget: BudgetRecord, targetBudget: BudgetRecord): BudgetComparisonResult {
  const baseItemsByKey = indexBudgetItems(baseBudget.items);
  const targetItemsByKey = indexBudgetItems(targetBudget.items);
  const keys = Array.from(new Set([...baseItemsByKey.keys(), ...targetItemsByKey.keys()])).sort();
  const items = keys.map((key) => compareBudgetItem(key, baseItemsByKey.get(key) ?? null, targetItemsByKey.get(key) ?? null));
  const summary = buildComparisonSummary(items);
  const baseTotalDirectCost = calculateItemsPartial(baseBudget.items);
  const targetTotalDirectCost = calculateItemsPartial(targetBudget.items);
  const deltaDirectCost = targetTotalDirectCost.minus(baseTotalDirectCost);

  return {
    baseBudgetId: baseBudget.id,
    targetBudgetId: targetBudget.id,
    baseBudgetName: baseBudget.name,
    targetBudgetName: targetBudget.name,
    currency: targetBudget.currency || baseBudget.currency,
    totals: {
      baseTotalDirectCost: roundMoney(baseTotalDirectCost),
      targetTotalDirectCost: roundMoney(targetTotalDirectCost),
      deltaDirectCost: roundMoney(deltaDirectCost),
      deltaDirectCostPercent: calculatePercentDelta(deltaDirectCost, baseTotalDirectCost),
    },
    summary,
    items,
  };
}

function indexBudgetItems(items: BudgetItemRecord[]) {
  const indexed = new Map<string, BudgetItemRecord>();

  for (const item of items) {
    indexed.set(buildBudgetItemComparisonKey(item), item);
  }

  return indexed;
}

function buildBudgetItemComparisonKey(item: Pick<BudgetItemRecord, "code" | "description" | "unit">) {
  const normalizedCode = item.code.trim().toLowerCase();
  const normalizedDescription = normalizeText(item.description);
  const normalizedUnit = normalizeText(item.unit);

  return normalizedCode ? `code:${normalizedCode}` : `item:${normalizedDescription}|unit:${normalizedUnit}`;
}

function compareBudgetItem(key: string, baseItem: BudgetItemRecord | null, targetItem: BudgetItemRecord | null): BudgetComparisonItem {
  const base = baseItem ? toComparisonValues(baseItem) : null;
  const target = targetItem ? toComparisonValues(targetItem) : null;
  const deltaQuantity = new Decimal(target?.quantity ?? 0).minus(base?.quantity ?? 0);
  const deltaUnitPrice = new Decimal(target?.unitPrice ?? 0).minus(base?.unitPrice ?? 0);
  const deltaPartial = new Decimal(target?.partial ?? 0).minus(base?.partial ?? 0);
  const status = resolveItemStatus(baseItem, targetItem, deltaQuantity, deltaUnitPrice, deltaPartial);

  return {
    key,
    status,
    code: targetItem?.code || baseItem?.code || "",
    description: targetItem?.description || baseItem?.description || "",
    unit: targetItem?.unit || baseItem?.unit || "",
    base,
    target,
    deltas: {
      quantity: roundMoney(deltaQuantity),
      unitPrice: roundMoney(deltaUnitPrice),
      partial: roundMoney(deltaPartial),
      partialPercent: calculatePercentDelta(deltaPartial, new Decimal(base?.partial ?? 0)),
    },
  };
}

function resolveItemStatus(
  baseItem: BudgetItemRecord | null,
  targetItem: BudgetItemRecord | null,
  deltaQuantity: Decimal,
  deltaUnitPrice: Decimal,
  deltaPartial: Decimal,
): BudgetComparisonStatus {
  if (!baseItem && targetItem) return "ADDED";
  if (baseItem && !targetItem) return "REMOVED";
  if (!baseItem || !targetItem) return "UNCHANGED";

  const unitChanged = normalizeText(baseItem.unit) !== normalizeText(targetItem.unit);

  return unitChanged || !deltaQuantity.isZero() || !deltaUnitPrice.isZero() || !deltaPartial.isZero()
    ? "CHANGED"
    : "UNCHANGED";
}

function toComparisonValues(item: BudgetItemRecord): BudgetComparisonItemValues {
  return {
    id: item.id,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    partial: item.partial,
  };
}

function buildComparisonSummary(items: BudgetComparisonItem[]): BudgetComparisonSummary {
  const summary = items.reduce(
    (current, item) => ({
      added: current.added + (item.status === "ADDED" ? 1 : 0),
      removed: current.removed + (item.status === "REMOVED" ? 1 : 0),
      changed: current.changed + (item.status === "CHANGED" ? 1 : 0),
      unchanged: current.unchanged + (item.status === "UNCHANGED" ? 1 : 0),
    }),
    { added: 0, removed: 0, changed: 0, unchanged: 0 },
  );

  return {
    ...summary,
    netItemsDelta: summary.added - summary.removed,
  };
}

function calculateItemsPartial(items: BudgetItemRecord[]) {
  return items.reduce((sum, item) => sum.plus(item.partial), new Decimal(0));
}

function calculatePercentDelta(delta: Decimal, base: Decimal) {
  if (base.isZero()) {
    return null;
  }

  return delta.dividedBy(base).times(100).toDecimalPlaces(PERCENT_DECIMALS, Decimal.ROUND_HALF_UP).toNumber();
}

function roundMoney(value: Decimal.Value) {
  return new Decimal(value).toDecimalPlaces(MONEY_DECIMALS, Decimal.ROUND_HALF_UP).toNumber();
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
