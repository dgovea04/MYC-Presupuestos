import type { BudgetComparisonResult } from "@/lib/budgets/budget-comparison";

const CSV_HEADERS = [
  "estado",
  "codigo",
  "descripcion",
  "unidad",
  "cantidad_base",
  "cantidad_revisada",
  "precio_base",
  "precio_revisado",
  "parcial_base",
  "parcial_revisado",
  "delta_parcial",
  "delta_parcial_pct",
] as const;

export function buildBudgetComparisonCsv(comparison: BudgetComparisonResult) {
  const rows = [
    ["presupuesto_base", comparison.baseBudgetName],
    ["presupuesto_revisado", comparison.targetBudgetName],
    ["moneda", comparison.currency],
    ["variacion_directa", formatCsvNumber(comparison.totals.deltaDirectCost)],
    ["variacion_directa_pct", formatOptionalCsvNumber(comparison.totals.deltaDirectCostPercent)],
    [],
    [...CSV_HEADERS],
    ...comparison.items.map((item) => [
      item.status,
      item.code,
      item.description,
      item.unit,
      formatOptionalCsvNumber(item.base?.quantity ?? null),
      formatOptionalCsvNumber(item.target?.quantity ?? null),
      formatOptionalCsvNumber(item.base?.unitPrice ?? null),
      formatOptionalCsvNumber(item.target?.unitPrice ?? null),
      formatOptionalCsvNumber(item.base?.partial ?? null),
      formatOptionalCsvNumber(item.target?.partial ?? null),
      formatCsvNumber(item.deltas.partial),
      formatOptionalCsvNumber(item.deltas.partialPercent),
    ]),
  ];

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export function buildBudgetComparisonCsvFilename(comparison: BudgetComparisonResult) {
  const baseName = normalizeFilenamePart(comparison.baseBudgetName);
  const targetName = normalizeFilenamePart(comparison.targetBudgetName);

  return `comparador-${baseName}-vs-${targetName}.csv`;
}

function escapeCsvCell(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function formatCsvNumber(value: number) {
  return Number.isFinite(value) ? String(value) : "0";
}

function formatOptionalCsvNumber(value: number | null) {
  return value === null ? "" : formatCsvNumber(value);
}

function normalizeFilenamePart(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "presupuesto"
  );
}
