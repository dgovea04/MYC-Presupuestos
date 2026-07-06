import ExcelJS from "exceljs";
import { buildDisplayRows, levelTypeLabel } from "@/lib/budget/structure";
import type { BudgetRecord } from "@/types/budget";
import type { ReportResponsibleMeta } from "@/types/report-meta";
import { calculateBudgetRecord } from "@/lib/calculations/budget";
import { buildApprovalSecondaryLabel, buildDocumentSignatureSummary, type DocumentSignatureProjectMeta } from "@/lib/exports/document-signature";
import { loadReportIdentityAssets } from "@/lib/exports/report-assets";

const MAX_CURRENCY_DECIMALS = 4;

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

function getCurrencySymbol(currency: string) {
  if (currency === "USD") return "$";
  if (currency === "PEN") return "S/";
  if (currency === "EUR") return "EUR";
  return currency;
}

function buildDecimalFormat(decimalPlaces: number) {
  if (decimalPlaces === 0) {
    return "#,##0";
  }

  return `#,##0.${"0".repeat(decimalPlaces)}`;
}

function createCurrencyNumberFormat(currency: string, decimalPlaces: number) {
  return `${quoteExcelNumberFormatLiteral(getCurrencySymbol(currency))} ${buildDecimalFormat(decimalPlaces)}`;
}

function quoteExcelNumberFormatLiteral(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function createBudgetWorkbook(
  budget: BudgetRecord,
  project?: DocumentSignatureProjectMeta,
  currencyDecimals = 2,
  responsible?: ReportResponsibleMeta,
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Presupuesto");
  const normalized = calculateBudgetRecord(budget);
  const rows = buildDisplayRows(normalized);
  const normalizedDecimals = normalizeDecimalPlaces(currencyDecimals);
  const identityAssets = await loadReportIdentityAssets(responsible);

  workbook.creator = "MC Presupuestos";
  sheet.views = [{ state: "frozen", ySplit: 6 }];
  sheet.columns = [
    { header: "Codigo", key: "code", width: 18 },
    { header: "Descripcion", key: "description", width: 52 },
    { header: "Unidad", key: "unit", width: 12 },
    { header: "Metrado", key: "quantity", width: 14 },
    { header: "Precio unitario", key: "unitPrice", width: 18 },
    { header: "Parcial", key: "partial", width: 18 },
  ];

  sheet.mergeCells("A1:F1");
  sheet.getCell("A1").value = "PRESUPUESTO DE OBRA";
  sheet.getCell("A1").font = { size: 16, bold: true };
  sheet.getCell("A1").alignment = { horizontal: "center" };

  sheet.mergeCells("A2:F2");
  sheet.getCell("A2").value = normalized.name;
  sheet.getCell("A2").font = { size: 12, bold: true, color: { argb: "FF0F172A" } };
  sheet.getCell("A2").alignment = { horizontal: "center" };

  sheet.getCell("A3").value = "Proyecto";
  sheet.getCell("B3").value = project?.name ?? "-";
  sheet.getCell("D3").value = "Cliente";
  sheet.getCell("E3").value = project?.clientName ?? "-";
  sheet.getCell("A4").value = "Ubicacion";
  sheet.getCell("B4").value = project?.location ?? "-";
  sheet.getCell("D4").value = "Moneda";
  sheet.getCell("E4").value = normalized.currency;
  const responsibleRows = buildResponsibleMetaRows(responsible);

  for (const [index, row] of responsibleRows.entries()) {
    const rowNumber = 5 + index;
    sheet.getCell(`A${rowNumber}`).value = row[0];
    sheet.getCell(`B${rowNumber}`).value = row[1];
    sheet.getCell(`D${rowNumber}`).value = row[2];
    sheet.getCell(`E${rowNumber}`).value = row[3];
  }

  const headerRow = sheet.getRow(7);
  headerRow.values = ["Codigo", "Descripcion", "Unidad", "Metrado", "Precio unitario", "Parcial"];
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };

  let currentRow = 8;

  for (const row of rows) {
    if (row.kind === "level") {
      const excelRow = sheet.getRow(currentRow);
      excelRow.getCell(1).value = row.level.code;
      excelRow.getCell(2).value = `${"  ".repeat(row.depth)}${levelTypeLabel[row.level.type]}: ${row.level.name}`;
      excelRow.font = {
        bold: true,
        color: { argb: "FF0F172A" },
      };
      excelRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: getExcelLevelColor(row.level.type) },
      };
      currentRow += 1;
      continue;
    }

    const excelRow = sheet.getRow(currentRow);
    excelRow.getCell(1).value = row.item.code;
    excelRow.getCell(2).value = `${"  ".repeat(row.depth)}${row.item.description}`;
    excelRow.getCell(3).value = row.item.unit;
    excelRow.getCell(4).value = row.item.quantity;
    excelRow.getCell(5).value = row.item.unitPrice;
    excelRow.getCell(6).value = row.item.partial;
    currentRow += 1;
  }

  currentRow += 1;
  writeSummaryRow(sheet, currentRow++, "Costo directo", normalized.totals.totalDirectCost);
  writeSummaryRow(sheet, currentRow++, "Gastos generales", normalized.totals.totalGeneralExpenses);
  writeSummaryRow(sheet, currentRow++, "Utilidad", normalized.totals.totalUtility);
  writeSummaryRow(sheet, currentRow++, "IGV", normalized.totals.totalTax);
  writeSummaryRow(sheet, currentRow++, "Total", normalized.totals.totalAmount, true);
  currentRow = writeBudgetDocumentSignatureBlock(sheet, workbook, currentRow + 1, normalized.name, project, responsible, identityAssets);

  formatCurrencyColumns(sheet, [5, 6], normalized.currency, normalizedDecimals);
  formatCurrencyColumns(sheet, [2], normalized.currency, normalizedDecimals, false);
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  });

  return workbook.xlsx.writeBuffer();
}

