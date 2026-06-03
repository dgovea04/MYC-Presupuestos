import type { Prisma } from "@prisma/client";
import {
  resolvePolynomialMonomialDisplayMetadata,
  resolvePolynomialIuFamilyDisplay,
  resolvePolynomialUnifiedIndexDisplay,
} from "@/lib/polynomial-formula/monomial-metadata";
import type { BudgetRecord } from "@/types/budget";
import type { CatalogPartidaRecord, PartidaApuRowRecord } from "@/types/partida";
import type {
  AdjustmentCalculationRecord,
  AdjustmentCalculationTermRecord,
  PolynomialFormulaRecord,
  PolynomialMonomialCompositionRecord,
  PolynomialMonomialRecord,
  UnifiedIndexRecord,
  ValuationRecord,
} from "@/types/polynomial-formula";
import type { ResourceRecord } from "@/types/resource";

type SerializableCatalogPartida = {
  id: string;
  description: string;
  unit: string;
  unitPrice: Prisma.Decimal;
  currency: string;
  source: string | null;
  performance: Prisma.Decimal;
  performanceUnit: string | null;
  performanceRate: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  apuRows: SerializablePartidaApuRow[];
};

type SerializablePartidaApuRow = {
  id: string;
  catalogPartidaId: string;
  resourceId: string | null;
  catalogSubpartidaId?: string | null;
  description: string;
  unit: string;
  crew: Prisma.Decimal | null;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  resourceType: string | null;
  groupLabel: string | null;
  sortOrder: number;
  catalogSubpartida?: SerializableCatalogPartida | null;
};

export function decimalToNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value.toString());
}

export function decimalToString(value: Prisma.Decimal | string | number | null | undefined) {
  if (value == null) return "0";
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  return value.toString();
}

export function decimalToFixedString(
  value: Prisma.Decimal | string | number | null | undefined,
  decimalPlaces: number,
) {
  if (value == null) {
    return (0).toFixed(decimalPlaces);
  }

  if (typeof value === "string" || typeof value === "number") {
    return Number(value).toFixed(decimalPlaces);
  }

  return value.toFixed(decimalPlaces);
}

function serializeDate(value: Date | string | null | undefined) {
  if (value == null) return undefined;
  return typeof value === "string" ? value : value.toISOString();
}

function readNestedApuRows(value: Prisma.JsonValue | null | undefined): PartidaApuRowRecord[] | undefined {
  if (!Array.isArray(value)) return undefined;

  return value.flatMap((entry) => {
    if (!isJsonObject(entry)) return [];

    const id = readJsonString(entry.id);
    const catalogPartidaId = readJsonString(entry.catalogPartidaId);
    const description = readJsonString(entry.description);
    const unit = readJsonString(entry.unit);
    if (!id || !catalogPartidaId || !description || !unit) return [];

    return [
      {
        id,
        catalogPartidaId,
        resourceId: readJsonNullableString(entry.resourceId),
        catalogSubpartidaId: readJsonNullableString(entry.catalogSubpartidaId),
        description,
        unit,
        crew: readJsonNullableNumber(entry.crew),
        quantity: readJsonNumber(entry.quantity),
        unitPrice: readJsonNumber(entry.unitPrice),
        subtotal: readJsonNumber(entry.subtotal),
        resourceType: readJsonNullableString(entry.resourceType),
        groupLabel: readJsonNullableString(entry.groupLabel),
        sortOrder: Math.max(0, Math.trunc(readJsonNumber(entry.sortOrder))),
      },
    ];
  });
}

function isJsonObject(value: Prisma.JsonValue): value is Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJsonString(value: Prisma.JsonValue | undefined) {
  return typeof value === "string" ? value : "";
}

