import ExcelJS from "exceljs";
import type { BudgetFooterRowRecord } from "@/lib/budget-footer/types";

export async function parseBudgetFooterTemplate(filePath: string): Promise<{ rows: BudgetFooterRowRecord[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("No se encontro la hoja de pie de presupuesto en la plantilla");
  }

  const rows: BudgetFooterRowRecord[] = [];

  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const variable = row.getCell(1).text.trim().toUpperCase();
    const description = row.getCell(2).text.trim().toUpperCase();

    if (!variable || !description) {
      continue;
    }

    if (variable === "VARIABLE" && description === "DESCRIPCION") {
      continue;
    }

    rows.push({
      id: `template-footer-row-${rows.length + 1}`,
      variable,
      description,
      formula: normalizeFormula(row.getCell(3).text),
      manualValue: normalizeNumber(row.getCell(6).value),
      iu: row.getCell(7).text.trim() || null,
      highlight: normalizeBoolean(row.getCell(8).text),
      sortOrder: rows.length,
    });
  }

  return { rows };
}

function normalizeFormula(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.toUpperCase() : null;
}

function normalizeNumber(value: ExcelJS.CellValue) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value === "object" && "result" in value) {
    return normalizeNumber(value.result ?? 0);
  }
  return 0;
}

function normalizeBoolean(value: string) {
  return value.trim().toLowerCase() === "true";
}
