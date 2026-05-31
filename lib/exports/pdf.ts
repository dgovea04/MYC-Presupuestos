import PDFDocument from "pdfkit";
import { buildDisplayRows, levelTypeLabel } from "@/lib/budget/structure";
import type { BudgetRecord } from "@/types/budget";
import type { ReportResponsibleMeta } from "@/types/report-meta";
import { calculateBudgetRecord } from "@/lib/calculations/budget";
import { buildApprovalSecondaryLabel, buildBudgetCoverSummary, buildDocumentSignatureSummary, type DocumentSignatureProjectMeta } from "@/lib/exports/document-signature";
import { loadReportIdentityAssets, type ReportIdentityAssets } from "@/lib/exports/report-assets";

const MAX_CURRENCY_DECIMALS = 4;
const PDF_PAGE_MARGIN = 36;
const PDF_TABLE_WIDTH = 523;
const PDF_TABLE_HEADER_HEIGHT = 22;
const PDF_PAGE_CONTENT_BOTTOM = 730;
const APU_PARTIDA_GAP = 18;

type BudgetPdfTableRowInput = {
  code: string;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  partial: string;
  depth: number;
};

type ApuPdfTableRowInput = {
  resource: string;
  unit: string;
  crew: string;
  quantity: string;
  unitPrice: string;
  subtotal: string;
};

export type BudgetPdfTableCellLayout = {
  key: keyof Omit<BudgetPdfTableRowInput, "depth">;
  x: number;
  y: number;
  width: number;
  height: number;
  align?: "center" | "right";
};

export type ApuPdfTableCellLayout = {
  key: keyof ApuPdfTableRowInput;
  x: number;
  y: number;
  width: number;
  height: number;
  align?: "center" | "right";
};

export type ApuPdfPartidaBlockInput = {
  title: string;
  subtitle: string;
  rows: ApuPdfTableRowInput[];
};

export type PdfGanttChartRow = {
  label: string;
  group: string;
  startDate: string;
  endDate: string;
  durationDays?: number | null;
  isCritical?: boolean;
};

export type PdfCurveChartPoint = {
  label: string;
  monthlyAmount: number;
  accumulatedAmount: number;
  accumulatedPercentage: number;
};

export type PdfExportChart =
  | {
      kind: "gantt";
      rows: PdfGanttChartRow[];
    }
  | {
      kind: "curve";
      points: PdfCurveChartPoint[];
    };

export type PdfExportTable = {
  title: string;
  headers: string[];
  rows: string[][];
  chart?: PdfExportChart;
  columnWidths?: number[];
  fontSize?: number;
  headerFontSize?: number;
  hideHeader?: boolean;
  sectionRows?: number[];
  emphasisRows?: number[];
  startOnNewPage?: boolean;
};

type BudgetPdfTableColumn = {
  key: BudgetPdfTableCellLayout["key"];
  offset: number;
  width: number;
  align?: BudgetPdfTableCellLayout["align"];
};

type ApuPdfTableColumn = {
  key: ApuPdfTableCellLayout["key"];
  offset: number;
  width: number;
  align?: ApuPdfTableCellLayout["align"];
};

function normalizeDecimalPlaces(decimalPlaces: number) {
  if (!Number.isFinite(decimalPlaces)) {
    return 2;
  }

  const normalized = Math.trunc(decimalPlaces);
  if (normalized < 0 || normalized > MAX_CURRENCY_DECIMALS) {
    return 2;
  }

  return normalized;
}

