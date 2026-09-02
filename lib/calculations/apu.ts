import { toNumber } from "@/lib/utils";

type ApuCategorySource = {
  resourceType?: string | null;
  resource?: {
    unit?: string | null;
    category?: string | null;
  } | null;
};

type ApuCalculationRow = ApuCategorySource & {
  crew?: number | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  unit?: string | null;
};

export type ApuPresentationCategory = "LABOR" | "MATERIAL" | "EQUIPMENT" | "SUBCONTRACT" | "SUBPARTIDA";

export type ApuCategoryTotal = {
  category: ApuPresentationCategory;
  subtotal: number;
};

export const APU_PRESENTATION_CATEGORY_ORDER: ApuPresentationCategory[] = [
  "LABOR",
  "MATERIAL",
  "EQUIPMENT",
  "SUBCONTRACT",
  "SUBPARTIDA",
];

export function sortApuResourcesByCategory<T extends ApuCategorySource>(rows: T[]): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const categoryOrder = APU_PRESENTATION_CATEGORY_ORDER.indexOf(getApuPresentationCategory(left.row));
      const rightCategoryOrder = APU_PRESENTATION_CATEGORY_ORDER.indexOf(getApuPresentationCategory(right.row));
      return categoryOrder - rightCategoryOrder || left.index - right.index;
    })
    .map(({ row }) => row);
}

type ResourceBucket = "LABOR" | "MATERIAL" | "EQUIPMENT" | "TOOLS" | "SUBCONTRACT" | "OTHER";

const HOURS_PER_DAY = 8;
const CREW_DRIVEN_UNITS = new Set(["HH", "HM", "H-H", "H-M"]);

export function calculateApuRows<T extends ApuCalculationRow>(rows: T[], performance: number): T[] {
  const safePerformance = toNumber(performance);
  const nonPercentageTotals = {
    labor: 0,
    material: 0,
    equipment: 0,
    tools: 0,
    subcontract: 0,
  };

  const baseRows = rows.map((row) => {
    const normalizedUnit = normalizeUnit(getRowUnit(row));
    const quantity = calculateRowQuantity(row, safePerformance, normalizedUnit);

    if (isPercentageUnit(normalizedUnit)) {
      return {
        ...row,
        quantity,
        unitPrice: roundRate(toNumber(row.unitPrice)),
        subtotal: 0,
      };
    }

    const unitPrice = roundRate(toNumber(row.unitPrice));
    const subtotal = roundMoney(quantity * unitPrice);

    accumulateSubtotal(nonPercentageTotals, resolveRowBucket(row), subtotal);

    return {
      ...row,
      quantity,
      unitPrice,
      subtotal,
    };
  });

  return baseRows.map((row) => {
    const normalizedUnit = normalizeUnit(getRowUnit(row));
    if (!isPercentageUnit(normalizedUnit)) {
      return row;
    }

    const quantity = round(toNumber(row.quantity));
    const baseSubtotal = getPercentageBaseSubtotal(normalizedUnit, nonPercentageTotals, toNumber(row.unitPrice));
    const unitPrice = roundMoney(baseSubtotal);
    const subtotal = roundMoney((quantity / 100) * baseSubtotal);

    const calculatedRow = {
      ...row,
      quantity,
      unitPrice,
      subtotal,
    };

    accumulateSubtotal(nonPercentageTotals, resolveRowBucket(row), subtotal);

    return calculatedRow;
  });
}

export function calculateApuSummary<T extends ApuCalculationRow>(rows: T[], performance: number) {
  const calculatedRows = calculateApuRows(rows, performance);

  return {
    rows: calculatedRows,
    categoryTotals: buildCategoryTotals(calculatedRows),
    totalUnitCost: roundMoney(calculatedRows.reduce((sum, row) => sum + row.subtotal, 0)),
  };
}

export function calculateApuTotalUnitCost<T extends ApuCalculationRow>(rows: T[], performance: number) {
  return calculateApuSummary(rows, performance).totalUnitCost;
}

export function isCrewDrivenApuRow(row: Pick<ApuCalculationRow, "crew" | "resourceType" | "unit" | "resource">) {
  if (row.crew == null) return false;
  return CREW_DRIVEN_UNITS.has(normalizeUnit(getRowUnit(row)));
}

export function isPercentageBasedApuRow(row: Pick<ApuCalculationRow, "unit" | "resource">) {
  return isPercentageUnit(normalizeUnit(getRowUnit(row)));
}

export function isLaborApuRow(row: Pick<ApuCalculationRow, "resourceType" | "resource">) {
  return resolveRowBucket(row) === "LABOR";
}

export function isEquipmentApuRow(row: Pick<ApuCalculationRow, "resourceType" | "resource">) {
  return resolveRowBucket(row) === "EQUIPMENT";
}

