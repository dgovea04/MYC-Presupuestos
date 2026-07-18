"use client";

import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { diffInDays } from "@/components/budget/gantt/gantt-utils";
import type { WorkScheduleLineRecord } from "@/types/work-schedule";

// ─── Constants ──────────────────────────────────────────────────────────────

/**
 * Canonical header tuple for the per-line overview CSV export.
 *
 * The position of each entry is the source of truth: row index `i` of
 * `mapLineToCsvRow` corresponds to header `OVERVIEW_CSV_HEADERS[i]`. The helper's
 * return type is a 15-tuple so TypeScript flags any drift between the two.
 */
export const OVERVIEW_CSV_HEADERS = [
  "Item",
  "Partida",
  "Duracion",
  "Dias calendario",
  "Inicio",
  "Fin",
  "Inicio real",
  "Fin real",
  "% Avance",
  "Predecesora",
  "Cuadrilla",
  "Unidad",
  "Metrado",
  "PU",
  "Parcial",
] as const;

export type OverviewCsvHeader = (typeof OVERVIEW_CSV_HEADERS)[number];

/**
 * Quantity ("Metrado") is rendered with this many decimals on the export.
 *
 * Project convention: quantities (m2, m3, und, etc.) always render at 2
 * decimals regardless of the `currencyDecimals` parameter.
 */
const QUANTITY_DECIMALS = 2;

// ─── Export functions ──────────────────────────────────────────────────────

/**
 * Maps a {@link WorkScheduleLineRecord} to the 15-cell CSV row that pairs with
 * {@link OVERVIEW_CSV_HEADERS}. Return type is a 15-tuple so any deviation from
 * the canonical layout fails the build.
 */
export function mapLineToCsvRow(
  line: WorkScheduleLineRecord,
  currency: string,
  currencyDecimals: number,
  dateFormat: string,
): readonly [string, string, string, string, string, string, string, string, string, string, string, string, string, string, string] {
  return [
    line.itemCode,
    line.description,
    line.durationDays != null ? String(line.durationDays) : "-",
    line.startDate && line.endDate ? String(Math.round(diffInDays(line.startDate, line.endDate)) + 1) : "-",
    line.startDate ? formatDate(line.startDate, dateFormat as never) : "Pendiente",
    line.endDate ? formatDate(line.endDate, dateFormat as never) : "Pendiente",
    line.actualStartDate ? formatDate(line.actualStartDate, dateFormat as never) : "-",
    line.actualEndDate ? formatDate(line.actualEndDate, dateFormat as never) : "-",
    line.percentComplete != null ? `${formatNumber(line.percentComplete, 0)}%` : "-",
    line.predecessor || "-",
    line.crew != null ? formatNumber(line.crew, 2) : "-",
    line.unit,
    formatNumber(line.quantity, QUANTITY_DECIMALS),
    formatCurrency(line.unitPrice, currency, currencyDecimals),
    formatCurrency(line.partial, currency, currencyDecimals),
  ];
}

export function formatPeriodLabel(period: { year: number; month: number }) {
  return `${period.month.toString().padStart(2, "0")}/${period.year}`;
}

export function formatTimelineRange(startDate: string | null, endDate: string | null, dateFormat: string) {
  if (!startDate || !endDate) {
    return "Pendiente";
  }

  return `${formatDate(startDate, dateFormat as never)} - ${formatDate(endDate, dateFormat as never)}`;
}
