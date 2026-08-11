import { Prisma } from "@prisma/client";

/**
 * Converts Prisma Decimal fields (or plain numbers / nullish values) to a
 * plain `number | null` so the value can be safely passed across the
 * Next.js Server-to-Client Component boundary.
 */
export function toSerializableNumber(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return value;
  }
  return value.toNumber();
}

type SerializableBudget = Prisma.BudgetGetPayload<object>;

/**
 * Serializes a Prisma Budget record into a plain object suitable for
 * Client Components. Converts all Decimal fields to numbers and Date
 * fields to ISO strings.
 *
 * Add additional per-model serializers below as more data shapes need
 * to cross the RSC boundary (e.g. WorkSchedule, PolynomialFormula).
 */
export function serializeBudgetForClientForm(budget: SerializableBudget) {
  return {
    id: budget.id,
    projectId: budget.projectId,
    parentBudgetId: budget.parentBudgetId,
    kind: budget.kind,
    name: budget.name,
    currency: budget.currency,
    igvRate: toSerializableNumber(budget.igvRate),
    generalExpensesRate: toSerializableNumber(budget.generalExpensesRate),
    utilityRate: toSerializableNumber(budget.utilityRate),
    totalDirectCost: toSerializableNumber(budget.totalDirectCost),
    totalGeneralExpenses: toSerializableNumber(budget.totalGeneralExpenses),
    totalUtility: toSerializableNumber(budget.totalUtility),
    totalTax: toSerializableNumber(budget.totalTax),
    totalAmount: toSerializableNumber(budget.totalAmount),
    createdAt: budget.createdAt?.toISOString() ?? null,
    updatedAt: budget.updatedAt?.toISOString() ?? null,
  };
}
