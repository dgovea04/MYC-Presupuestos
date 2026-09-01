import Decimal from "decimal.js";
import type { ApuRecord } from "@/types/apu";
import type { BudgetItemRecord, BudgetRecord, BudgetTotals } from "@/types/budget";
import { calculateApuRows, calculateApuTotalUnitCost } from "@/lib/calculations/apu";
import { toNumber } from "@/lib/utils";

const MONEY_DECIMALS = 4;

export function calculateApuResourceSubtotal(resource: ApuRecord["resources"][number], performance: number) {
  return calculateApuRows([resource], performance)[0]?.subtotal ?? 0;
}

export function synchronizeApuResourcePrice(apu: ApuRecord, resourceId: string, unitPrice: number): ApuRecord {
  return calculateBudgetItemApu({
    ...apu,
    resources: apu.resources.map((resource) =>
      resource.resourceId === resourceId ? { ...resource, unitPrice } : resource,
    ),
  });
}

export function calculateBudgetItemApu(apu: ApuRecord): ApuRecord {
  const resources = calculateApuRows(apu.resources, apu.performance);
  const totalUnitCost = calculateApuTotalUnitCost(resources, apu.performance);

  return {
    ...apu,
    totalUnitCost,
    resources,
  };
}

export function calculateBudgetItem(item: BudgetItemRecord) {
  const calculatedApu = item.apu ? calculateBudgetItemApu(item.apu) : item.apu;
  const unitPrice = calculatedApu ? calculatedApu.totalUnitCost : toNumber(item.unitPrice);
  const partial = roundDecimal(new Decimal(toNumber(item.quantity)).times(unitPrice));

  return {
    ...item,
    unitPrice,
    partial,
    apu: calculatedApu,
  };
}

export function calculateBudgetTotals(input: Pick<BudgetRecord, "items" | "igvRate" | "generalExpensesRate" | "utilityRate">): BudgetTotals {
  const totalDirectCost = input.items.reduce(
    (sum, item) => sum.plus(calculateBudgetItem(item).partial),
    new Decimal(0),
  );
  const totalGeneralExpenses = totalDirectCost.times(toNumber(input.generalExpensesRate));
  const totalUtility = totalDirectCost.times(toNumber(input.utilityRate));
  const subtotal = totalDirectCost.plus(totalGeneralExpenses).plus(totalUtility);
  const totalTax = subtotal.times(toNumber(input.igvRate));
  const totalAmount = subtotal.plus(totalTax);

  return {
    totalDirectCost: roundDecimal(totalDirectCost),
    totalGeneralExpenses: roundDecimal(totalGeneralExpenses),
    totalUtility: roundDecimal(totalUtility),
    subtotal: roundDecimal(subtotal),
    totalTax: roundDecimal(totalTax),
    totalAmount: roundDecimal(totalAmount),
  };
}

export function calculateBudgetRecord(budget: BudgetRecord): BudgetRecord & { totals: BudgetTotals } {
  const items = budget.items.map(calculateBudgetItem);
  const totals = calculateBudgetTotals({
    items,
    igvRate: budget.igvRate,
    generalExpensesRate: budget.generalExpensesRate,
    utilityRate: budget.utilityRate,
  });

  return {
    ...budget,
    items,
    totalDirectCost: totals.totalDirectCost,
    totalGeneralExpenses: totals.totalGeneralExpenses,
    totalUtility: totals.totalUtility,
    totalTax: totals.totalTax,
    totalAmount: totals.totalAmount,
    totals,
  };
}

function roundDecimal(value: Decimal.Value) {
  return new Decimal(value).toDecimalPlaces(MONEY_DECIMALS, Decimal.ROUND_HALF_UP).toNumber();
}