export async function createApuWorkbook(
  budget: BudgetRecord,
  project?: DocumentSignatureProjectMeta,
  currencyDecimals = 2,
  responsible?: ReportResponsibleMeta,
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("APU");
  const normalized = calculateBudgetRecord(budget);
  const normalizedDecimals = normalizeDecimalPlaces(currencyDecimals);
  const identityAssets = await loadReportIdentityAssets(responsible);

  workbook.creator = "MC Presupuestos";
  sheet.columns = [
    { header: "Codigo de partida", key: "itemCode", width: 18 },
    { header: "Descripcion de partida", key: "itemDescription", width: 36 },
    { header: "Insumo", key: "resource", width: 36 },
    { header: "Unidad", key: "unit", width: 12 },
    { header: "Cantidad", key: "quantity", width: 12 },
    { header: "Precio", key: "unitPrice", width: 14 },
    { header: "Subtotal", key: "subtotal", width: 14 },
  ];

  sheet.mergeCells("A1:G1");
  sheet.getCell("A1").value = "ANALISIS DE COSTOS UNITARIOS";
  sheet.getCell("A1").font = { size: 16, bold: true };
  sheet.getCell("A1").alignment = { horizontal: "center" };

  sheet.getCell("A2").value = "Proyecto";
  sheet.getCell("B2").value = project?.name ?? "-";
  sheet.getCell("E2").value = "Presupuesto";
  sheet.getCell("F2").value = normalized.name;
  const responsibleRows = buildResponsibleMetaRows(responsible);

  for (const [index, row] of responsibleRows.entries()) {
    const rowNumber = 3 + index;
    sheet.getCell(`A${rowNumber}`).value = row[0];
    sheet.getCell(`B${rowNumber}`).value = row[1];
    sheet.getCell(`E${rowNumber}`).value = row[2];
    sheet.getCell(`F${rowNumber}`).value = row[3];
  }

  let currentRow = 6;

  for (const item of normalized.items) {
    const apu = item.apu;
    if (!apu) continue;

    sheet.mergeCells(`A${currentRow}:G${currentRow}`);
    const titleCell = sheet.getCell(`A${currentRow}`);
    titleCell.value = `${item.code} - ${item.description}`;
    titleCell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    currentRow += 1;

    const headerRow = sheet.getRow(currentRow);
    headerRow.values = ["Codigo de partida", "Descripcion de partida", "Insumo", "Unidad", "Cuadrilla", "Cantidad", "Precio", "Subtotal"];
    headerRow.font = { bold: true };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    currentRow += 1;

    for (const resource of apu.resources) {
      const row = sheet.getRow(currentRow);
      row.getCell(1).value = item.code;
      row.getCell(2).value = item.description;
      row.getCell(3).value = resource.resource?.description ?? resource.resourceType;
      row.getCell(4).value = resource.resource?.unit ?? "";
      row.getCell(5).value = resource.crew ?? "";
      row.getCell(6).value = resource.quantity;
      row.getCell(7).value = resource.unitPrice;
      row.getCell(8).value = resource.subtotal;
      currentRow += 1;
    }

    const totalRow = sheet.getRow(currentRow);
    totalRow.getCell(7).value = "Total unitario";
    totalRow.getCell(8).value = item.unitPrice;
    totalRow.font = { bold: true };
    totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } };
    currentRow += 2;
  }

  writeApuDocumentSignatureBlock(sheet, workbook, currentRow + 1, normalized.name, project, responsible, identityAssets);

  formatCurrencyColumns(sheet, [7, 8], normalized.currency, normalizedDecimals);

  return workbook.xlsx.writeBuffer();
}