export function getApuPresentationCategory(row: ApuCategorySource): ApuPresentationCategory {
  const normalizedType = normalizeResourceType(row.resourceType ?? row.resource?.category ?? "");

  if (normalizedType === "LABOR" || normalizedType === "MO" || normalizedType === "MANO DE OBRA") return "LABOR";
  if (normalizedType === "MATERIAL" || normalizedType === "MAT" || normalizedType === "MATERIALES") return "MATERIAL";
  if (
    normalizedType === "EQUIPMENT" ||
    normalizedType === "EQ" ||
    normalizedType === "EQUIPO" ||
    normalizedType === "TOOLS" ||
    normalizedType === "TOOL" ||
    normalizedType === "HERRAMIENTAS"
  ) {
    return "EQUIPMENT";
  }
  if (normalizedType === "SUBCONTRACT" || normalizedType === "SUBCONTRATOS" || normalizedType === "SUBCONTRATO") return "SUBCONTRACT";
  if (
    normalizedType === "SUBPARTIDA" ||
    normalizedType === "SUB PARTIDA" ||
    normalizedType === "SUBPARTIDAS" ||
    normalizedType === "SUB PARTIDAS"
  ) {
    return "SUBPARTIDA";
  }

  return "MATERIAL";
}

function calculateRowQuantity(row: ApuCalculationRow, performance: number, normalizedUnit: string) {
  if (!CREW_DRIVEN_UNITS.has(normalizedUnit) || row.crew == null) {
    return round(toNumber(row.quantity));
  }

  if (performance <= 0) {
    return 0;
  }

  return round((toNumber(row.crew) * HOURS_PER_DAY) / performance);
}

function buildCategoryTotals(rows: ApuCalculationRow[]): ApuCategoryTotal[] {
  const totals = new Map<ApuPresentationCategory, number>(
    APU_PRESENTATION_CATEGORY_ORDER.map((category) => [category, 0]),
  );

  for (const row of rows) {
    const category = getApuPresentationCategory(row);
    totals.set(category, roundMoney((totals.get(category) ?? 0) + row.subtotal));
  }

  return APU_PRESENTATION_CATEGORY_ORDER.map((category) => ({
    category,
    subtotal: totals.get(category) ?? 0,
  }));
}

function getPercentageBaseSubtotal(
  normalizedUnit: string,
  totals: { labor: number; material: number; equipment: number; tools: number; subcontract: number },
  fallbackBaseSubtotal: number,
) {
  const baseToken = normalizedUnit.replace("%", "");

  if (baseToken === "MO" || baseToken === "LABOR") return totals.labor;
  if (baseToken === "MT" || baseToken === "MAT" || baseToken === "MATERIAL") return totals.material;
  if (baseToken === "EQ" || baseToken === "EQUIPO" || baseToken === "EQUIPMENT") return totals.equipment;
  if (baseToken === "TOOLS" || baseToken === "HERRAMIENTAS") return totals.tools;
  if (baseToken === "SUB" || baseToken === "SUBCONTRATO" || baseToken === "SUBCONTRACT") return totals.subcontract;

  return fallbackBaseSubtotal;
}

function accumulateSubtotal(
  totals: { labor: number; material: number; equipment: number; tools: number; subcontract: number },
  bucket: ResourceBucket,
  subtotal: number,
) {
  if (bucket === "LABOR") {
    totals.labor = roundMoney(totals.labor + subtotal);
    return;
  }

  if (bucket === "MATERIAL") {
    totals.material = roundMoney(totals.material + subtotal);
    return;
  }

  if (bucket === "EQUIPMENT") {
    totals.equipment = roundMoney(totals.equipment + subtotal);
    return;
  }

  if (bucket === "TOOLS") {
    totals.tools = roundMoney(totals.tools + subtotal);
    return;
  }

  if (bucket === "SUBCONTRACT") {
    totals.subcontract = roundMoney(totals.subcontract + subtotal);
  }
}

function resolveRowBucket(row: Pick<ApuCalculationRow, "resourceType" | "resource">): ResourceBucket {
  const normalizedType = normalizeResourceType(row.resourceType ?? row.resource?.category ?? "");

  if (normalizedType === "LABOR" || normalizedType === "MO") return "LABOR";
  if (normalizedType === "MATERIAL" || normalizedType === "MAT") return "MATERIAL";
  if (normalizedType === "EQUIPMENT" || normalizedType === "EQ" || normalizedType === "EQUIPO") return "EQUIPMENT";
  if (normalizedType === "TOOLS" || normalizedType === "TOOL" || normalizedType === "HERRAMIENTAS") return "TOOLS";
  if (normalizedType === "SUBCONTRACT" || normalizedType === "SUBCONTRATOS" || normalizedType === "SUBCONTRATO") return "SUBCONTRACT";

  return "OTHER";
}

function getRowUnit(row: Pick<ApuCalculationRow, "unit" | "resource">) {
  return row.resource?.unit ?? row.unit ?? "";
}

function isPercentageUnit(normalizedUnit: string) {
  return normalizedUnit.startsWith("%");
}

function normalizeUnit(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

function normalizeResourceType(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundRate(value: number) {
  return round(value);
}
