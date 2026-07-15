"use client";

import type ExcelJS from "exceljs";
import { isPendingWorkScheduleLine, hasIncompleteDistribution } from "../overview-view";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import type { DateFormatOption } from "@/types/settings";
import type {
  WorkScheduleLineRecord,
  WorkScheduleMonthlyDistributionRecord,
  WorkScheduleValuationCalendarRow,
  WorkScheduleResourceCalendarRow,
  WorkScheduleCurvePointRecord,
  WorkSchedulePeriodRecord,
} from "@/types/work-schedule";

type ActiveView = "overview" | "valuation" | "resources" | "curve";
type WorkbookExportScope = "detail_only" | "detail_and_total" | "detail_subtotals_and_total";
type WorkbookExportProfile = "minimal" | "executive" | "analytical";
type WorkbookCell = {
  value: ExcelJS.CellValue;
  numFmt?: string;
};
type WorkbookTableData = {
  headers: string[];
  rows: WorkbookCell[][];
  subtotalRowIndexes?: number[];
  totalRow?: WorkbookCell[];
};

// ─── Export functions ──────────────────────────────────────────────────────

export function formatPeriodLabel(period: { year: number; month: number }) {
  return `${period.month.toString().padStart(2, "0")}/${period.year}`;
}

function formatDistributionLabel(distribution: WorkScheduleMonthlyDistributionRecord) {
  return `${formatPeriodLabel(distribution)} · ${distribution.percentage.toFixed(4)}%`;
}

function formatDistributionTooltip(
  distribution: WorkScheduleMonthlyDistributionRecord,
  partial: number,
  currency: string,
  currencyDecimals: number,
) {
  const amount = partial * (distribution.percentage / 100);
  return `${formatDistributionLabel(distribution)} · ${formatCurrency(amount, currency, currencyDecimals)}`;
}

export function describeWorkbookExportPreview(
  activeView: ActiveView,
  scopes: {
    executiveWorkbookScope: WorkbookExportScope;
    valuationWorkbookScope: WorkbookExportScope;
    resourceWorkbookScope: WorkbookExportScope;
    curveWorkbookScope: WorkbookExportScope;
  },
) {
  if (activeView === "overview") {
    return buildWorkbookScopePreview("paquete ejecutivo", scopes.executiveWorkbookScope, "partida y resumen");
  }

  if (activeView === "valuation") {
    return buildWorkbookScopePreview("calendario valorizado", scopes.valuationWorkbookScope, "partida");
  }

  if (activeView === "resources") {
    return buildWorkbookScopePreview("calendario de insumos", scopes.resourceWorkbookScope, "insumo");
  }

  return buildWorkbookScopePreview("curva S", scopes.curveWorkbookScope, "periodo");
}

export function getWorkbookExportTargetLabel(activeView: ActiveView) {
  if (activeView === "overview") {
    return "Paquete ejecutivo";
  }

  if (activeView === "valuation") {
    return "Calendario valorizado";
  }

  if (activeView === "resources") {
    return "Calendario de insumos";
  }

  return "Curva S";
}

export function getSupportedWorkbookProfiles(activeView: ActiveView): WorkbookExportProfile[] {
  if (activeView === "curve") {
    return ["minimal", "executive"];
  }

  return ["minimal", "executive", "analytical"];
}

export function getWorkbookExportProfileLabel(profile: WorkbookExportProfile) {
  if (profile === "minimal") {
    return "Minimo";
  }

  if (profile === "executive") {
    return "Ejecutivo";
  }

  return "Analitico";
}

export function getWorkbookExportScopeForView(
  activeView: ActiveView,
  scopes: {
    executiveWorkbookScope: WorkbookExportScope;
    valuationWorkbookScope: WorkbookExportScope;
    resourceWorkbookScope: WorkbookExportScope;
    curveWorkbookScope: WorkbookExportScope;
  },
) {
  if (activeView === "overview") {
    return scopes.executiveWorkbookScope;
  }

  if (activeView === "valuation") {
    return scopes.valuationWorkbookScope;
  }

  if (activeView === "resources") {
    return scopes.resourceWorkbookScope;
  }

  return scopes.curveWorkbookScope;
}

export function getWorkbookExportProfileFromScope(activeView: ActiveView, scope: WorkbookExportScope): WorkbookExportProfile {
  if (scope === "detail_only") {
    return "minimal";
  }

  if (scope === "detail_and_total") {
    return "executive";
  }

  return activeView === "curve" ? "executive" : "analytical";
}

export function getWorkbookExportScopeFromProfile(activeView: ActiveView, profile: WorkbookExportProfile): WorkbookExportScope {
  if (profile === "minimal") {
    return "detail_only";
  }

  if (profile === "executive") {
    return "detail_and_total";
  }

  return activeView === "curve" ? "detail_and_total" : "detail_subtotals_and_total";
}

function buildWorkbookScopePreview(target: string, scope: WorkbookExportScope, detailUnit: string) {
  if (scope === "detail_only") {
    return `Se exportara ${target} con solo detalle por ${detailUnit}.`;
  }

  if (scope === "detail_and_total") {
    return `Se exportara ${target} con detalle por ${detailUnit} y total general.`;
  }

  return `Se exportara ${target} con detalle por ${detailUnit}, subtotales y total general.`;
}