export async function createBudgetPdf(
  budget: BudgetRecord,
  project?: DocumentSignatureProjectMeta,
  currencyDecimals = 2,
  responsible?: ReportResponsibleMeta,
) {
  const normalized = calculateBudgetRecord(budget);
  const rows = buildDisplayRows(normalized);
  const normalizedDecimals = normalizeDecimalPlaces(currencyDecimals);
  const doc = new PDFDocument({ size: "A4", margin: PDF_PAGE_MARGIN });
  const chunks: Buffer[] = [];
  const identityAssets = await loadReportIdentityAssets(responsible);

  doc.on("data", (chunk) => chunks.push(chunk));

  drawBudgetCoverPage(doc, normalized.name, normalized.currency, project, responsible, identityAssets);
  doc.addPage();

  doc.fillColor("#0f172a").fontSize(18).text("PRESUPUESTO DE OBRA", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(12).text(normalized.name, { align: "center" });
  doc.moveDown();

  for (const line of buildResponsibleMetaLines(project, responsible)) {
    drawHeaderMetaLine(doc, line.label, line.value);
  }
  drawHeaderMetaLine(doc, "Moneda", normalized.currency);
  doc.moveDown();

  drawBudgetTableHeader(doc);

  for (const row of rows) {
    if (row.kind === "level") {
      ensurePage(doc, 18);
      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(9);
      const y = doc.y;
      doc.text(row.level.code, PDF_PAGE_MARGIN + 6, y, { width: 49 });
      doc.text(`${levelTypeLabel[row.level.type]}: ${row.level.name}`, 96 + row.depth * 12, y, { width: 270 });
      doc.y = y + 12;
      doc.moveDown(0.5);
      doc.font("Helvetica");
      continue;
    }

    drawBudgetTableRow(doc, {
      code: row.item.code,
      description: row.item.description,
      unit: row.item.unit,
      quantity: row.item.quantity.toFixed(normalizedDecimals),
      unitPrice: row.item.unitPrice.toFixed(normalizedDecimals),
      partial: row.item.partial.toFixed(normalizedDecimals),
      depth: row.depth,
    });
  }

  doc.moveDown();
  const summaryX = PDF_PAGE_MARGIN + PDF_TABLE_WIDTH - 196;
  drawSummaryLine(doc, summaryX, "Costo directo", normalized.totals.totalDirectCost, false, normalizedDecimals);
  drawSummaryLine(doc, summaryX, "Gastos generales", normalized.totals.totalGeneralExpenses, false, normalizedDecimals);
  drawSummaryLine(doc, summaryX, "Utilidad", normalized.totals.totalUtility, false, normalizedDecimals);
  drawSummaryLine(doc, summaryX, "IGV", normalized.totals.totalTax, false, normalizedDecimals);
  drawSummaryLine(doc, summaryX, "TOTAL", normalized.totals.totalAmount, true, normalizedDecimals);
  drawDocumentSignatureBlock(doc, normalized.name, project, responsible, identityAssets);

  doc.end();

  await new Promise<void>((resolve) => doc.on("end", resolve));
  return Buffer.concat(chunks);
}

export async function createApuPdf(
  budget: BudgetRecord,
  project?: DocumentSignatureProjectMeta,
  currencyDecimals = 2,
  responsible?: ReportResponsibleMeta,
) {
  const normalized = calculateBudgetRecord(budget);
  const normalizedDecimals = normalizeDecimalPlaces(currencyDecimals);
  const doc = new PDFDocument({ size: "A4", margin: PDF_PAGE_MARGIN });
  const chunks: Buffer[] = [];
  const identityAssets = await loadReportIdentityAssets(responsible);

  doc.on("data", (chunk) => chunks.push(chunk));

  doc.fillColor("#0f172a").fontSize(18).text("ANALISIS DE COSTOS UNITARIOS", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(12).text(normalized.name, { align: "center" });
  doc.moveDown();

  for (const line of buildResponsibleMetaLines(project, responsible)) {
    drawHeaderMetaLine(doc, line.label, line.value);
  }
  doc.moveDown();

  for (const item of normalized.items) {
    if (!item.apu) continue;

    const resourceRows = item.apu.resources.map((resource) => ({
      crew: resource.crew != null ? String(resource.crew) : "",
      quantity: resource.quantity.toFixed(normalizedDecimals),
      resource: resource.resource?.description ?? resource.resourceType,
      subtotal: resource.subtotal.toFixed(normalizedDecimals),
      unit: resource.resource?.unit ?? "",
      unitPrice: resource.unitPrice.toFixed(normalizedDecimals),
    }));
    ensureApuPartidaStartsTogether(doc, {
      rows: resourceRows,
      subtitle: `Unidad: ${item.unit}  |  Precio unitario: ${item.unitPrice.toFixed(normalizedDecimals)}`,
      title: `${item.code} - ${item.description}`,
    });
    resetPdfCursor(doc);
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(10).text(`${item.code} - ${item.description}`, PDF_PAGE_MARGIN, doc.y, {
      width: PDF_TABLE_WIDTH,
    });
    resetPdfCursor(doc);
    doc.font("Helvetica").fontSize(8.5).fillColor("#475569").text(`Unidad: ${item.unit}  |  Precio unitario: ${item.unitPrice.toFixed(normalizedDecimals)}`, PDF_PAGE_MARGIN, doc.y, {
      width: PDF_TABLE_WIDTH,
    });
    doc.moveDown(0.4);
    drawApuTableHeader(doc);

    for (const resourceRow of resourceRows) {
      drawApuTableRow(doc, resourceRow);
    }

    doc.moveDown(0.5);
    drawSummaryLine(doc, PDF_PAGE_MARGIN + PDF_TABLE_WIDTH - 196, "Total unitario", item.unitPrice, true, normalizedDecimals);
    doc.y += APU_PARTIDA_GAP;
  }

  drawDocumentSignatureBlock(doc, normalized.name, project, responsible, identityAssets);

  doc.end();

  await new Promise<void>((resolve) => doc.on("end", resolve));
  return Buffer.concat(chunks);
}

export async function createTablesPdf(
  title: string,
  tables: PdfExportTable[],
  subtitle?: string,
  options: { layout?: "portrait" | "landscape" } = {},
) {
  const doc = new PDFDocument({ size: "A4", layout: options.layout ?? "portrait", margin: PDF_PAGE_MARGIN });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(chunk));
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(17).text(title, { align: "center" });
  if (subtitle) {
    doc.moveDown(0.25);
    doc.fillColor("#475569").font("Helvetica").fontSize(10).text(subtitle, { align: "center" });
  }
  doc.moveDown();

  for (const [tableIndex, table] of tables.entries()) {
    if (table.startOnNewPage && tableIndex > 0) {
      doc.addPage();
    } else if (tableIndex > 0) {
      doc.moveDown(0.8);
    }
    drawGenericTable(doc, table);
  }

  doc.end();
  await new Promise<void>((resolve) => doc.on("end", resolve));
  return Buffer.concat(chunks);
}

export function buildResponsibleMetaLines(
  project?: DocumentSignatureProjectMeta,
  responsible?: ReportResponsibleMeta,
) {
  const lines = [
    { label: "Proyecto", value: project?.name ?? "Sin proyecto" },
    { label: "Cliente", value: project?.clientName ?? "No definido" },
    { label: "Ubicacion", value: project?.location ?? "No definida" },
  ];

  if (responsible?.name) {
    lines.push({ label: "Responsable", value: responsible.name });
  }

  if (responsible?.jobTitle) {
    lines.push({ label: "Cargo", value: responsible.jobTitle });
  }

  if (responsible?.phone) {
    lines.push({ label: "Telefono", value: responsible.phone });
  }

  if (responsible?.companyName) {
    lines.push({ label: "Empresa", value: responsible.companyName });
  }

  return lines;
}

function drawHeaderMetaLine(doc: PDFKit.PDFDocument, label: string, value: string) {
  const x = doc.x;
  const y = doc.y;
  doc.fillColor("#334155").font("Helvetica-Bold").fontSize(10).text(`${label}: `, x, y, { continued: true });
  doc.font("Helvetica").text(value);
}

export function buildBudgetPdfTableRowLayout(
  row: BudgetPdfTableRowInput,
  startX: number,
  y: number,
  printableWidth: number,
): BudgetPdfTableCellLayout[] {
  const columns: BudgetPdfTableColumn[] = [
    { key: "code", offset: 6, width: 49 },
    { key: "description", offset: 60 + row.depth * 10, width: Math.max(160, printableWidth - 283 - row.depth * 10) },
    { key: "unit", offset: printableWidth - 192, width: 32, align: "center" },
    { key: "quantity", offset: printableWidth - 155, width: 48, align: "right" },
    { key: "unitPrice", offset: printableWidth - 102, width: 48, align: "right" },
    { key: "partial", offset: printableWidth - 55, width: 49, align: "right" },
  ];

  return columns.map((column) => ({
    align: column.align,
    height: estimatePdfCellHeight(String(row[column.key]), column.width),
    key: column.key,
    width: column.width,
    x: startX + column.offset,
    y,
  }));
}

export function buildApuPdfTableRowLayout(
  row: ApuPdfTableRowInput,
  startX: number,
  y: number,
  printableWidth: number,
): ApuPdfTableCellLayout[] {
  const columns: ApuPdfTableColumn[] = [
    { key: "resource", offset: 6, width: 205 },
    { key: "unit", offset: 218, width: 32, align: "center" },
    { key: "crew", offset: 255, width: 50, align: "right" },
    { key: "quantity", offset: 310, width: 58, align: "right" },
    { key: "unitPrice", offset: 373, width: 66, align: "right" },
    { key: "subtotal", offset: printableWidth - 78, width: 72, align: "right" },
  ];

  return columns.map((column) => ({
    align: column.align,
    height: estimatePdfCellHeight(String(row[column.key]), column.width),
    key: column.key,
    width: column.width,
    x: startX + column.offset,
    y,
  }));
}

export function estimateApuPdfPartidaBlockHeight(block: ApuPdfPartidaBlockInput) {
  const titleHeight = estimatePdfCellHeight(block.title, PDF_TABLE_WIDTH);
  const subtitleHeight = estimatePdfCellHeight(block.subtitle, PDF_TABLE_WIDTH);
  const rowsHeight = block.rows.reduce((total, row) => {
    const cells = buildApuPdfTableRowLayout(row, PDF_PAGE_MARGIN, 0, PDF_TABLE_WIDTH);
    return total + Math.max(12, ...cells.map((cell) => cell.height)) + 5;
  }, 0);

  return titleHeight + subtitleHeight + PDF_TABLE_HEADER_HEIGHT + rowsHeight + 58;
}

function estimatePdfCellHeight(value: string, width: number) {
  const charactersPerLine = Math.max(8, Math.floor(width / 4.5));
  return Math.max(10, Math.ceil(value.length / charactersPerLine) * 10);
}

function drawBudgetTableHeader(doc: PDFKit.PDFDocument) {
  doc.rect(PDF_PAGE_MARGIN, doc.y, PDF_TABLE_WIDTH, PDF_TABLE_HEADER_HEIGHT).fill("#0f172a");
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8.5);
  const y = doc.y + 7;
  doc.text("Codigo", 42, y, { width: 48 });
  doc.text("Descripcion", 98, y, { width: 243 });
  doc.text("Und.", 367, y, { width: 32, align: "center" });
  doc.text("Metrado", 402, y, { width: 50, align: "right" });
  doc.text("P.Unit", 455, y, { width: 50, align: "right" });
  doc.text("Parcial", 502, y, { width: 51, align: "right" });
  doc.y += PDF_TABLE_HEADER_HEIGHT + 8;
}

