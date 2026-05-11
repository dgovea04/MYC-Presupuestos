import { toNumber } from "@/lib/utils";

type ApuCalculationRow = {
  resourceType?: string | null;
  crew?: number | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  unit?: string | null;
  resource?: {
    unit?: string | null;
    category?: string | null;
  };
};

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
    const baseSubtotal = getPercentageBaseSubtotal(normalizedUnit, nonPercentageTotals);
    const unitPrice = roundMoney(baseSubtotal);
    const subtotal = roundMoney((quantity / 100) * baseSubtotal);

    return {
      ...row,
      quantity,
      unitPrice,
      subtotal,
    };
  });
}

export function calculateApuTotalUnitCost<T extends ApuCalculationRow>(rows: T[], performance: number) {
  return roundMoney(calculateApuRows(rows, performance).reduce((sum, row) => sum + row.subtotal, 0));
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

function calculateRowQuantity(row: ApuCalculationRow, performance: number, normalizedUnit: string) {
  if (!CREW_DRIVEN_UNITS.has(normalizedUnit) || row.crew == null) {
    return round(toNumber(row.quantity));
  }

  if (performance <= 0) {
    return 0;
  }

  return round((toNumber(row.crew) * HOURS_PER_DAY) / performance);
}

function getPercentageBaseSubtotal(
  normalizedUnit: string,
  totals: { labor: number; material: number; equipment: number; tools: number; subcontract: number },
) {
  const baseToken = normalizedUnit.replace("%", "");

  if (baseToken === "MO" || baseToken === "LABOR") return totals.labor;
  if (baseToken === "MAT" || baseToken === "MATERIAL") return totals.material;
  if (baseToken === "EQ" || baseToken === "EQUIPO" || baseToken === "EQUIPMENT") return totals.equipment;
  if (baseToken === "TOOLS" || baseToken === "HERRAMIENTAS") return totals.tools;
  if (baseToken === "SUB" || baseToken === "SUBCONTRATO" || baseToken === "SUBCONTRACT") return totals.subcontract;

  return 0;
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
