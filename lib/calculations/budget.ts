import type { ApuRecord } from "@/types/apu";
import type { BudgetItemRecord, BudgetRecord, BudgetTotals } from "@/types/budget";
import { calculateApuRows, calculateApuTotalUnitCost } from "@/lib/calculations/apu";
import { toNumber } from "@/lib/utils";

export function calculateApuResourceSubtotal(resource: ApuRecord["resources"][number], performance: number) {
  return calculateApuRows([resource], performance)[0]?.subtotal ?? 0;
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
  const partial = round(toNumber(item.quantity) * unitPrice);

  return {
    ...item,
    unitPrice,
    partial,
    apu: calculatedApu,
  };
}

export function calculateBudgetTotals(input: Pick<BudgetRecord, "items" | "igvRate" | "generalExpensesRate" | "utilityRate">): BudgetTotals {
  const totalDirectCost = round(input.items.reduce((sum, item) => sum + calculateBudgetItem(item).partial, 0));
  const totalGeneralExpenses = round(totalDirectCost * toNumber(input.generalExpensesRate));
  const totalUtility = round(totalDirectCost * toNumber(input.utilityRate));
  const subtotal = round(totalDirectCost + totalGeneralExpenses + totalUtility);
  const totalTax = round(subtotal * toNumber(input.igvRate));
  const totalAmount = round(subtotal + totalTax);

  return {
    totalDirectCost,
    totalGeneralExpenses,
    totalUtility,
    subtotal,
    totalTax,
    totalAmount,
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

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}