function drawBudgetTableRow(doc: PDFKit.PDFDocument, row: BudgetPdfTableRowInput) {
  doc.fillColor("#334155").font("Helvetica").fontSize(8);
  const y = doc.y;
  const cells = buildBudgetPdfTableRowLayout(row, PDF_PAGE_MARGIN, y, PDF_TABLE_WIDTH);
  const rowHeight = Math.max(
    12,
    ...cells.map((cell) => doc.heightOfString(String(row[cell.key]), { width: cell.width, align: cell.align })),
  );

  ensurePage(doc, rowHeight + 8);
  const rowY = doc.y;
  const visibleCells = buildBudgetPdfTableRowLayout(row, PDF_PAGE_MARGIN, rowY, PDF_TABLE_WIDTH);

  for (const cell of visibleCells) {
    doc.text(String(row[cell.key]), cell.x, rowY, {
      align: cell.align,
      height: rowHeight,
      width: cell.width,
    });
  }

  doc.y = rowY + rowHeight + 5;
}

function drawSummaryLine(
  doc: PDFKit.PDFDocument,
  x: number,
  label: string,
  value: number,
  strong = false,
  currencyDecimals = 2,
) {
  const y = doc.y;
  if (strong) {
    doc.rect(x, y - 2, 190, 18).fill("#0f172a");
    doc.fillColor("#ffffff").font("Helvetica-Bold");
  } else {
    doc.fillColor("#0f172a").font("Helvetica-Bold");
  }

  const textY = strong ? y + 3 : y;
  doc.text(label, x + 8, textY, { width: 90 });
  doc.text(value.toFixed(currencyDecimals), x + 95, textY, { width: 95, align: "right" });
  doc.moveDown(0.6);
  resetPdfCursor(doc);
  doc.fillColor("#334155").font("Helvetica");
}

