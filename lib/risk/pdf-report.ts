import { createTablesPdf, type PdfCurveChartPoint, type PdfExportTable } from "@/lib/exports/pdf";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { RiskAnalysisPayload } from "@/types/risk";

export async function createRiskAnalysisPdf(payload: RiskAnalysisPayload, currencyDecimals: number) {
  if (!payload.latestRun) {
    throw new Error("No hay una simulacion vigente para exportar.");
  }

  const tables = buildRiskPdfTables(payload, currencyDecimals);

  return createTablesPdf(
    "Analisis de Riesgo Monte Carlo",
    tables,
    `${payload.budget.name} | ${payload.budget.currency}`,
    { layout: "landscape" },
  );
}

export function buildRiskPdfTables(payload: RiskAnalysisPayload, currencyDecimals: number): PdfExportTable[] {
  if (!payload.latestRun) {
    return [];
  }

  const { budget, items, latestRun, variables } = payload;
  const activeVariables = variables.filter((variable) => variable.enabled);
  const itemById = new Map(items.map((item) => [item.itemId, item]));
  const summaryRows = [
    ["Base presupuestada", formatCurrency(budget.baseTotal, budget.currency, currencyDecimals)],
    ["Promedio simulado", formatCurrency(latestRun.mean, budget.currency, currencyDecimals)],
    ["Mediana", formatCurrency(latestRun.median, budget.currency, currencyDecimals)],
    ["Desviacion estandar", formatCurrency(latestRun.standardDeviation, budget.currency, currencyDecimals)],
    ["Varianza", formatNumber(latestRun.variance, currencyDecimals)],
    ["Asimetria", formatNumber(latestRun.skewness, 4)],
    ["Curtosis", formatNumber(latestRun.kurtosis, 4)],
    ["Iteraciones", formatNumber(latestRun.iterations, 0)],
  ];

  const percentilesRows = [
    ["P10", formatCurrency(latestRun.p10, budget.currency, currencyDecimals), formatCurrency(latestRun.p10 - budget.baseTotal, budget.currency, currencyDecimals)],
    ["P50", formatCurrency(latestRun.p50, budget.currency, currencyDecimals), formatCurrency(latestRun.p50 - budget.baseTotal, budget.currency, currencyDecimals)],
    ["P80", formatCurrency(latestRun.p80, budget.currency, currencyDecimals), formatCurrency(latestRun.p80 - budget.baseTotal, budget.currency, currencyDecimals)],
    ["P90", formatCurrency(latestRun.p90, budget.currency, currencyDecimals), formatCurrency(latestRun.p90 - budget.baseTotal, budget.currency, currencyDecimals)],
    ["P95", formatCurrency(latestRun.p95, budget.currency, currencyDecimals), formatCurrency(latestRun.p95 - budget.baseTotal, budget.currency, currencyDecimals)],
  ];

  const variableRows = activeVariables.map((variable) => {
    const item = itemById.get(variable.budgetItemId);
    return [
      item?.code || "-",
      item?.description || "Partida no disponible",
      getVariableTypeLabel(variable.variableType),
      variable.distributionType,
      formatNumber(variable.minimum, 4),
      formatNumber(variable.mostLikely, 4),
      formatNumber(variable.maximum, 4),
    ];
  });

  const histogramRows = latestRun.histogramBins.map((bin) => [
    formatCurrency(bin.min, budget.currency, currencyDecimals),
    formatCurrency(bin.max, budget.currency, currencyDecimals),
    formatNumber(bin.frequency, 0),
    `${formatNumber(bin.probability * 100, 2)}%`,
  ]);
  const scheduleRows = latestRun.scheduleDuration
    ? buildScheduleDurationRows(latestRun.scheduleDuration)
    : [];
  const scheduleBufferRows = latestRun.scheduleDuration
    ? buildScheduleBufferRows(latestRun.scheduleDuration)
    : [];

  const tables: PdfExportTable[] = [
    {
      title: "Resumen ejecutivo",
      headers: ["Metrica", "Valor"],
      rows: summaryRows,
      columnWidths: [0.44, 0.56],
      emphasisRows: [0, 1, 2],
    },
    {
      title: "Curva S acumulada",
      headers: ["Curva S"],
      hideHeader: true,
      rows: [],
      chart: {
        kind: "curve",
        points: buildCurveChartPoints(payload),
      },
    },
    {
      title: "Percentiles y contingencia",
      headers: ["Percentil", "Costo", "Delta vs base"],
      rows: percentilesRows,
      columnWidths: [0.2, 0.4, 0.4],
    },
    {
      title: "Variables activas",
      headers: ["Codigo", "Partida", "Variable", "Distribucion", "Min", "Probable", "Max"],
      rows: variableRows.length > 0 ? variableRows : [["-", "Sin variables activas", "-", "-", "-", "-", "-"]],
      columnWidths: [0.1, 0.3, 0.14, 0.12, 0.11, 0.11, 0.12],
      startOnNewPage: true,
    },
    {
      title: "Histograma resumido",
      headers: ["Desde", "Hasta", "Frecuencia", "Probabilidad"],
      rows: histogramRows.length > 0 ? histogramRows : [["-", "-", "0", "0.00%"]],
      columnWidths: [0.24, 0.24, 0.2, 0.2],
    },
  ];

  if (scheduleRows.length > 0) {
    tables.push({
      title: "Contingencia de plazo",
      headers: ["Escenario", "Duracion", "Delta vs base", "Contingencia plazo"],
      rows: scheduleRows,
      columnWidths: [0.2, 0.24, 0.28, 0.28],
    });
  }

  if (scheduleBufferRows.length > 0) {
    tables.push({
      title: "Buffer recomendado de plazo",
      headers: ["Nivel", "Buffer", "Duracion objetivo"],
      rows: scheduleBufferRows,
      columnWidths: [0.28, 0.32, 0.32],
    });
  }

  return tables;
}

