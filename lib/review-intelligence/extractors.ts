import ExcelJS from "exceljs";

import { extractPdfImportFile } from "@/lib/pdf-import/extraction";
import { validateDocumentFile, type ReviewDocumentFile } from "./documents";

export type ExtractionInput = {
  file: ReviewDocumentFile;
};

export type ExtractionLocation = {
  sheet: string;
  range: string;
};

export type ExtractionItem = {
  content: string;
  location?: ExtractionLocation;
};

export type ExtractionOutput = {
  kind: "PDF" | "XLSX";
  sha256: string;
  mimeType: string;
  fileSizeBytes: number;
  items: ExtractionItem[];
  warnings: string[];
  pageCount?: number;
  sheetCount?: number;
};

export async function extractDocument(input: ExtractionInput): Promise<ExtractionOutput> {
  const validated = await validateDocumentFile(input.file);
  if (validated.extension === ".pdf") {
    return extractPdf(input.file, validated);
  }
  return extractXlsx(validated);
}

async function extractPdf(file: ReviewDocumentFile, validated: Awaited<ReturnType<typeof validateDocumentFile>>): Promise<ExtractionOutput> {
  const extracted = await extractPdfImportFile(file);
  return {
    kind: "PDF",
    sha256: validated.sha256,
    mimeType: validated.mimeType,
    fileSizeBytes: validated.fileSizeBytes,
    items: extracted.text.trim() === "" ? [] : [{ content: normalizeText(extracted.text) }],
    pageCount: extracted.pageCount,
    warnings: [
      "El conteo de páginas PDF puede ser estimado; la ubicación exacta no está disponible porque el adaptador compatible no expone página ni bounding boxes verificables.",
    ],
  };
}

async function extractXlsx(validated: Awaited<ReturnType<typeof validateDocumentFile>>): Promise<ExtractionOutput> {
  const workbook = new ExcelJS.Workbook();
  const workbookInput = validated.bytes as unknown as Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(workbookInput);
  const warnings: string[] = getZipIndicatorWarnings(validated.bytes);
  const items: ExtractionItem[] = [];

  workbook.eachSheet((worksheet) => {
    const rows: string[][] = [];
    let minRow = Number.POSITIVE_INFINITY;
    let maxRow = 0;
    let minColumn = Number.POSITIVE_INFINITY;
    let maxColumn = 0;
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const values: string[] = [];
      let rowHasHyperlink = false;
      row.eachCell({ includeEmpty: false }, (cell) => {
        const normalized = normalizeCell(cell.value);
        const column = columnFromAddress(cell.address);
        values[column - 1] = normalized.text;
        rowHasHyperlink ||= normalized.hasHyperlink;
        if (normalized.text !== "") {
          minColumn = Math.min(minColumn, column);
          maxColumn = Math.max(maxColumn, column);
          minRow = Math.min(minRow, rowNumber);
          maxRow = Math.max(maxRow, rowNumber);
        }
      });
      if (rowHasHyperlink) {
        warnings.push(`La hoja ${worksheet.name} contiene un enlace; no se accedió ni ejecutó el enlace.`);
      }
      rows[rowNumber - 1] = values;
    });

    if (maxRow > 0) {
      const content = rows
        .slice(minRow - 1, maxRow)
        .map((row) => row.slice(minColumn - 1, maxColumn).map((value) => value ?? "").join("\t"))
        .join("\n");
      items.push({
        content,
        location: {
          sheet: worksheet.name,
          range: `${columnToLetters(minColumn)}${minRow}:${columnToLetters(maxColumn)}${maxRow}`,
        },
      });
    }
  });

  return {
    kind: "XLSX",
    sha256: validated.sha256,
    mimeType: validated.mimeType,
    fileSizeBytes: validated.fileSizeBytes,
    items,
    sheetCount: workbook.worksheets.length,
    warnings,
  };
}

function normalizeCell(value: ExcelJS.CellValue): { text: string; hasHyperlink: boolean } {
  if (value === null || value === undefined) {
    return { text: "", hasHyperlink: false };
  }
  if (typeof value === "object") {
    if ("formula" in value && typeof value.formula === "string") {
      return { text: `[FORMULA:${value.formula}]`, hasHyperlink: false };
    }
    if ("hyperlink" in value) {
      const text = "text" in value && typeof value.text === "string" ? value.text : "";
      return { text, hasHyperlink: true };
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      return { text: value.richText.map((part) => part.text).join(""), hasHyperlink: false };
    }
  }
  return { text: normalizeText(String(value)), hasHyperlink: false };
}

function getZipIndicatorWarnings(bytes: Uint8Array): string[] {
  const archiveText = new TextDecoder("latin1").decode(bytes);
  const warnings: string[] = [];
  if (/vbaProject\.bin|macros?/i.test(archiveText)) {
    warnings.push("El archivo contiene macros VBA; no se ejecutaron.");
  }
  if (/externalLinks|externalBook/i.test(archiveText)) {
    warnings.push("El archivo contiene enlaces externos; no se accedió a ellos.");
  }
  if (/\[[^\]]+\][^\s<]+!/i.test(archiveText) || /externalBook/i.test(archiveText)) {
    warnings.push("El archivo contiene fórmulas con referencias externas; no se evaluaron.");
  }
  if (/hyperlinks?/i.test(archiveText)) {
    warnings.push("El archivo contiene hipervínculos; no se accedió ni ejecutó ningún enlace.");
  }
  return warnings;
}

function normalizeText(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function columnToLetters(column: number): string {
  let result = "";
  let current = column;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}

function columnFromAddress(address: string): number {
  const letters = address.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? "A";
  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0);
}