export function buildResponsibleMetaRows(responsible?: ReportResponsibleMeta) {
  return [
    ["Responsable", responsible?.name ?? "-", "Cargo", responsible?.jobTitle ?? "-"],
    ["Empresa", responsible?.companyName ?? "-", "Telefono", responsible?.phone ?? "-"],
  ] as const;
}

function writeBudgetDocumentSignatureBlock(
  sheet: ExcelJS.Worksheet,
  workbook: ExcelJS.Workbook,
  startRow: number,
  budgetName: string,
  project?: DocumentSignatureProjectMeta,
  responsible?: ReportResponsibleMeta,
  identityAssets?: Awaited<ReturnType<typeof loadReportIdentityAssets>>,
) {
  const summary = buildDocumentSignatureSummary(budgetName, project, responsible);

  sheet.mergeCells(`A${startRow}:F${startRow}`);
  const titleCell = sheet.getCell(`A${startRow}`);
  titleCell.value = "FIRMA DOCUMENTAL";
  titleCell.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  titleCell.alignment = { horizontal: "center" };

  sheet.mergeCells(`A${startRow + 1}:F${startRow + 1}`);
  const subtitleCell = sheet.getCell(`A${startRow + 1}`);
  subtitleCell.value = "Cierre visual del presupuesto con responsable tecnico y espacios de firma.";
  subtitleCell.font = { italic: true, color: { argb: "FF475569" } };
  subtitleCell.alignment = { wrapText: true };
  subtitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FBFF" } };
  if (identityAssets?.companyLogo) {
    insertWorksheetImage(workbook, sheet, identityAssets.companyLogo, {
      br: { col: 5.75, row: startRow + 0.95 },
      tl: { col: 5.05, row: startRow - 0.05 },
    });
  }

  sheet.mergeCells(`A${startRow + 2}:C${startRow + 2}`);
  sheet.mergeCells(`D${startRow + 2}:F${startRow + 2}`);
  writeSectionHeaderCell(sheet.getCell(`A${startRow + 2}`), "RESUMEN DOCUMENTAL");
  writeSectionHeaderCell(sheet.getCell(`D${startRow + 2}`), "RESPONSABLE TECNICO");

  for (const [index, [leftLabel, leftValue]] of summary.document.entries()) {
    const rowNumber = startRow + 3 + index;
    const [rightLabel, rightValue] = summary.responsible[index];
    writeSummaryLabelValueRow(sheet, rowNumber, "A", "B", leftLabel, leftValue);
    writeSummaryLabelValueRow(sheet, rowNumber, "D", "E", rightLabel, rightValue);
  }

  const signatureTitleRow = startRow + 8;
  sheet.mergeCells(`A${signatureTitleRow}:C${signatureTitleRow}`);
  sheet.mergeCells(`D${signatureTitleRow}:F${signatureTitleRow}`);
  writeSectionHeaderCell(sheet.getCell(`A${signatureTitleRow}`), "FIRMA DEL RESPONSABLE");
  writeSectionHeaderCell(sheet.getCell(`D${signatureTitleRow}`), "VO. BO. / APROBACION");

  const signatureLineRow = signatureTitleRow + 1;
  sheet.mergeCells(`A${signatureLineRow}:C${signatureLineRow}`);
  sheet.mergeCells(`D${signatureLineRow}:F${signatureLineRow}`);
  sheet.getRow(signatureLineRow).height = 28;
  writeSignatureLineCell(
    sheet.getCell(`A${signatureLineRow}`),
    summary.responsibleSigner,
    summary.responsibleRole,
  );
  writeSignatureLineCell(
    sheet.getCell(`D${signatureLineRow}`),
    summary.approverLabel,
    buildApprovalSecondaryLabel(project),
  );
  if (identityAssets?.avatar) {
    insertWorksheetImage(workbook, sheet, identityAssets.avatar, {
      br: { col: 1.05, row: signatureLineRow + 0.8 },
      tl: { col: 0.15, row: signatureLineRow + 0.02 },
    });
  }

  return signatureLineRow + 1;
}

