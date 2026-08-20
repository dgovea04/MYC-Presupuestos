import Decimal from "decimal.js";

import type { PdfAiImportDraft, PdfImportedApu, PdfImportedApuRow, PdfImportedBudgetItem } from "./types";

export function calculatePdfImportDraftTotals(draft: PdfAiImportDraft): PdfAiImportDraft {
  return {
    ...draft,
    budgets: draft.budgets.map((budget) => ({
      ...budget,
      items: budget.items.map(recalculateBudgetItem),
    })),
    apus: draft.apus.map(recalculateApu),
    subpartidas: draft.subpartidas.map((subpartida) => {
      const rows = subpartida.rows.map(recalculateApuRow);
      return {
        ...subpartida,
        rows,
        unitPrice: sumRows(rows),
      };
    }),
  };
}

export function calculateDecimalDifference(left: string, right: string) {
  return new Decimal(left).minus(new Decimal(right)).abs();
}

export function formatPdfImportMoney(value: Decimal.Value) {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

function recalculateBudgetItem(item: PdfImportedBudgetItem): PdfImportedBudgetItem {
  return {
    ...item,
    partial: formatPdfImportMoney(new Decimal(item.quantity).times(item.unitPrice)),
  };
}

function recalculateApu(apu: PdfImportedApu): PdfImportedApu {
  const rows = apu.rows.map(recalculateApuRow);
  return {
    ...apu,
    rows,
    totalUnitCost: sumRows(rows),
  };
}

function recalculateApuRow(row: PdfImportedApuRow): PdfImportedApuRow {
  return {
    ...row,
    subtotal: formatPdfImportMoney(new Decimal(row.quantity).times(row.unitPrice)),
  };
}

function sumRows(rows: PdfImportedApuRow[]) {
  return formatPdfImportMoney(rows.reduce((sum, row) => sum.plus(row.subtotal), new Decimal(0)));
}