export function buildWorkbookExportPreviewBadges(
  activeView: ActiveView,
  scopes: {
    executiveWorkbookScope: WorkbookExportScope;
    valuationWorkbookScope: WorkbookExportScope;
    resourceWorkbookScope: WorkbookExportScope;
    curveWorkbookScope: WorkbookExportScope;
  },
) {
  const scope =
    activeView === "overview"
      ? scopes.executiveWorkbookScope
      : activeView === "valuation"
        ? scopes.valuationWorkbookScope
        : activeView === "resources"
          ? scopes.resourceWorkbookScope
          : scopes.curveWorkbookScope;

  const badges = ["Detalle"];

  if (scope === "detail_only") {
    badges.push("Solo detalle");
    return badges;
  }

  badges.push("Incluye total");

  if (scope === "detail_subtotals_and_total") {
    badges.push("Incluye subtotales");
  }

  return badges;
}

function isFullyScheduledWorkScheduleLine(line: WorkScheduleLineRecord) {
  return !isPendingWorkScheduleLine(line);
}

export function buildWorkScheduleCsvExport({
  activeView,
  overviewLines,
  valuationRows,
  resourceRows,
  curvePoints,
  periods,
  currency,
  currencyDecimals,
  dateFormat,
}: {
  activeView: ActiveView;
  overviewLines: WorkScheduleLineRecord[];
  valuationRows: WorkScheduleValuationCalendarRow[];
  resourceRows: WorkScheduleResourceCalendarRow[];
  curvePoints: WorkScheduleCurvePointRecord[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
  dateFormat: string;
}) {
  if (activeView === "overview") {
    const headers = ["Item", "Partida", "Duracion", "Inicio", "Fin", "Predecesora", "Cuadrilla", "Unidad", "Metrado", "PU", "Parcial"];
    const rows = overviewLines.map((line) => [
      line.itemCode,
      line.description,
      line.durationDays != null ? String(line.durationDays) : "-",
      line.startDate ? formatDate(line.startDate, dateFormat as never) : "Pendiente",
      line.endDate ? formatDate(line.endDate, dateFormat as never) : "Pendiente",
      line.predecessor || "-",
      line.crew != null ? formatNumber(line.crew, 2) : "-",
      line.unit,
      formatNumber(line.quantity, 2),
      formatCurrency(line.unitPrice, currency, currencyDecimals),
      formatCurrency(line.partial, currency, currencyDecimals),
    ]);

    return {
      fileName: "work-schedule-cronograma.csv",
      content: buildCsvContent(headers, rows),
    };
  }

  if (activeView === "valuation") {
    const headers = ["Item", "Partida", "Unidad", "Metrado", "PU", "Parcial", ...periods.map((period) => formatPeriodLabel(period))];
    const rows = valuationRows.map((row) => [
      row.itemCode,
      row.description,
      row.unit,
      formatNumber(row.quantity, 2),
      formatCurrency(row.unitPrice, currency, currencyDecimals),
      formatCurrency(row.partial, currency, currencyDecimals),
      ...periods.map((period) => formatCurrency(row.periodAmounts[period.key] ?? 0, currency, currencyDecimals)),
    ]);

    return {
      fileName: "work-schedule-calendario-valorizado.csv",
      content: buildCsvContent(headers, rows),
    };
  }

  if (activeView === "resources") {
    const periodHeaders = periods.flatMap((period) => [`${formatPeriodLabel(period)} Cantidad`, `${formatPeriodLabel(period)} Monto`]);
    const headers = ["Item", "Insumo", "Unidad", "Cantidad", "PU", "Parcial", ...periodHeaders];
    const rows = resourceRows.map((row, index) => [
      String(index + 1),
      row.description,
      row.unit,
      formatNumber(row.quantity, 2),
      formatCurrency(row.unitPrice, currency, currencyDecimals),
      formatCurrency(row.partial, currency, currencyDecimals),
      ...periods.flatMap((period) => [
        formatNumber(row.periodQuantities[period.key] ?? 0, 2),
        formatCurrency(row.periodAmounts[period.key] ?? 0, currency, currencyDecimals),
      ]),
    ]);

    return {
      fileName: "work-schedule-calendario-insumos.csv",
      content: buildCsvContent(headers, rows),
    };
  }

  const headers = ["Periodo", "Programado mensual", "Acumulado", "% acumulado"];
  const rows = curvePoints.map((point) => [
    formatPeriodLabel(point),
    formatCurrency(point.monthlyAmount, currency, currencyDecimals),
    formatCurrency(point.accumulatedAmount, currency, currencyDecimals),
    `${formatNumber(point.accumulatedPercentage, 2)}%`,
  ]);

  return {
    fileName: "work-schedule-curva-s.csv",
    content: buildCsvContent(headers, rows),
  };
}

function buildWorkScheduleValuationWorkbookTableData({
  valuationRows,
  periods,
  currency,
  currencyDecimals,
  scope,
}: {
  valuationRows: WorkScheduleValuationCalendarRow[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
  scope: WorkbookExportScope;
}): WorkbookTableData {
  const currencyFormat = createWorkbookCurrencyNumberFormat(currency, currencyDecimals);
  const decimalFormat = buildWorkbookDecimalFormat(2);
  const rows: WorkbookCell[][] = [];
  const subtotalRowIndexes: number[] = [];
  let currentSubBudgetName = "";
  let currentGroupRows: WorkScheduleValuationCalendarRow[] = [];

  function pushCurrentGroupSubtotal() {
    if (currentGroupRows.length === 0) {
      return;
    }

    rows.push([
      { value: "" },
      { value: `Subtotal ${currentSubBudgetName}` },
      { value: "" },
      { value: currentGroupRows.reduce((sum, row) => sum + row.quantity, 0), numFmt: decimalFormat },
      { value: "" },
      { value: currentGroupRows.reduce((sum, row) => sum + row.partial, 0), numFmt: currencyFormat },
      ...periods.map((period) => ({
        value: currentGroupRows.reduce((sum, row) => sum + (row.periodAmounts[period.key] ?? 0), 0),
        numFmt: currencyFormat,
      })),
    ]);
    subtotalRowIndexes.push(rows.length - 1);
  }

  for (const row of valuationRows) {
    if (scope === "detail_subtotals_and_total" && currentGroupRows.length > 0 && row.subBudgetName !== currentSubBudgetName) {
      pushCurrentGroupSubtotal();
      currentGroupRows = [];
    }

    currentSubBudgetName = row.subBudgetName;
    currentGroupRows.push(row);
    rows.push([
      { value: row.itemCode },
      { value: row.description },
      { value: row.unit },
      { value: row.quantity, numFmt: decimalFormat },
      { value: row.unitPrice, numFmt: currencyFormat },
      { value: row.partial, numFmt: currencyFormat },
      ...periods.map((period) => ({ value: row.periodAmounts[period.key] ?? 0, numFmt: currencyFormat })),
    ]);
  }

  if (scope === "detail_subtotals_and_total") {
    pushCurrentGroupSubtotal();
  }

  return {
    headers: ["Item", "Partida", "Unidad", "Metrado", "PU", "Parcial", ...periods.map((period) => formatPeriodLabel(period))],
    rows,
    subtotalRowIndexes: scope === "detail_subtotals_and_total" ? subtotalRowIndexes : [],
    totalRow:
      scope === "detail_only"
        ? undefined
        : [
            { value: "" },
            { value: "Total" },
            { value: "" },
            { value: valuationRows.reduce((sum, row) => sum + row.quantity, 0), numFmt: decimalFormat },
            { value: "" },
            { value: valuationRows.reduce((sum, row) => sum + row.partial, 0), numFmt: currencyFormat },
            ...periods.map((period) => ({
              value: valuationRows.reduce((sum, row) => sum + (row.periodAmounts[period.key] ?? 0), 0),
              numFmt: currencyFormat,
            })),
          ],
  };
}

function buildWorkScheduleResourceWorkbookTableData({
  resourceRows,
  periods,
  currency,
  currencyDecimals,
  scope,
}: {
  resourceRows: WorkScheduleResourceCalendarRow[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
  scope: WorkbookExportScope;
}): WorkbookTableData {
  const currencyFormat = createWorkbookCurrencyNumberFormat(currency, currencyDecimals);
  const decimalFormat = buildWorkbookDecimalFormat(2);
  const rows: WorkbookCell[][] = [];
  const subtotalRowIndexes: number[] = [];
  let currentFamilyCode = "";
  let currentGroupRows: WorkScheduleResourceCalendarRow[] = [];

  function pushCurrentFamilySubtotal() {
    if (currentGroupRows.length === 0) {
      return;
    }

    rows.push([
      { value: "" },
      { value: `Subtotal ${currentFamilyCode}` },
      { value: "" },
      { value: currentGroupRows.reduce((sum, row) => sum + row.quantity, 0), numFmt: decimalFormat },
      { value: "" },
      { value: currentGroupRows.reduce((sum, row) => sum + row.partial, 0), numFmt: currencyFormat },
      ...periods.flatMap((period) => [
        {
          value: currentGroupRows.reduce((sum, row) => sum + (row.periodQuantities[period.key] ?? 0), 0),
          numFmt: decimalFormat,
        },
        {
          value: currentGroupRows.reduce((sum, row) => sum + (row.periodAmounts[period.key] ?? 0), 0),
          numFmt: currencyFormat,
        },
      ]),
    ]);
    subtotalRowIndexes.push(rows.length - 1);
  }

  for (const [index, row] of resourceRows.entries()) {
    const familyCode = scope === "detail_subtotals_and_total" ? getResourceWorkbookFamilyCode(row.code) : "Sin subtotales";
    if (scope === "detail_subtotals_and_total" && currentGroupRows.length > 0 && familyCode !== currentFamilyCode) {
      pushCurrentFamilySubtotal();
      currentGroupRows = [];
    }

    currentFamilyCode = familyCode;
    currentGroupRows.push(row);
    rows.push([
      { value: index + 1 },
      { value: row.description },
      { value: row.unit },
      { value: row.quantity, numFmt: decimalFormat },
      { value: row.unitPrice, numFmt: currencyFormat },
      { value: row.partial, numFmt: currencyFormat },
      ...periods.flatMap((period) => [
        { value: row.periodQuantities[period.key] ?? 0, numFmt: decimalFormat },
        { value: row.periodAmounts[period.key] ?? 0, numFmt: currencyFormat },
      ]),
    ]);
  }

  if (scope === "detail_subtotals_and_total") {
    pushCurrentFamilySubtotal();
  }

  return {
    headers: ["Item", "Insumo", "Unidad", "Cantidad", "PU", "Parcial", ...periods.flatMap((period) => [`${formatPeriodLabel(period)} Cantidad`, `${formatPeriodLabel(period)} Monto`])],
    rows,
    subtotalRowIndexes: scope === "detail_subtotals_and_total" ? subtotalRowIndexes : [],
    totalRow:
      scope === "detail_only"
        ? undefined
        : [
            { value: "" },
            { value: "Total" },
            { value: "" },
            { value: resourceRows.reduce((sum, row) => sum + row.quantity, 0), numFmt: decimalFormat },
            { value: "" },
            { value: resourceRows.reduce((sum, row) => sum + row.partial, 0), numFmt: currencyFormat },
            ...periods.flatMap((period) => [
              {
                value: resourceRows.reduce((sum, row) => sum + (row.periodQuantities[period.key] ?? 0), 0),
                numFmt: decimalFormat,
              },
              {
                value: resourceRows.reduce((sum, row) => sum + (row.periodAmounts[period.key] ?? 0), 0),
                numFmt: currencyFormat,
              },
            ]),
          ],
  };
}

function buildWorkScheduleCurveWorkbookTableData({
  curvePoints,
  currency,
  currencyDecimals,
  scope,
}: {
  curvePoints: WorkScheduleCurvePointRecord[];
  currency: string;
  currencyDecimals: number;
  scope: WorkbookExportScope;
}): WorkbookTableData {
  const currencyFormat = createWorkbookCurrencyNumberFormat(currency, currencyDecimals);
  const percentageFormat = "0.00%";

  return {
    headers: ["Periodo", "Programado mensual", "Acumulado", "% acumulado"],
    rows: curvePoints.map((point) => [
      { value: formatPeriodLabel(point) },
      { value: point.monthlyAmount, numFmt: currencyFormat },
      { value: point.accumulatedAmount, numFmt: currencyFormat },
      { value: point.accumulatedPercentage / 100, numFmt: percentageFormat },
    ]),
    totalRow:
      scope === "detail_only"
        ? undefined
        : [
            { value: "Total" },
            { value: curvePoints.reduce((sum, point) => sum + point.monthlyAmount, 0), numFmt: currencyFormat },
            { value: curvePoints.at(-1)?.accumulatedAmount ?? 0, numFmt: currencyFormat },
            { value: (curvePoints.at(-1)?.accumulatedPercentage ?? 0) / 100, numFmt: percentageFormat },
          ],
  };
}

export function buildWorkScheduleOverviewSummaryCsvExport({
  overviewLines,
  currency,
  currencyDecimals,
  dateFormat,
}: {
  overviewLines: WorkScheduleLineRecord[];
  currency: string;
  currencyDecimals: number;
  dateFormat: string;
}) {
  const tableData = buildWorkScheduleOverviewSummaryTableData({
    overviewLines,
    currency,
    currencyDecimals,
    dateFormat,
  });

  return {
    fileName: "work-schedule-cronograma-resumen.csv",
    content: buildCsvContent(tableData.headers, tableData.rows),
  };
}

function buildWorkScheduleOverviewWorkbookTableData({
  overviewLines,
  currency,
  currencyDecimals,
  dateFormat,
}: {
  overviewLines: WorkScheduleLineRecord[];
  currency: string;
  currencyDecimals: number;
  dateFormat: string;
}): WorkbookTableData {
  const currencyFormat = createWorkbookCurrencyNumberFormat(currency, currencyDecimals);
  const decimalFormat = buildWorkbookDecimalFormat(2);
  const rows: WorkbookCell[][] = [];
  const subtotalRowIndexes: number[] = [];
  let currentSubBudgetId = "";
  let currentSubBudgetName = "";
  let currentGroupLines: WorkScheduleLineRecord[] = [];

  function pushCurrentGroupSubtotal() {
    if (currentGroupLines.length === 0) {
      return;
    }

    rows.push([
      { value: "" },
      { value: `Subtotal ${currentSubBudgetName}` },
      { value: "" },
      { value: "" },
      { value: "" },
      { value: "" },
      { value: "" },
      { value: "" },
      { value: currentGroupLines.reduce((sum, line) => sum + line.quantity, 0), numFmt: decimalFormat },
      { value: "" },
      { value: currentGroupLines.reduce((sum, line) => sum + line.partial, 0), numFmt: currencyFormat },
    ]);
    subtotalRowIndexes.push(rows.length - 1);
  }

  for (const line of overviewLines) {
    if (currentGroupLines.length > 0 && line.subBudgetId !== currentSubBudgetId) {
      pushCurrentGroupSubtotal();
      currentGroupLines = [];
    }

    currentSubBudgetId = line.subBudgetId;
    currentSubBudgetName = line.subBudgetName;
    currentGroupLines.push(line);
    rows.push([
      { value: line.itemCode },
      { value: line.description },
      { value: line.durationDays ?? "-" },
      { value: line.startDate ? formatDate(line.startDate, dateFormat as never) : "Pendiente" },
      { value: line.endDate ? formatDate(line.endDate, dateFormat as never) : "Pendiente" },
      { value: line.predecessor || "-" },
      { value: line.crew ?? "-" },
      { value: line.unit },
      { value: line.quantity, numFmt: decimalFormat },
      { value: line.unitPrice, numFmt: currencyFormat },
      { value: line.partial, numFmt: currencyFormat },
    ]);
  }

  pushCurrentGroupSubtotal();

  return {
    headers: ["Item", "Partida", "Duracion", "Inicio", "Fin", "Predecesora", "Cuadrilla", "Unidad", "Metrado", "PU", "Parcial"],
    rows,
    subtotalRowIndexes,
    totalRow: [
      { value: "" },
      { value: "Total" },
      { value: "" },
      { value: "" },
      { value: "" },
      { value: "" },
      { value: "" },
      { value: "" },
      { value: overviewLines.reduce((sum, line) => sum + line.quantity, 0), numFmt: decimalFormat },
      { value: "" },
      { value: overviewLines.reduce((sum, line) => sum + line.partial, 0), numFmt: currencyFormat },
    ],
  };
}

export function buildWorkScheduleOverviewMonthlySummaryCsvExport({
  valuationRows,
  periods,
  currency,
  currencyDecimals,
}: {
  valuationRows: WorkScheduleValuationCalendarRow[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
}) {
  const tableData = buildWorkScheduleOverviewMonthlySummaryTableData({
    valuationRows,
    periods,
    currency,
    currencyDecimals,
  });

  return {
    fileName: "work-schedule-cronograma-resumen-mensual.csv",
    content: buildCsvContent(tableData.headers, tableData.rows),
  };
}

export function buildWorkScheduleOverviewExecutivePackageCsvExport({
  overviewLines,
  valuationRows,
  periods,
  currency,
  currencyDecimals,
  dateFormat,
}: {
  overviewLines: WorkScheduleLineRecord[];
  valuationRows: WorkScheduleValuationCalendarRow[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
  dateFormat: string;
}) {
  const summaryExport = buildWorkScheduleOverviewSummaryCsvExport({
    overviewLines,
    currency,
    currencyDecimals,
    dateFormat,
  });
  const monthlySummaryExport = buildWorkScheduleOverviewMonthlySummaryCsvExport({
    valuationRows,
    periods,
    currency,
    currencyDecimals,
  });

  const content = [
    "Paquete ejecutivo - Resumen por subpresupuesto",
    summaryExport.content,
    "",
    "Paquete ejecutivo - Resumen mensual",
    monthlySummaryExport.content,
  ].join("\n");

  return {
    fileName: "work-schedule-cronograma-paquete-ejecutivo.csv",
    content,
  };
}

export function buildWorkScheduleOverviewSummaryTableData({
  overviewLines,
  currency,
  currencyDecimals,
  dateFormat,
}: {
  overviewLines: WorkScheduleLineRecord[];
  currency: string;
  currencyDecimals: number;
  dateFormat: string;
}) {
  const groupedLines = new Map<
    string,
    {
      subBudgetName: string;
      lines: WorkScheduleLineRecord[];
    }
  >();

  for (const line of overviewLines) {
    const currentGroup = groupedLines.get(line.subBudgetId);
    if (currentGroup) {
      currentGroup.lines.push(line);
      continue;
    }

    groupedLines.set(line.subBudgetId, {
      subBudgetName: line.subBudgetName,
      lines: [line],
    });
  }

  const headers = ["Subpresupuesto", "Partidas", "Programadas", "Pendientes", "Distribucion incompleta", "Inicio", "Fin", "Total parcial"];
  const rows = [...groupedLines.values()].map((group) => {
    const groupStartDates = group.lines
      .map((line) => line.startDate)
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .sort();
    const groupEndDates = group.lines
      .map((line) => line.endDate)
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .sort();
    const totalPartial = group.lines.reduce((accumulator, line) => accumulator + line.partial, 0);

    return [
      group.subBudgetName,
      String(group.lines.length),
      String(group.lines.filter(isFullyScheduledWorkScheduleLine).length),
      String(group.lines.filter(isPendingWorkScheduleLine).length),
      String(group.lines.filter(hasIncompleteDistribution).length),
      groupStartDates[0] ? formatDate(groupStartDates[0], dateFormat as never) : "-",
      groupEndDates.at(-1) ? formatDate(groupEndDates.at(-1) as string, dateFormat as never) : "-",
      formatCurrency(totalPartial, currency, currencyDecimals),
    ];
  });

  return { headers, rows };
}

function buildWorkScheduleOverviewSummaryWorkbookTableData({
  overviewLines,
  currency,
  currencyDecimals,
  dateFormat,
}: {
  overviewLines: WorkScheduleLineRecord[];
  currency: string;
  currencyDecimals: number;
  dateFormat: string;
}): WorkbookTableData {
  const groupedLines = new Map<
    string,
    {
      subBudgetName: string;
      lines: WorkScheduleLineRecord[];
    }
  >();
  const currencyFormat = createWorkbookCurrencyNumberFormat(currency, currencyDecimals);

  for (const line of overviewLines) {
    const currentGroup = groupedLines.get(line.subBudgetId);
    if (currentGroup) {
      currentGroup.lines.push(line);
      continue;
    }

    groupedLines.set(line.subBudgetId, {
      subBudgetName: line.subBudgetName,
      lines: [line],
    });
  }

  return {
    headers: ["Subpresupuesto", "Partidas", "Programadas", "Pendientes", "Distribucion incompleta", "Inicio", "Fin", "Total parcial"],
    rows: [...groupedLines.values()].map((group) => {
      const groupStartDates = group.lines
        .map((line) => line.startDate)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .sort();
      const groupEndDates = group.lines
        .map((line) => line.endDate)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .sort();
      const totalPartial = group.lines.reduce((accumulator, line) => accumulator + line.partial, 0);

      return [
        { value: group.subBudgetName },
        { value: group.lines.length },
        { value: group.lines.filter(isFullyScheduledWorkScheduleLine).length },
        { value: group.lines.filter(isPendingWorkScheduleLine).length },
        { value: group.lines.filter(hasIncompleteDistribution).length },
        { value: groupStartDates[0] ? formatDate(groupStartDates[0], dateFormat as never) : "-" },
        { value: groupEndDates.at(-1) ? formatDate(groupEndDates.at(-1) as string, dateFormat as never) : "-" },
        { value: totalPartial, numFmt: currencyFormat },
      ];
    }),
    totalRow: [
      { value: "Total" },
      { value: [...groupedLines.values()].reduce((sum, group) => sum + group.lines.length, 0) },
      { value: [...groupedLines.values()].reduce((sum, group) => sum + group.lines.filter(isFullyScheduledWorkScheduleLine).length, 0) },
      { value: [...groupedLines.values()].reduce((sum, group) => sum + group.lines.filter(isPendingWorkScheduleLine).length, 0) },
      { value: [...groupedLines.values()].reduce((sum, group) => sum + group.lines.filter(hasIncompleteDistribution).length, 0) },
      { value: "" },
      { value: "" },
      { value: [...groupedLines.values()].reduce((sum, group) => sum + group.lines.reduce((subtotal, line) => subtotal + line.partial, 0), 0), numFmt: currencyFormat },
    ],
  };
}

function buildWorkScheduleOverviewMonthlySummaryTableData({
  valuationRows,
  periods,
  currency,
  currencyDecimals,
}: {
  valuationRows: WorkScheduleValuationCalendarRow[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
}) {
  const totalAmount = periods.reduce(
    (accumulator, period) =>
      accumulator +
      valuationRows.reduce((periodAccumulator, row) => periodAccumulator + (row.periodAmounts[period.key] ?? 0), 0),
    0,
  );

  let accumulatedAmount = 0;
  const headers = ["Periodo", "Partidas con monto", "Programado mensual", "Acumulado", "% acumulado"];
  const rows = periods.map((period) => {
    const monthlyRows = valuationRows.filter((row) => (row.periodAmounts[period.key] ?? 0) > 0);
    const monthlyAmount = monthlyRows.reduce((accumulator, row) => accumulator + (row.periodAmounts[period.key] ?? 0), 0);
    accumulatedAmount += monthlyAmount;

    return [
      formatPeriodLabel(period),
      String(monthlyRows.length),
      formatCurrency(monthlyAmount, currency, currencyDecimals),
      formatCurrency(accumulatedAmount, currency, currencyDecimals),
      `${formatNumber(totalAmount > 0 ? (accumulatedAmount / totalAmount) * 100 : 0, 2)}%`,
    ];
  });

  return { headers, rows };
}

function buildWorkScheduleOverviewMonthlySummaryWorkbookTableData({
  valuationRows,
  periods,
  currency,
  currencyDecimals,
}: {
  valuationRows: WorkScheduleValuationCalendarRow[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
}): WorkbookTableData {
  const totalAmount = periods.reduce(
    (accumulator, period) =>
      accumulator +
      valuationRows.reduce((periodAccumulator, row) => periodAccumulator + (row.periodAmounts[period.key] ?? 0), 0),
    0,
  );
  const currencyFormat = createWorkbookCurrencyNumberFormat(currency, currencyDecimals);
  const percentageFormat = "0.00%";
  let accumulatedAmount = 0;

  return {
    headers: ["Periodo", "Partidas con monto", "Programado mensual", "Acumulado", "% acumulado"],
    rows: periods.map((period) => {
      const monthlyRows = valuationRows.filter((row) => (row.periodAmounts[period.key] ?? 0) > 0);
      const monthlyAmount = monthlyRows.reduce((accumulator, row) => accumulator + (row.periodAmounts[period.key] ?? 0), 0);
      accumulatedAmount += monthlyAmount;

      return [
        { value: formatPeriodLabel(period) },
        { value: monthlyRows.length },
        { value: monthlyAmount, numFmt: currencyFormat },
        { value: accumulatedAmount, numFmt: currencyFormat },
        { value: totalAmount > 0 ? accumulatedAmount / totalAmount : 0, numFmt: percentageFormat },
      ];
    }),
    totalRow: [
      { value: "Total" },
      { value: periods.reduce((sum, period) => sum + valuationRows.filter((row) => (row.periodAmounts[period.key] ?? 0) > 0).length, 0) },
      { value: totalAmount, numFmt: currencyFormat },
      { value: accumulatedAmount, numFmt: currencyFormat },
      { value: totalAmount > 0 ? accumulatedAmount / totalAmount : 0, numFmt: percentageFormat },
    ],
  };
}

export async function buildWorkScheduleOverviewExecutivePackageWorkbook({
  overviewLines,
  valuationRows,
  periods,
  currency,
  currencyDecimals,
  dateFormat,
  scope,
}: {
  overviewLines: WorkScheduleLineRecord[];
  valuationRows: WorkScheduleValuationCalendarRow[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
  dateFormat: string;
  scope: WorkbookExportScope;
}) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MC Presupuestos";
  const summaryTable = buildWorkScheduleOverviewSummaryWorkbookTableData({
    overviewLines,
    currency,
    currencyDecimals,
    dateFormat,
  });
  const monthlyTable = buildWorkScheduleOverviewMonthlySummaryWorkbookTableData({
    valuationRows,
    periods,
    currency,
    currencyDecimals,
  });
  const overviewTable = buildWorkScheduleOverviewWorkbookTableData({
    overviewLines,
    currency,
    currencyDecimals,
    dateFormat,
  });
  const scopedSummaryTable = {
    ...summaryTable,
    totalRow: scope === "detail_only" ? undefined : summaryTable.totalRow,
  };
  const scopedMonthlyTable = {
    ...monthlyTable,
    totalRow: scope === "detail_only" ? undefined : monthlyTable.totalRow,
  };
  const scopedOverviewTable = {
    ...overviewTable,
    subtotalRowIndexes: scope === "detail_subtotals_and_total" ? overviewTable.subtotalRowIndexes : [],
    totalRow: scope === "detail_only" ? undefined : overviewTable.totalRow,
  };

  appendWorkbookSheet(workbook, {
    sheetName: "Resumen subpresupuesto",
    title: "PROGRAMACION DE OBRA - RESUMEN POR SUBPRESUPUESTO",
    subtitle: "Vista ejecutiva consolidada por subpresupuesto sobre las partidas visibles y filtradas.",
    headers: scopedSummaryTable.headers,
    rows: scopedSummaryTable.rows,
    totalRow: scopedSummaryTable.totalRow,
  });
  appendWorkbookSheet(workbook, {
    sheetName: "Resumen mensual",
    title: "PROGRAMACION DE OBRA - RESUMEN MENSUAL",
    subtitle: "Programado mensual y acumulado derivado de la valorizacion filtrada.",
    headers: scopedMonthlyTable.headers,
    rows: scopedMonthlyTable.rows,
    totalRow: scopedMonthlyTable.totalRow,
  });
  appendWorkbookSheet(workbook, {
    sheetName: "Cronograma partidas",
    title: "PROGRAMACION DE OBRA - CRONOGRAMA DE PARTIDAS",
    subtitle: "Detalle resumido de partidas programadas visibles en el cronograma.",
    headers: scopedOverviewTable.headers,
    rows: scopedOverviewTable.rows,
    subtotalRowIndexes: scopedOverviewTable.subtotalRowIndexes,
    totalRow: scopedOverviewTable.totalRow,
  });

  return workbook.xlsx.writeBuffer();
}

export async function buildWorkScheduleActiveViewWorkbook({
  activeView,
  valuationRows,
  resourceRows,
  curvePoints,
  periods,
  currency,
  currencyDecimals,
  curveWorkbookScope,
  valuationWorkbookScope,
  resourceWorkbookScope,
}: {
  activeView: ActiveView;
  valuationRows: WorkScheduleValuationCalendarRow[];
  resourceRows: WorkScheduleResourceCalendarRow[];
  curvePoints: WorkScheduleCurvePointRecord[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
  curveWorkbookScope: WorkbookExportScope;
  valuationWorkbookScope: WorkbookExportScope;
  resourceWorkbookScope: WorkbookExportScope;
}) {
  if (activeView === "overview") {
    return null;
  }

  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MC Presupuestos";

  if (activeView === "valuation") {
    const tableData = buildWorkScheduleValuationWorkbookTableData({
      valuationRows,
      periods,
      currency,
      currencyDecimals,
      scope: valuationWorkbookScope,
    });

    appendWorkbookSheet(workbook, {
      sheetName: "Calendario valorizado",
      title: "PROGRAMACION DE OBRA - CALENDARIO VALORIZADO",
      subtitle: "Vista valorizada por partida sobre el conjunto filtrado y visible.",
      headers: tableData.headers,
      rows: tableData.rows,
      totalRow: tableData.totalRow,
    });

    return {
      fileName: "work-schedule-calendario-valorizado.xlsx",
      content: await workbook.xlsx.writeBuffer(),
    };
  }

  if (activeView === "resources") {
    const tableData = buildWorkScheduleResourceWorkbookTableData({
      resourceRows,
      periods,
      currency,
      currencyDecimals,
      scope: resourceWorkbookScope,
    });

    appendWorkbookSheet(workbook, {
      sheetName: "Calendario de insumos",
      title: "PROGRAMACION DE OBRA - CALENDARIO DE INSUMOS",
      subtitle: "Consumo y monto por periodo para los insumos derivados de las partidas filtradas.",
      headers: tableData.headers,
      rows: tableData.rows,
      totalRow: tableData.totalRow,
    });

    return {
      fileName: "work-schedule-calendario-insumos.xlsx",
      content: await workbook.xlsx.writeBuffer(),
    };
  }

  const tableData = buildWorkScheduleCurveWorkbookTableData({
    curvePoints,
    currency,
    currencyDecimals,
    scope: curveWorkbookScope,
  });

  appendWorkbookSheet(workbook, {
    sheetName: "Curva S",
    title: "PROGRAMACION DE OBRA - CURVA S",
    subtitle: "Serie programada mensual y acumulada para el conjunto filtrado.",
    headers: tableData.headers,
    rows: tableData.rows,
    totalRow: tableData.totalRow,
  });

  return {
    fileName: "work-schedule-curva-s.xlsx",
    content: await workbook.xlsx.writeBuffer(),
  };
}

function appendWorkbookSheet(
  workbook: ExcelJS.Workbook,
  {
    sheetName,
    title,
    subtitle,
    headers,
    rows,
    subtotalRowIndexes,
    totalRow,
  }: {
    sheetName: string;
    title: string;
    subtitle: string;
    headers: string[];
    rows: WorkbookCell[][];
    subtotalRowIndexes?: number[];
    totalRow?: WorkbookCell[];
  },
) {
  const worksheet = workbook.addWorksheet(sheetName);
  const lastColumnLetter = getExcelColumnLetter(headers.length);
  worksheet.mergeCells(`A1:${lastColumnLetter}1`);
  worksheet.mergeCells(`A2:${lastColumnLetter}2`);
  worksheet.getCell("A1").value = title;
  worksheet.getCell("A1").font = { bold: true, size: 15, color: { argb: "FF0F172A" } };
  worksheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getCell("A2").value = subtitle;
  worksheet.getCell("A2").font = { size: 11, color: { argb: "FF475569" } };
  worksheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  worksheet.addRow(headers);
  for (const row of rows) {
    const worksheetRow = worksheet.addRow(row.map((cell) => cell.value));
    row.forEach((cell, index) => {
      if (cell.numFmt) {
        worksheetRow.getCell(index + 1).numFmt = cell.numFmt;
      }
    });
  }

  const worksheetTotalRow = totalRow ? worksheet.addRow(totalRow.map((cell) => cell.value)) : null;
  if (worksheetTotalRow && totalRow) {
    totalRow.forEach((cell, index) => {
      if (cell.numFmt) {
        worksheetTotalRow.getCell(index + 1).numFmt = cell.numFmt;
      }
    });
  }

  worksheet.getRow(3).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getRow(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  worksheet.getRow(3).alignment = { horizontal: "center", vertical: "middle" };
  worksheet.views = [{ state: "frozen", ySplit: 3 }];
  worksheet.autoFilter = `A3:${lastColumnLetter}3`;
  worksheet.columns = headers.map((header, columnIndex) => ({
    width: Math.max(header.length + 4, ...rows.map((row) => getWorkbookCellDisplayWidth(row[columnIndex])), 14),
  }));
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  });

  const firstDataRowNumber = 4;
  const lastDataRowNumber = firstDataRowNumber + rows.length - 1;
  for (let rowNumber = firstDataRowNumber; rowNumber <= lastDataRowNumber; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    if ((rowNumber - firstDataRowNumber) % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      });
    }
  }

  const subtotalRowNumbers = new Set((subtotalRowIndexes ?? []).map((index) => firstDataRowNumber + index));
  for (const rowNumber of subtotalRowNumbers) {
    const row = worksheet.getRow(rowNumber);
    row.font = { bold: true, color: { argb: "FF0F172A" } };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F2FE" } };
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FF0EA5E9" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  }

  if (worksheetTotalRow) {
    worksheetTotalRow.font = { bold: true, color: { argb: "FF0F172A" } };
    worksheetTotalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
    worksheetTotalRow.alignment = { vertical: "middle" };
    worksheetTotalRow.eachCell((cell) => {
      cell.border = {
        top: { style: "medium", color: { argb: "FF10B981" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  }
}

function buildWorkbookDecimalFormat(decimalPlaces: number) {
  if (decimalPlaces <= 0) {
    return "#,##0";
  }

  return `#,##0.${"0".repeat(decimalPlaces)}`;
}

function createWorkbookCurrencyNumberFormat(currency: string, decimalPlaces: number) {
  return `${resolveWorkbookCurrencySymbol(currency)} ${buildWorkbookDecimalFormat(decimalPlaces)}`;
}

function resolveWorkbookCurrencySymbol(currency: string) {
  if (currency === "USD") return "$";
  if (currency === "PEN") return "S/";
  if (currency === "EUR") return "EUR";
  return currency;
}

function buildCsvContent(headers: string[], rows: string[][]) {
  return [headers, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\n");
}

export function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(fileName, blob);
}

export function downloadBinaryFile(fileName: string, content: BlobPart, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(fileName, blob);
}

function downloadBlob(fileName: string, blob: Blob) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(objectUrl);
}


function getResourceWorkbookFamilyCode(resourceCode: string) {
  const [familyCode] = resourceCode.split("-");
  return familyCode?.trim() || "Sin grupo";
}

function getExcelColumnLetter(columnNumber: number) {
  let current = columnNumber;
  let result = "";

  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }

  return result;
}

function getWorkbookCellDisplayWidth(cell: WorkbookCell | undefined) {
  if (!cell) {
    return 14;
  }

  return String(cell.value).length + 2;
}

function escapeCsvValue(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}


export function formatTimelineRange(startDate: string | null, endDate: string | null, dateFormat: string) {
  if (!startDate || !endDate) {
    return "Pendiente";
  }

  return `${formatDate(startDate, dateFormat as never)} - ${formatDate(endDate, dateFormat as never)}`;
}
