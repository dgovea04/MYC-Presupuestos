import { decimalToString } from "@/lib/db/serializers";

export type McpSerializedPolynomialFormula = {
  formula: {
    id: string;
    budgetId: string;
    name: string;
    baseMonth: number;
    baseYear: number;
    totalBaseAmount: string;
    status: string;
    monomials: Array<{
      id: string;
      code: string;
      name: string;
      costGroupKey: string;
      amount: string;
      coefficient: string;
      baseIndexCode: string;
      baseIndexName: string;
      baseIndexValue: string;
      adjustmentIndexCode: string | null;
      adjustmentIndexName: string | null;
      adjustmentIndexValue: string | null;
      sortOrder: number;
      components: Array<{
        id: string;
        budgetItemId: string | null;
        apuResourceId: string | null;
        resourceType: string | null;
        amount: string;
      }>;
    }>;
  } | null;
};

export function serializePolynomialFormula(formula: {
  id: string;
  budgetId: string;
  name: string;
  baseMonth: number;
  baseYear: number;
  totalBaseAmount: string | number;
  status: string;
  monomials: Array<{
    id: string;
    code: string;
    name: string;
    costGroupKey: string;
    amount: string | number;
    coefficient: string | number;
    baseIndexCode: string;
    baseIndexName: string;
    baseIndexValue: string | number;
    adjustmentIndexCode: string | null;
    adjustmentIndexName: string | null;
    adjustmentIndexValue: string | number | null;
    sortOrder: number;
    components: Array<{
      id: string;
      budgetItemId: string | null;
      apuResourceId: string | null;
      resourceType: string | null;
      amount: string | number;
    }>;
  }>;
} | null): McpSerializedPolynomialFormula {
  if (!formula) return { formula: null };

  return {
    formula: {
      id: formula.id,
      budgetId: formula.budgetId,
      name: formula.name,
      baseMonth: formula.baseMonth,
      baseYear: formula.baseYear,
      totalBaseAmount: decimalToString(formula.totalBaseAmount),
      status: formula.status,
      monomials: formula.monomials.map((monomial) => ({
        id: monomial.id,
        code: monomial.code,
        name: monomial.name,
        costGroupKey: monomial.costGroupKey,
        amount: decimalToString(monomial.amount),
        coefficient: decimalToString(monomial.coefficient),
        baseIndexCode: monomial.baseIndexCode,
        baseIndexName: monomial.baseIndexName,
        baseIndexValue: decimalToString(monomial.baseIndexValue),
        adjustmentIndexCode: monomial.adjustmentIndexCode,
        adjustmentIndexName: monomial.adjustmentIndexName,
        adjustmentIndexValue: monomial.adjustmentIndexValue != null ? decimalToString(monomial.adjustmentIndexValue) : null,
        sortOrder: monomial.sortOrder,
        components: monomial.components.map((component) => ({
          id: component.id,
          budgetItemId: component.budgetItemId,
          apuResourceId: component.apuResourceId,
          resourceType: component.resourceType,
          amount: decimalToString(component.amount),
        })),
      })),
    },
  };
}
