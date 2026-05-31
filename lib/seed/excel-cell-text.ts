import type ExcelJS from "exceljs";

type RichTextCell = {
  richText: Array<{ text?: unknown }>;
};

type TextCell = {
  text: unknown;
};

type FormulaCell = {
  result?: unknown;
};

export function normalizeExcelCellText(value: ExcelJS.CellValue | unknown) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return String(value).trim();

  if (isRichTextCell(value)) {
    return value.richText.map((part) => (part.text == null ? "" : String(part.text))).join("").trim();
  }

  if (isFormulaCell(value) && value.result != null) {
    return normalizeExcelCellText(value.result);
  }

  if (isTextCell(value) && typeof value.text !== "object") {
    return normalizeExcelCellText(value.text);
  }

  return "";
}

function isRichTextCell(value: object): value is RichTextCell {
  return "richText" in value && Array.isArray(value.richText);
}

function isFormulaCell(value: object): value is FormulaCell {
  return "result" in value;
}

function isTextCell(value: object): value is TextCell {
  return "text" in value;
}
