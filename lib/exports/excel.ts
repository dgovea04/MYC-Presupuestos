import ExcelJS from "exceljs";
import { buildDisplayRows, levelTypeLabel } from "@/lib/budget/structure";
import type { BudgetRecord } from "@/types/budget";
import { calculateBudgetRecord } from "@/lib/calculations/budget";

type ProjectMeta = {
  name?: string | null;
  clientName?: string | null;
  location?: string | null;
};

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
  return `${getCurrencySymbol(currency)} ${buildDecimalFormat(decimalPlaces)}`;
}

export async function createBudgetWorkbook(
  budget: BudgetRecord,
  project?: ProjectMeta,
  currencyDecimals = 2,
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Presupuesto");
  const normalized = calculateBudgetRecord(budget);
  const rows = buildDisplayRows(normalized);
  const normalizedDecimals = normalizeDecimalPlaces(currencyDecimals);

  workbook.creator = "MYC Presupuestos";
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

  const headerRow = sheet.getRow(6);
  headerRow.values = ["Codigo", "Descripcion", "Unidad", "Metrado", "Precio unitario", "Parcial"];
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };

  let currentRow = 7;

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

export async function createApuWorkbook(budget: BudgetRecord, project?: ProjectMeta, currencyDecimals = 2) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("APU");
  const normalized = calculateBudgetRecord(budget);
  const normalizedDecimals = normalizeDecimalPlaces(currencyDecimals);

  workbook.creator = "MYC Presupuestos";
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

  let currentRow = 4;

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

  formatCurrencyColumns(sheet, [7, 8], normalized.currency, normalizedDecimals);

  return workbook.xlsx.writeBuffer();
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