function readJsonNullableString(value: Prisma.JsonValue | undefined) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readJsonNumber(value: Prisma.JsonValue | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readJsonNullableNumber(value: Prisma.JsonValue | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function serializeBudget(budget: {
  id: string;
  projectId: string;
  parentBudgetId: string | null;
  kind: "GENERAL" | "SUB_BUDGET";
  name: string;
  currency: string;
  igvRate: Prisma.Decimal;
  generalExpensesRate: Prisma.Decimal;
  utilityRate: Prisma.Decimal;
  totalDirectCost: Prisma.Decimal;
  totalGeneralExpenses: Prisma.Decimal;
  totalUtility: Prisma.Decimal;
  totalTax: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  levels: Array<{
    id: string;
    budgetId: string;
    parentId: string | null;
    type: "TITLE" | "SUBTITLE" | "ITEM_GROUP" | "SUBITEM";
    code: string;
    name: string;
    sortOrder: number;
  }>;
  items: Array<{
    id: string;
    budgetId: string;
    levelId: string | null;
    code: string;
    description: string;
    unit: string;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    partial: Prisma.Decimal;
    sortOrder: number;
    apu: null | {
      id: string;
      budgetItemId: string;
      name: string;
      unit: string;
      performance: Prisma.Decimal;
      totalUnitCost: Prisma.Decimal;
      resources: Array<{
        id: string;
        apuId: string;
        resourceId: string | null;
        catalogPartidaId?: string | null;
        resourceType: string;
        crew?: Prisma.Decimal | null;
        quantity: Prisma.Decimal;
        unitPrice: Prisma.Decimal;
        subtotal: Prisma.Decimal;
        nestedApuRows?: Prisma.JsonValue | null;
        resource: null | {
          id: string;
          companyId: string | null;
          code: string;
          description: string;
          category: "MATERIAL" | "LABOR" | "EQUIPMENT" | "TOOLS" | "SUBCONTRACT";
          iu: string | null;
          iuCurrent: string | null;
          iuCurrentReviewStatus?: string | null;
          subcategory: string | null;
          unit: string;
          unitPrice: Prisma.Decimal;
          currency: string;
          source: string | null;
        };
        catalogPartida?: SerializableCatalogPartida | null;
      }>;
    };
  }>;
}): BudgetRecord {
  return {
    id: budget.id,
    projectId: budget.projectId,
    parentBudgetId: budget.parentBudgetId ?? undefined,
    kind: budget.kind,
    name: budget.name,
    currency: budget.currency,
    igvRate: decimalToNumber(budget.igvRate),
    generalExpensesRate: decimalToNumber(budget.generalExpensesRate),
    utilityRate: decimalToNumber(budget.utilityRate),
    totalDirectCost: decimalToNumber(budget.totalDirectCost),
    totalGeneralExpenses: decimalToNumber(budget.totalGeneralExpenses),
    totalUtility: decimalToNumber(budget.totalUtility),
    totalTax: decimalToNumber(budget.totalTax),
    totalAmount: decimalToNumber(budget.totalAmount),
    levels: budget.levels.map((level) => ({
      ...level,
      parentId: level.parentId ?? undefined,
    })),
    items: budget.items.map((item) => ({
      id: item.id,
      budgetId: item.budgetId,
      levelId: item.levelId ?? undefined,
      code: item.code,
      description: item.description,
      unit: item.unit,
      quantity: decimalToNumber(item.quantity),
      unitPrice: decimalToNumber(item.unitPrice),
      partial: decimalToNumber(item.partial),
      sortOrder: item.sortOrder,
      apu: item.apu
        ? {
            id: item.apu.id,
            budgetItemId: item.apu.budgetItemId,
            name: item.apu.name,
            unit: item.apu.unit,
            performance: decimalToNumber(item.apu.performance),
            totalUnitCost: decimalToNumber(item.apu.totalUnitCost),
            resources: item.apu.resources.map((resource) => ({
              id: resource.id,
              apuId: resource.apuId,
              resourceId: resource.resourceId ?? undefined,
              catalogPartidaId: resource.catalogPartidaId ?? undefined,
              resourceType: resource.resourceType,
              crew: resource.crew == null ? undefined : decimalToNumber(resource.crew),
              quantity: decimalToNumber(resource.quantity),
              unitPrice: decimalToNumber(resource.unitPrice),
              subtotal: decimalToNumber(resource.subtotal),
              nestedApuRows: readNestedApuRows(resource.nestedApuRows),
              resource: resource.resource ? serializeResource(resource.resource) : undefined,
              catalogPartida: resource.catalogPartida ? serializeCatalogPartida(resource.catalogPartida) : undefined,
            })),
          }
        : null,
    })),
  };
}

export function serializeResource(resource: {
  id: string;
  companyId: string | null;
  code: string;
  description: string;
  category: "MATERIAL" | "LABOR" | "EQUIPMENT" | "TOOLS" | "SUBCONTRACT";
  iu: string | null;
  iuCurrent: string | null;
  iuCurrentReviewStatus?: string | null;
  subcategory: string | null;
  unit: string;
  unitPrice: Prisma.Decimal;
  currency: string;
  source: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}): ResourceRecord {
  return {
    id: resource.id,
    companyId: resource.companyId ?? undefined,
    code: resource.code,
    description: resource.description,
    category: resource.category,
    iu: resource.iu ?? undefined,
    iuCurrent: resource.iuCurrent ?? undefined,
    iuCurrentReviewStatus: resource.iuCurrentReviewStatus ?? undefined,
    subcategory: resource.subcategory ?? undefined,
    unit: resource.unit,
    unitPrice: decimalToNumber(resource.unitPrice),
    currency: resource.currency,
    source: resource.source ?? undefined,
    createdAt: serializeDate(resource.createdAt),
    updatedAt: serializeDate(resource.updatedAt),
  };
}

export function serializeCatalogPartida(partida: SerializableCatalogPartida, depth = 0): CatalogPartidaRecord {
  return {
    id: partida.id,
    description: partida.description,
    unit: partida.unit,
    unitPrice: decimalToNumber(partida.unitPrice),
    currency: partida.currency,
    source: partida.source ?? undefined,
    performance: decimalToNumber(partida.performance),
    performanceUnit: partida.performanceUnit ?? undefined,
    performanceRate: partida.performanceRate ?? undefined,
    apuRows: partida.apuRows
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((row) => ({
        id: row.id,
        catalogPartidaId: row.catalogPartidaId,
        resourceId: row.resourceId ?? undefined,
        catalogSubpartidaId: row.catalogSubpartidaId ?? undefined,
        description: row.description,
        unit: row.unit,
        crew: row.crew == null ? undefined : decimalToNumber(row.crew),
        quantity: decimalToNumber(row.quantity),
        unitPrice: decimalToNumber(row.unitPrice),
        subtotal: decimalToNumber(row.subtotal),
        resourceType: row.resourceType ?? undefined,
        groupLabel: row.groupLabel ?? undefined,
        sortOrder: row.sortOrder,
        catalogSubpartida: row.catalogSubpartida && depth < 1 ? serializeCatalogPartida(row.catalogSubpartida, depth + 1) : undefined,
      })),
    createdAt: partida.createdAt?.toISOString(),
    updatedAt: partida.updatedAt?.toISOString(),
  };
}

export function serializePolynomialMonomialComposition(component: {
  id: string;
  monomialId: string;
  budgetItemId: string | null;
  apuResourceId: string | null;
  resourceType: string | null;
  apuResource?: { resource: { description: string } | null } | null;
  amount: Prisma.Decimal;
  unifiedIndexCode?: string | null;
  unifiedIndexName?: string | null;
  iuFamily?: string | null;
  participationPercentage?: Prisma.Decimal | null;
  coefficientContribution?: Prisma.Decimal | null;
  createdAt?: Date;
  updatedAt?: Date;
}): PolynomialMonomialCompositionRecord {
  const unifiedIndex = resolvePolynomialUnifiedIndexDisplay({
    code: component.unifiedIndexCode,
    name: component.unifiedIndexName,
  });

  return {
    id: component.id,
    monomialId: component.monomialId,
    budgetItemId: component.budgetItemId ?? undefined,
    apuResourceId: component.apuResourceId ?? undefined,
    resourceType: component.resourceType ?? undefined,
    resourceName: component.apuResource?.resource?.description,
    amount: decimalToFixedString(component.amount, 2),
    unifiedIndexCode: unifiedIndex.code,
    unifiedIndexName: unifiedIndex.name,
    iuFamily: resolvePolynomialIuFamilyDisplay({
      code: unifiedIndex.code,
      family: component.iuFamily,
    }),
    participationPercentage:
      component.participationPercentage == null
        ? undefined
        : decimalToString(component.participationPercentage),
    coefficientContribution:
      component.coefficientContribution == null
        ? undefined
        : decimalToString(component.coefficientContribution),
    createdAt: component.createdAt?.toISOString(),
    updatedAt: component.updatedAt?.toISOString(),
  };
}

export function serializePolynomialMonomial(monomial: {
  id: string;
  formulaId: string;
  code: string;
  name: string;
  costGroupKey:
    | "LABOR"
    | "MATERIALS"
    | "EQUIPMENT"
    | "OTHERS"
    | "GENERAL_EXPENSES_PROFIT"
    | "STEEL"
    | "CEMENT"
    | "MASONRY"
    | "INSTALLATIONS";
  amount: Prisma.Decimal;
  coefficient: Prisma.Decimal;
  baseIndexCode: string;
  baseIndexName: string;
  baseIndexValue: Prisma.Decimal;
  adjustmentIndexCode: string | null;
  adjustmentIndexName: string | null;
  adjustmentIndexValue: Prisma.Decimal | null;
  sortOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
  components?: Array<Parameters<typeof serializePolynomialMonomialComposition>[0]>;
}): PolynomialMonomialRecord {
  const displayMetadata = resolvePolynomialMonomialDisplayMetadata({
    code: monomial.code,
    name: monomial.name,
    baseIndexCode: monomial.baseIndexCode,
    baseIndexName: monomial.baseIndexName,
  });

  return {
    id: monomial.id,
    formulaId: monomial.formulaId,
    code: displayMetadata.code,
    name: displayMetadata.name,
    costGroupKey: monomial.costGroupKey,
    amount: decimalToFixedString(monomial.amount, 4),
    coefficient: decimalToString(monomial.coefficient),
    baseIndexCode: displayMetadata.baseIndexCode,
    baseIndexName: displayMetadata.baseIndexName,
    baseIndexValue: decimalToString(monomial.baseIndexValue),
    adjustmentIndexCode: monomial.adjustmentIndexCode,
    adjustmentIndexName: monomial.adjustmentIndexName,
    adjustmentIndexValue:
      monomial.adjustmentIndexValue == null
        ? null
        : decimalToString(monomial.adjustmentIndexValue),
    sortOrder: monomial.sortOrder,
    composition: monomial.components?.map(serializePolynomialMonomialComposition) ?? [],
    createdAt: monomial.createdAt?.toISOString(),
    updatedAt: monomial.updatedAt?.toISOString(),
  };
}

export function serializePolynomialFormula(formula: {
  id: string;
  budgetId: string;
  name: string;
  baseMonth: number;
  baseYear: number;
  totalBaseAmount: Prisma.Decimal;
  status: "DRAFT" | "VALID" | "ARCHIVED";
  monomials: Array<Parameters<typeof serializePolynomialMonomial>[0]>;
  createdAt?: Date;
  updatedAt?: Date;
}): PolynomialFormulaRecord {
  return {
    id: formula.id,
    budgetId: formula.budgetId,
    name: formula.name,
    baseMonth: formula.baseMonth,
    baseYear: formula.baseYear,
    totalBaseAmount: decimalToFixedString(formula.totalBaseAmount, 4),
    status: formula.status,
    monomials: formula.monomials.map(serializePolynomialMonomial),
    createdAt: formula.createdAt?.toISOString(),
    updatedAt: formula.updatedAt?.toISOString(),
  };
}

export function serializeUnifiedIndex(index: {
  id: string;
  code: string;
  name: string;
  geographicArea: string | null;
  month: number;
  year: number;
  value: Prisma.Decimal;
  source: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}): UnifiedIndexRecord {
  return {
    id: index.id,
    code: index.code,
    name: index.name,
    geographicArea: index.geographicArea ?? undefined,
    month: index.month,
    year: index.year,
    value: decimalToString(index.value),
    source: index.source ?? undefined,
    createdAt: index.createdAt?.toISOString(),
    updatedAt: index.updatedAt?.toISOString(),
  };
}

export function serializeValuation(valuation: {
  id: string;
  formulaId: string | null;
  month: number;
  year: number;
  amount: Prisma.Decimal;
  createdAt?: Date;
  updatedAt?: Date;
}): ValuationRecord {
  return {
    id: valuation.id,
    formulaId: valuation.formulaId ?? undefined,
    month: valuation.month,
    year: valuation.year,
    amount: decimalToFixedString(valuation.amount, 2),
    createdAt: valuation.createdAt?.toISOString(),
    updatedAt: valuation.updatedAt?.toISOString(),
  };
}

export function serializeAdjustmentCalculationTerm(term: {
  id: string;
  adjustmentId: string;
  monomialId: string;
  name: string;
  coefficient: Prisma.Decimal;
  baseIndexValue: Prisma.Decimal;
  adjustmentIndexValue: Prisma.Decimal;
  ratio: Prisma.Decimal;
  partial: Prisma.Decimal;
  sortOrder: number;
}): AdjustmentCalculationTermRecord {
  return {
    id: term.id,
    adjustmentId: term.adjustmentId,
    monomialId: term.monomialId,
    name: term.name,
    coefficient: decimalToString(term.coefficient),
    baseIndexValue: decimalToString(term.baseIndexValue),
    adjustmentIndexValue: decimalToString(term.adjustmentIndexValue),
    ratio: decimalToString(term.ratio),
    partial: decimalToString(term.partial),
    sortOrder: term.sortOrder,
  };
}

export function serializeAdjustmentCalculation(adjustment: {
  id: string;
  formulaId: string;
  valuationId: string | null;
  month: number;
  year: number;
  originalAmount: Prisma.Decimal;
  adjustedAmount: Prisma.Decimal;
  adjustmentAmount: Prisma.Decimal;
  kRaw: Prisma.Decimal;
  kRounded: Prisma.Decimal;
  terms: Array<Parameters<typeof serializeAdjustmentCalculationTerm>[0]>;
  createdAt?: Date;
  updatedAt?: Date;
}): AdjustmentCalculationRecord {
  return {
    id: adjustment.id,
    formulaId: adjustment.formulaId,
    valuationId: adjustment.valuationId,
    month: adjustment.month,
    year: adjustment.year,
    originalAmount: decimalToFixedString(adjustment.originalAmount, 2),
    adjustedAmount: decimalToFixedString(adjustment.adjustedAmount, 2),
    adjustmentAmount: decimalToFixedString(adjustment.adjustmentAmount, 2),
    kRaw: decimalToString(adjustment.kRaw),
    kRounded: decimalToString(adjustment.kRounded),
    terms: adjustment.terms.map(serializeAdjustmentCalculationTerm),
    createdAt: adjustment.createdAt?.toISOString(),
    updatedAt: adjustment.updatedAt?.toISOString(),
  };
}