function writeApuDocumentSignatureBlock(
  sheet: ExcelJS.Worksheet,
  workbook: ExcelJS.Workbook,
  startRow: number,
  budgetName: string,
  project?: DocumentSignatureProjectMeta,
  responsible?: ReportResponsibleMeta,
  identityAssets?: Awaited<ReturnType<typeof loadReportIdentityAssets>>,
) {
  const summary = buildDocumentSignatureSummary(budgetName, project, responsible);

  sheet.mergeCells(`A${startRow}:H${startRow}`);
  const titleCell = sheet.getCell(`A${startRow}`);
  titleCell.value = "FIRMA DOCUMENTAL";
  titleCell.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  titleCell.alignment = { horizontal: "center" };

  sheet.mergeCells(`A${startRow + 1}:H${startRow + 1}`);
  const subtitleCell = sheet.getCell(`A${startRow + 1}`);
  subtitleCell.value = "Cierre visual del APU con responsable tecnico y espacios de firma.";
  subtitleCell.font = { italic: true, color: { argb: "FF475569" } };
  subtitleCell.alignment = { wrapText: true };
  subtitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FBFF" } };
  if (identityAssets?.companyLogo) {
    insertWorksheetImage(workbook, sheet, identityAssets.companyLogo, {
      br: { col: 7.7, row: startRow + 0.95 },
      tl: { col: 6.9, row: startRow - 0.05 },
    });
  }

  sheet.mergeCells(`A${startRow + 2}:D${startRow + 2}`);
  sheet.mergeCells(`E${startRow + 2}:H${startRow + 2}`);
  writeSectionHeaderCell(sheet.getCell(`A${startRow + 2}`), "RESUMEN DOCUMENTAL");
  writeSectionHeaderCell(sheet.getCell(`E${startRow + 2}`), "RESPONSABLE TECNICO");

  for (const [index, [leftLabel, leftValue]] of summary.document.entries()) {
    const rowNumber = startRow + 3 + index;
    const [rightLabel, rightValue] = summary.responsible[index];
    writeSummaryLabelValueRow(sheet, rowNumber, "A", "B", leftLabel, leftValue);
    writeSummaryLabelValueRow(sheet, rowNumber, "E", "F", rightLabel, rightValue);
  }

  const signatureTitleRow = startRow + 8;
  sheet.mergeCells(`A${signatureTitleRow}:D${signatureTitleRow}`);
  sheet.mergeCells(`E${signatureTitleRow}:H${signatureTitleRow}`);
  writeSectionHeaderCell(sheet.getCell(`A${signatureTitleRow}`), "FIRMA DEL RESPONSABLE");
  writeSectionHeaderCell(sheet.getCell(`E${signatureTitleRow}`), "VO. BO. / APROBACION");

  const signatureLineRow = signatureTitleRow + 1;
  sheet.mergeCells(`A${signatureLineRow}:D${signatureLineRow}`);
  sheet.mergeCells(`E${signatureLineRow}:H${signatureLineRow}`);
  sheet.getRow(signatureLineRow).height = 28;
  writeSignatureLineCell(
    sheet.getCell(`A${signatureLineRow}`),
    summary.responsibleSigner,
    summary.responsibleRole,
  );
  writeSignatureLineCell(
    sheet.getCell(`E${signatureLineRow}`),
    summary.approverLabel,
    buildApprovalSecondaryLabel(project),
  );
  if (identityAssets?.avatar) {
    insertWorksheetImage(workbook, sheet, identityAssets.avatar, {
      br: { col: 1.05, row: signatureLineRow + 0.8 },
      tl: { col: 0.15, row: signatureLineRow + 0.02 },
    });
  }
}