function resetPdfCursor(doc: PDFKit.PDFDocument) {
  doc.x = doc.page.margins.left;
}

function drawGenericTable(doc: PDFKit.PDFDocument, table: PdfExportTable) {
  const tableWidth = getGenericPdfTableWidth(doc);
  ensureGenericPdfSpace(doc, 52);
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(12).text(table.title, PDF_PAGE_MARGIN, doc.y, {
    width: tableWidth,
  });
  doc.moveDown(0.4);

  const widths = normalizeGenericColumnWidths(table.columnWidths, table.headers.length, tableWidth);
  if (table.chart) {
    drawGenericChart(doc, table.chart, tableWidth);
    if (table.rows.length === 0) {
      return;
    }
    doc.moveDown(0.6);
  }

  if (!table.hideHeader) {
    drawGenericTableHeader(doc, table.headers, widths, table.headerFontSize ?? 7.5, tableWidth);
  }

  const sectionRows = new Set(table.sectionRows ?? []);
  const emphasisRows = new Set(table.emphasisRows ?? []);
  for (const [rowIndex, row] of table.rows.entries()) {
    drawGenericTableRow(doc, row, widths, table.fontSize ?? 7.5, tableWidth, {
      isEmphasized: emphasisRows.has(rowIndex),
      isSection: sectionRows.has(rowIndex),
    });
  }
}

function drawGenericChart(doc: PDFKit.PDFDocument, chart: PdfExportChart, tableWidth: number) {
  if (chart.kind === "gantt") {
    drawGanttChart(doc, chart.rows, tableWidth);
    return;
  }

  drawCurveChart(doc, chart.points, tableWidth);
}

function drawGanttChart(doc: PDFKit.PDFDocument, rows: PdfGanttChartRow[], tableWidth: number) {
  const scheduledRows = rows.filter((row) => isValidPdfDate(row.startDate) && isValidPdfDate(row.endDate));
  if (scheduledRows.length === 0) {
    doc.fillColor("#64748b").font("Helvetica").fontSize(8).text("No hay partidas programadas para graficar.", PDF_PAGE_MARGIN, doc.y, {
      width: tableWidth,
    });
    return;
  }

  const minTime = Math.min(...scheduledRows.map((row) => new Date(row.startDate).getTime()));
  const maxTime = Math.max(...scheduledRows.map((row) => new Date(row.endDate).getTime()));
  const totalDays = Math.max(1, Math.ceil((maxTime - minTime) / 86400000) + 1);
  const labelWidth = Math.min(230, tableWidth * 0.32);
  const durationWidth = 42;
  const chartStartX = PDF_PAGE_MARGIN + labelWidth + durationWidth + 18;
  const chartWidth = tableWidth - labelWidth - durationWidth - 18;
  const rowHeight = 15;
  const headerHeight = 34;
  const monthTicks = buildGanttMonthTicks(new Date(minTime), new Date(maxTime), totalDays, chartWidth);
  let rowIndex = 0;

  while (rowIndex < scheduledRows.length) {
    const availableHeight = getGenericPdfContentBottom(doc) - doc.y - headerHeight - 8;
    const rowsInPage = Math.max(6, Math.floor(availableHeight / rowHeight));
    const chunk = scheduledRows.slice(rowIndex, rowIndex + rowsInPage);
    ensureGenericPdfSpace(doc, headerHeight + chunk.length * rowHeight + 8);
    const startY = doc.y;

    drawGanttHeader(doc, {
      chartStartX,
      chartWidth,
      durationWidth,
      labelWidth,
      monthTicks,
      startY,
    });
    drawGanttMonthGrid(doc, monthTicks, chartStartX, startY + headerHeight, chunk.length * rowHeight + 4);

    chunk.forEach((row, index) => {
      const y = startY + headerHeight + index * rowHeight;
      const startOffsetDays = Math.max(0, Math.floor((new Date(row.startDate).getTime() - minTime) / 86400000));
      const durationDays = Math.max(1, Math.ceil((new Date(row.endDate).getTime() - new Date(row.startDate).getTime()) / 86400000) + 1);
      const x = chartStartX + (startOffsetDays / totalDays) * chartWidth;
      const width = Math.max(4, (durationDays / totalDays) * chartWidth);

      doc.fillColor("#334155").font("Helvetica").fontSize(6.6).text(row.label, PDF_PAGE_MARGIN, y, {
        ellipsis: true,
        height: 9,
        width: labelWidth - 6,
      });
      doc.fillColor("#334155").font("Helvetica").fontSize(6.6).text(String(row.durationDays ?? durationDays), PDF_PAGE_MARGIN + labelWidth + 4, y, {
        align: "right",
        height: 9,
        width: durationWidth - 8,
      });
      doc.rect(chartStartX, y + 3, chartWidth, 5).fill(index % 2 === 0 ? "#f8fafc" : "#ffffff");
      doc.roundedRect(x, y + 1, Math.min(width, chartWidth - (x - chartStartX)), 8, 3).fill(row.isCritical ? "#ef4444" : "#0084d1");
    });

    doc.y = startY + headerHeight + chunk.length * rowHeight + 10;
    rowIndex += chunk.length;
    if (rowIndex < scheduledRows.length) {
      doc.addPage();
    }
  }
}