function buildCurveChartPoints(payload: RiskAnalysisPayload): PdfCurveChartPoint[] {
  const points = payload.latestRun?.sCurvePoints ?? [];

  return points.map((point, index) => ({
    label: `P${Math.round(point.cumulativeProbability * 100) || index + 1}`,
    monthlyAmount: point.cost,
    accumulatedAmount: point.cost,
    accumulatedPercentage: point.cumulativeProbability * 100,
  }));
}

function getVariableTypeLabel(variableType: RiskAnalysisPayload["variables"][number]["variableType"]) {
  if (variableType === "UNIT_PRICE") {
    return "Precio unitario";
  }

  if (variableType === "DURATION") {
    return "Duracion";
  }

  return "Cantidad";
}

function buildScheduleDurationRows(scheduleDuration: NonNullable<RiskAnalysisPayload["latestRun"]>["scheduleDuration"]): string[][] {
  if (!scheduleDuration) {
    return [];
  }

  const scenarios: Array<[string, number]> = [
    ["Media", scheduleDuration.meanDurationDays],
    ["P80", scheduleDuration.p80DurationDays],
    ["P90", scheduleDuration.p90DurationDays],
    ["P95", scheduleDuration.p95DurationDays],
  ];

  return scenarios.map(([label, duration]) => {
    const durationValue = Number(duration);
    const delta = durationValue - scheduleDuration.baseProjectDurationDays;
    const contingency =
      scheduleDuration.baseProjectDurationDays > 0 ? delta / scheduleDuration.baseProjectDurationDays : 0;

    return [
      label,
      `${formatNumber(durationValue, 1)} dias`,
      `${delta >= 0 ? "+" : ""}${formatNumber(delta, 1)} dias`,
      `${formatNumber(contingency * 100, 2)}%`,
    ];
  });
}

function buildScheduleBufferRows(scheduleDuration: NonNullable<RiskAnalysisPayload["latestRun"]>["scheduleDuration"]): string[][] {
  if (!scheduleDuration) {
    return [];
  }

  const scenarios: Array<[string, number]> = [
    ["P80", scheduleDuration.p80DurationDays],
    ["P95", scheduleDuration.p95DurationDays],
  ];

  return scenarios.map(([label, duration]) => {
    const durationValue = Number(duration);
    const bufferDays = Math.max(0, durationValue - scheduleDuration.baseProjectDurationDays);
    const bufferRatio =
      scheduleDuration.baseProjectDurationDays > 0 ? bufferDays / scheduleDuration.baseProjectDurationDays : 0;

    return [
      label === "P80" ? "Buffer recomendado" : "Buffer conservador",
      `${formatNumber(bufferDays, 1)} dias (${formatNumber(bufferRatio * 100, 2)}%)`,
      `${formatNumber(durationValue, 1)} dias`,
    ];
  });
}