function writeSummaryRow(sheet: ExcelJS.Worksheet, rowNumber: number, label: string, value: number, highlight = false) {
  const row = sheet.getRow(rowNumber);
  row.getCell(4).value = label;
  row.getCell(5).value = value;
  row.getCell(4).font = { bold: true };
  row.getCell(5).font = { bold: true };
  row.getCell(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: highlight ? "FF0F172A" : "FFE2E8F0" } };
  row.getCell(5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: highlight ? "FF0F172A" : "FFE2E8F0" } };
  if (highlight) {
    row.getCell(4).font = { bold: true, color: { argb: "FFFFFFFF" } };
    row.getCell(5).font = { bold: true, color: { argb: "FFFFFFFF" } };
  }
}

function writeSectionHeaderCell(cell: ExcelJS.Cell, value: string) {
  cell.value = value;
  cell.font = { bold: true, color: { argb: "FF0F172A" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F2FE" } };
  cell.alignment = { horizontal: "center" };
}

function writeSummaryLabelValueRow(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  labelColumn: "A" | "D" | "E",
  valueColumn: "B" | "E" | "F",
  label: string,
  value: string,
) {
  sheet.getCell(`${labelColumn}${rowNumber}`).value = label;
  sheet.getCell(`${valueColumn}${rowNumber}`).value = value;
  sheet.getCell(`${labelColumn}${rowNumber}`).font = { bold: true, color: { argb: "FF64748B" } };
  sheet.getCell(`${valueColumn}${rowNumber}`).font = { color: { argb: "FF0F172A" } };
  sheet.getCell(`${labelColumn}${rowNumber}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
  sheet.getCell(`${valueColumn}${rowNumber}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
}

function writeSignatureLineCell(cell: ExcelJS.Cell, primary: string, secondary: string) {
  cell.value = `${primary}\n${secondary}`;
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.font = { bold: true, color: { argb: "FF0F172A" } };
  cell.border = {
    top: { style: "thin", color: { argb: "FF94A3B8" } },
    left: { style: "dotted", color: { argb: "FFCBD5E1" } },
    bottom: { style: "dotted", color: { argb: "FFCBD5E1" } },
    right: { style: "dotted", color: { argb: "FFCBD5E1" } },
  };
}

function insertWorksheetImage(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  asset: Awaited<ReturnType<typeof loadReportIdentityAssets>>["avatar"] extends infer T
    ? Exclude<T, null>
    : never,
  range: { tl: { col: number; row: number }; br: { col: number; row: number } },
) {
  const imageId = workbook.addImage({
    base64: asset.buffer.toString("base64"),
    extension: asset.extension === "jpg" ? "jpeg" : asset.extension,
  });

  const imageRange = {
    tl: range.tl,
    br: range.br,
  } as unknown as Parameters<ExcelJS.Worksheet["addImage"]>[1];

  sheet.addImage(imageId, imageRange);
}

function formatCurrencyColumns(
  sheet: ExcelJS.Worksheet,
  columns: number[],
  currency: string,
  decimalPlaces = 2,
  onlyNumeric = true,
) {
  for (const columnNumber of columns) {
    const format = createCurrencyNumberFormat(currency, decimalPlaces);
    sheet.getColumn(columnNumber).eachCell((cell) => {
      if (!onlyNumeric || typeof cell.value === "number") {
        cell.numFmt = format;
      }
    });
  }
}

function getExcelLevelColor(type: string) {
  if (type === "TITLE") return "FFE2E8F0";
  if (type === "SUBTITLE") return "FFE0F2FE";
  return "FFFEF3C7";
}