function drawGanttHeader(
  doc: PDFKit.PDFDocument,
  input: {
    chartStartX: number;
    chartWidth: number;
    durationWidth: number;
    labelWidth: number;
    monthTicks: Array<{ label: string; x: number; isMajor: boolean }>;
    startY: number;
  },
) {
  const { chartStartX, chartWidth, durationWidth, labelWidth, monthTicks, startY } = input;
  const tableHeaderHeight = 24;

  doc.roundedRect(PDF_PAGE_MARGIN, startY, labelWidth + durationWidth + 10, tableHeaderHeight, 4).fill("#0f172a");
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7.2);
  doc.text("Partida", PDF_PAGE_MARGIN + 8, startY + 8, { width: labelWidth - 12 });
  doc.text("Dias", PDF_PAGE_MARGIN + labelWidth + 4, startY + 8, { align: "right", width: durationWidth - 8 });

  doc.roundedRect(chartStartX, startY, chartWidth, tableHeaderHeight, 4).fill("#eff6ff");
  doc.fillColor("#475569").font("Helvetica").fontSize(5.8);
  drawGanttMonthLabels(doc, monthTicks, chartStartX, startY + 9);
}

function buildGanttMonthTicks(startDate: Date, endDate: Date, totalDays: number, chartWidth: number) {
  const ticks: Array<{ label: string; x: number; isMajor: boolean }> = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const startTime = startDate.getTime();

  while (cursor <= endDate) {
    const offsetDays = Math.max(0, Math.floor((cursor.getTime() - startTime) / 86400000));
    ticks.push({
      isMajor: cursor.getMonth() === 0 || ticks.length === 0,
      label: `${String(cursor.getMonth() + 1).padStart(2, "0")}/${String(cursor.getFullYear()).slice(-2)}`,
      x: (offsetDays / totalDays) * chartWidth,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return ticks;
}

function drawGanttMonthGrid(
  doc: PDFKit.PDFDocument,
  ticks: Array<{ label: string; x: number; isMajor: boolean }>,
  chartStartX: number,
  y: number,
  height: number,
) {
  ticks.forEach((tick) => {
    const x = chartStartX + tick.x;
    doc.strokeColor(tick.isMajor ? "#94a3b8" : "#e2e8f0").lineWidth(tick.isMajor ? 0.8 : 0.5);
    doc.moveTo(x, y).lineTo(x, y + height).stroke();
  });
}

function drawGanttMonthLabels(
  doc: PDFKit.PDFDocument,
  ticks: Array<{ label: string; x: number; isMajor: boolean }>,
  chartStartX: number,
  y: number,
) {
  ticks.forEach((tick, index) => {
    if (index % Math.ceil(Math.max(1, ticks.length / 8)) === 0) {
      const x = chartStartX + tick.x;
      doc.fillColor("#475569").font(tick.isMajor ? "Helvetica-Bold" : "Helvetica").fontSize(5.8).text(tick.label, x - 14, y, {
        align: "center",
        width: 28,
      });
    }
  });
}

function drawCurveChart(doc: PDFKit.PDFDocument, points: PdfCurveChartPoint[], tableWidth: number) {
  if (points.length === 0) {
    doc.fillColor("#64748b").font("Helvetica").fontSize(8).text("No hay datos de Curva S para graficar.", PDF_PAGE_MARGIN, doc.y, {
      width: tableWidth,
    });
    return;
  }

  const chartHeight = 220;
  ensureGenericPdfSpace(doc, chartHeight + 28);
  const startX = PDF_PAGE_MARGIN;
  const startY = doc.y;
  const axisLeft = startX + 44;
  const axisTop = startY + 10;
  const axisWidth = tableWidth - 62;
  const axisHeight = chartHeight - 52;
  const maxAmount = Math.max(...points.map((point) => point.accumulatedAmount), 1);

  doc.rect(startX, startY, tableWidth, chartHeight).fill("#f8fafc");
  doc.strokeColor("#cbd5e1").lineWidth(1);
  doc.moveTo(axisLeft, axisTop).lineTo(axisLeft, axisTop + axisHeight).lineTo(axisLeft + axisWidth, axisTop + axisHeight).stroke();

  for (let tick = 0; tick <= 4; tick++) {
    const y = axisTop + axisHeight - (tick / 4) * axisHeight;
    doc.strokeColor("#e2e8f0").moveTo(axisLeft, y).lineTo(axisLeft + axisWidth, y).stroke();
    doc.fillColor("#64748b").font("Helvetica").fontSize(6.5).text(`${tick * 25}%`, startX + 8, y - 4, { align: "right", width: 28 });
  }

  const pointCoordinates = points.map((point, index) => {
    const x = axisLeft + (points.length === 1 ? 0 : (index / (points.length - 1)) * axisWidth);
    const percentageY = axisTop + axisHeight - (Math.min(100, Math.max(0, point.accumulatedPercentage)) / 100) * axisHeight;
    const amountY = axisTop + axisHeight - (point.accumulatedAmount / maxAmount) * axisHeight;
    return { point, x, y: Number.isFinite(percentageY) ? percentageY : amountY };
  });

  const path = pointCoordinates.map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  if (path) {
    doc.path(path).strokeColor("#2563eb").lineWidth(2.4).stroke();
  }

  pointCoordinates.forEach(({ point, x, y }, index) => {
    doc.circle(x, y, 3.4).fill("#2563eb");
    if (index === 0 || index === pointCoordinates.length - 1 || index % Math.ceil(pointCoordinates.length / 6) === 0) {
      doc.fillColor("#475569").font("Helvetica").fontSize(6.3).text(point.label, x - 24, axisTop + axisHeight + 8, {
        align: "center",
        width: 48,
      });
    }
  });

  const lastPoint = points.at(-1);
  if (lastPoint) {
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(8).text(
      `Acumulado final: ${lastPoint.accumulatedAmount.toFixed(2)} | ${lastPoint.accumulatedPercentage.toFixed(2)}%`,
      axisLeft,
      startY + chartHeight - 18,
      { width: axisWidth },
    );
  }

  doc.y = startY + chartHeight + 10;
}

function isValidPdfDate(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

function getGenericPdfTableWidth(doc: PDFKit.PDFDocument) {
  return doc.page.width - PDF_PAGE_MARGIN * 2;
}

function getGenericPdfContentBottom(doc: PDFKit.PDFDocument) {
  return doc.page.height - PDF_PAGE_MARGIN;
}

function buildGenericColumnWidths(columnCount: number, tableWidth: number) {
  if (columnCount <= 0) return [];
  const firstWidth = columnCount > 3 ? 130 : 170;
  const remainingWidth = tableWidth - firstWidth;
  return Array.from({ length: columnCount }, (_, index) => (index === 0 ? firstWidth : remainingWidth / (columnCount - 1)));
}

function normalizeGenericColumnWidths(widths: number[] | undefined, columnCount: number, tableWidth: number) {
  if (!widths || widths.length !== columnCount) {
    return buildGenericColumnWidths(columnCount, tableWidth);
  }

  const total = widths.reduce((sum, width) => sum + width, 0);
  if (total <= 0) {
    return buildGenericColumnWidths(columnCount, tableWidth);
  }

  return widths.map((width) => (width / total) * tableWidth);
}

function drawGenericTableHeader(doc: PDFKit.PDFDocument, headers: string[], widths: number[], fontSize: number, tableWidth: number) {
  const startY = doc.y;
  doc.rect(PDF_PAGE_MARGIN, startY, tableWidth, PDF_TABLE_HEADER_HEIGHT).fill("#0f172a");
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(fontSize);
  let x = PDF_PAGE_MARGIN;
  headers.forEach((header, index) => {
    doc.text(header, x + 4, startY + 7, { width: Math.max(20, widths[index] - 8) });
    x += widths[index] ?? 0;
  });
  doc.y = startY + PDF_TABLE_HEADER_HEIGHT + 6;
}

function drawGenericTableRow(
  doc: PDFKit.PDFDocument,
  row: string[],
  widths: number[],
  fontSize: number,
  tableWidth: number,
  options: { isSection?: boolean; isEmphasized?: boolean } = {},
) {
  if (options.isSection) {
    ensureGenericPdfSpace(doc, 28);
    const startY = doc.y;
    const label = row.find((value) => value.trim().length > 0) ?? "";

    doc.roundedRect(PDF_PAGE_MARGIN, startY, tableWidth, 20, 4).fill("#e2e8f0");
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(Math.max(fontSize, 7));
    doc.text(label, PDF_PAGE_MARGIN + 8, startY + 6, {
      width: tableWidth - 16,
      height: 10,
      ellipsis: true,
    });
    doc.y = startY + 28;
    return;
  }

  const height = Math.max(
    12,
    ...row.map((value, index) => doc.fontSize(fontSize).heightOfString(value, { width: Math.max(20, (widths[index] ?? 80) - 8) })),
  );
  ensureGenericPdfSpace(doc, height + 8);
  const startY = doc.y;
  if (options.isEmphasized) {
    doc.rect(PDF_PAGE_MARGIN, startY - 2, tableWidth, height + 6).fill("#f8fafc");
  }
  doc.fillColor(options.isEmphasized ? "#0f172a" : "#334155").font(options.isEmphasized ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize);
  let x = PDF_PAGE_MARGIN;
  row.forEach((value, index) => {
    doc.text(value, x + 4, startY, { width: Math.max(20, (widths[index] ?? 80) - 8), height });
    x += widths[index] ?? 0;
  });
  doc.y = startY + height + 5;
}

function ensureGenericPdfSpace(doc: PDFKit.PDFDocument, requiredHeight: number) {
  if (doc.y + requiredHeight > getGenericPdfContentBottom(doc)) {
    doc.addPage();
  }
}

function ensurePage(doc: PDFKit.PDFDocument, requiredHeight = 0) {
  if (doc.y + requiredHeight > 730) {
    doc.addPage();
    drawBudgetTableHeader(doc);
  }
}

function ensureApuPage(doc: PDFKit.PDFDocument, requiredHeight = 0) {
  if (doc.y + requiredHeight > PDF_PAGE_CONTENT_BOTTOM) {
    doc.addPage();
    drawApuTableHeader(doc);
  }
}

function ensureApuPartidaStartsTogether(doc: PDFKit.PDFDocument, block: ApuPdfPartidaBlockInput) {
  const estimatedHeight = estimateApuPdfPartidaBlockHeight(block);
  const usablePageHeight = PDF_PAGE_CONTENT_BOTTOM - doc.page.margins.top;

  if (estimatedHeight <= usablePageHeight && doc.y + estimatedHeight > PDF_PAGE_CONTENT_BOTTOM) {
    doc.addPage();
  }
}

function drawApuTableHeader(doc: PDFKit.PDFDocument) {
  doc.rect(PDF_PAGE_MARGIN, doc.y, PDF_TABLE_WIDTH, PDF_TABLE_HEADER_HEIGHT).fill("#0f172a");
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8);
  const y = doc.y + 7;
  doc.text("Insumo", 42, y, { width: 208 });
  doc.text("Und.", 255, y, { width: 42, align: "center" });
  doc.text("Cuad.", 302, y, { width: 48, align: "right" });
  doc.text("Cantidad", 355, y, { width: 58, align: "right" });
  doc.text("Precio", 418, y, { width: 58, align: "right" });
  doc.text("Subtotal", 481, y, { width: 72, align: "right" });
  doc.y += PDF_TABLE_HEADER_HEIGHT + 8;
}

function drawApuTableRow(doc: PDFKit.PDFDocument, row: ApuPdfTableRowInput) {
  doc.fillColor("#334155").font("Helvetica").fontSize(8);
  const y = doc.y;
  const cells = buildApuPdfTableRowLayout(row, PDF_PAGE_MARGIN, y, PDF_TABLE_WIDTH);
  const rowHeight = Math.max(
    12,
    ...cells.map((cell) => doc.heightOfString(String(row[cell.key]), { width: cell.width, align: cell.align })),
  );

  ensureApuPage(doc, rowHeight + 8);
  const rowY = doc.y;
  const visibleCells = buildApuPdfTableRowLayout(row, PDF_PAGE_MARGIN, rowY, PDF_TABLE_WIDTH);

  for (const cell of visibleCells) {
    doc.text(String(row[cell.key]), cell.x, rowY, {
      align: cell.align,
      height: rowHeight,
      width: cell.width,
    });
  }

  doc.y = rowY + rowHeight + 5;
}

function drawBudgetCoverPage(
  doc: PDFKit.PDFDocument,
  budgetName: string,
  currency: string,
  project?: DocumentSignatureProjectMeta,
  responsible?: ReportResponsibleMeta,
  identityAssets?: ReportIdentityAssets,
) {
  const cover = buildBudgetCoverSummary(budgetName, currency, project, responsible);
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const pageHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
  const startX = doc.page.margins.left;
  const startY = doc.page.margins.top;

  doc.roundedRect(startX, startY, pageWidth, pageHeight, 24).fillAndStroke("#f8fbff", "#dbeafe");

  if (identityAssets?.companyLogo) {
    doc.image(identityAssets.companyLogo.buffer, startX + pageWidth - 92, startY + 24, {
      fit: [64, 64],
      align: "center",
      valign: "center",
    });
  }

  doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(10).text(cover.companyName, startX + 28, startY + 30, {
    width: pageWidth - 140,
  });
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(28).text(cover.title, startX + 28, startY + 92, {
    width: pageWidth - 56,
  });
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(20).text(cover.budgetName, startX + 28, startY + 132, {
    width: pageWidth - 56,
  });
  doc.fillColor("#475569").font("Helvetica").fontSize(13).text(cover.projectName, startX + 28, startY + 166, {
    width: pageWidth - 56,
  });

  const metadataBoxY = startY + 232;
  doc.roundedRect(startX + 24, metadataBoxY, pageWidth - 48, 120, 18).fillAndStroke("#ffffff", "#e2e8f0");
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(10).text("METADATOS DEL DOCUMENTO", startX + 42, metadataBoxY + 18);

  let metadataY = metadataBoxY + 46;
  for (const [label, value] of cover.metadata) {
    doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(9).text(label.toUpperCase(), startX + 42, metadataY, { width: 110 });
    doc.fillColor("#0f172a").font("Helvetica").fontSize(10).text(value, startX + 154, metadataY, { width: pageWidth - 210 });
    metadataY += 18;
  }

  const signatureBoxY = metadataBoxY + 148;
  doc.roundedRect(startX + 24, signatureBoxY, pageWidth - 48, 148, 18).fillAndStroke("#ffffff", "#e2e8f0");
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(10).text(cover.signatureTitle.toUpperCase(), startX + 42, signatureBoxY + 18);

  if (identityAssets?.avatar) {
    doc.image(identityAssets.avatar.buffer, startX + 42, signatureBoxY + 44, {
      fit: [54, 54],
      align: "center",
      valign: "center",
    });
  }

  const signatureTextX = identityAssets?.avatar ? startX + 112 : startX + 42;
  const signatureTextWidth = identityAssets?.avatar ? pageWidth - 182 : pageWidth - 84;
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(16).text(cover.signaturePrimary, signatureTextX, signatureBoxY + 50, {
    width: signatureTextWidth,
  });
  doc.fillColor("#475569").font("Helvetica").fontSize(11).text(cover.signatureSecondary, signatureTextX, signatureBoxY + 74, {
    width: signatureTextWidth,
  });

  const lineY = signatureBoxY + 114;
  doc.moveTo(startX + 42, lineY).lineTo(startX + pageWidth / 2 - 20, lineY).stroke("#94a3b8");
  doc.moveTo(startX + pageWidth / 2 + 20, lineY).lineTo(startX + pageWidth - 42, lineY).stroke("#94a3b8");
  doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(8).text("FIRMA DEL RESPONSABLE", startX + 42, lineY + 8, {
    width: pageWidth / 2 - 62,
    align: "center",
  });
  doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(8).text("VO. BO. / APROBACION", startX + pageWidth / 2 + 20, lineY + 8, {
    width: pageWidth / 2 - 62,
    align: "center",
  });

  doc.y = startY + pageHeight;
}

function drawDocumentSignatureBlock(
  doc: PDFKit.PDFDocument,
  budgetName: string,
  project?: DocumentSignatureProjectMeta,
  responsible?: ReportResponsibleMeta,
  identityAssets?: ReportIdentityAssets,
) {
  const summary = buildDocumentSignatureSummary(budgetName, project, responsible);
  const blockHeight = 276;

  if (doc.y + blockHeight > 760) {
    doc.addPage();
  }

  const startY = doc.y + 14;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const leftX = doc.page.margins.left;
  const rightX = leftX + pageWidth / 2 + 8;
  const sectionWidth = pageWidth / 2 - 8;

  doc.roundedRect(leftX, startY, pageWidth, blockHeight, 18).fillAndStroke("#f8fbff", "#dbeafe");
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(11).text("FIRMA DOCUMENTAL", leftX + 16, startY + 16);
  doc.fillColor("#475569").font("Helvetica").fontSize(8.5).text(
    "Cierre visual del presupuesto con responsable tecnico y espacios de firma para su salida final.",
    leftX + 16,
    startY + 32,
    { width: pageWidth - 32 },
  );

  if (identityAssets?.companyLogo) {
    doc.image(identityAssets.companyLogo.buffer, leftX + pageWidth - 74, startY + 12, {
      fit: [44, 44],
      align: "center",
      valign: "center",
    });
  }

  drawSignatureSummaryColumn(doc, leftX + 16, startY + 62, sectionWidth - 24, "RESUMEN DOCUMENTAL", summary.document);
  drawSignatureSummaryColumn(doc, rightX + 8, startY + 62, sectionWidth - 24, "RESPONSABLE TECNICO", summary.responsible);

  drawSignatureLineBox(
    doc,
    leftX + 16,
    startY + 176,
    sectionWidth - 24,
    "FIRMA DEL RESPONSABLE",
    summary.responsibleSigner,
    summary.responsibleRole,
    identityAssets?.avatar?.buffer ?? null,
  );
  drawSignatureLineBox(
    doc,
    rightX + 8,
    startY + 176,
    sectionWidth - 24,
    "VO. BO. / APROBACION",
    summary.approverLabel,
    buildApprovalSecondaryLabel(project),
    null,
  );

  doc.y = startY + blockHeight + 8;
}

function drawSignatureSummaryColumn(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  title: string,
  entries: ReadonlyArray<readonly [string, string]>,
) {
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(8.5).text(title, x, y, { width });

  let currentY = y + 16;

  for (const [label, value] of entries) {
    doc.roundedRect(x, currentY, width, 20, 8).fillAndStroke("#ffffff", "#e2e8f0");
    doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(7.5).text(label.toUpperCase(), x + 8, currentY + 6, { width: 82 });
    doc.fillColor("#0f172a").font("Helvetica").fontSize(8).text(value, x + 92, currentY + 6, {
      width: width - 100,
      ellipsis: true,
    });
    currentY += 24;
  }
}

function drawSignatureLineBox(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  title: string,
  primary: string,
  secondary: string,
  imageBuffer: Buffer | null,
) {
  doc.roundedRect(x, y, width, 72, 12).dash(4, { space: 4 }).stroke("#94a3b8");
  doc.undash();
  doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(7.5).text(title, x + 10, y + 8, { width: width - 20 });
  if (imageBuffer) {
    doc.image(imageBuffer, x + 12, y + 20, {
      fit: [26, 26],
      align: "center",
      valign: "center",
    });
  }
  doc.moveTo(x + 10, y + 50).lineTo(x + width - 10, y + 50).stroke("#94a3b8");
  const textX = imageBuffer ? x + 44 : x + 10;
  const textWidth = imageBuffer ? width - 54 : width - 20;
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(8).text(primary, textX, y + 54, { width: textWidth, align: "center" });
  doc.fillColor("#64748b").font("Helvetica").fontSize(7.5).text(secondary, textX, y + 64, { width: textWidth, align: "center" });
}
