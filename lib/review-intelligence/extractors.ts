import ExcelJS from "exceljs";
import JSZip from "jszip";

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
  metadata?: { code?: string; description?: string; quantity?: string; unit?: string; spec?: string; discipline?: string; attributes?: Record<string, string>; evidenceType?: "QUANTITY" | "UNIT" | "TECHNICAL_SPECIFICATION" | "OTHER" };
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
  const warnings: string[] = await getZipIndicatorWarnings(validated.bytes);
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
        metadata: metadataFromRows(rows, minRow, maxRow, minColumn, maxColumn),
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

function metadataFromRows(rows: string[][], minRow: number, maxRow: number, minColumn: number, maxColumn: number): ExtractionItem["metadata"] {
  const headers = rows[minRow - 1]?.slice(minColumn - 1, maxColumn).map((value) => normalizeText(value ?? "")) ?? [];
  const values = rows[minRow]?.slice(minColumn - 1, maxColumn) ?? [];
  const find = (patterns: RegExp[]): string | undefined => { const index = headers.findIndex((header) => patterns.some((pattern) => pattern.test(header))); const value = index >= 0 ? values[index] : undefined; return value?.trim() || undefined; };
  const metadata = { code: find([/c.{0,2}dig/i, /^id$/i]), description: find([/desc/i, /partida/i]), quantity: find([/cant/i, /metr/i, /qty/i]), unit: find([/^uni/i, /^unit/i]), spec: find([/spec/i, /tecn/i]), discipline: find([/disc/i, /especial/i]), attributes: {} };
  const evidenceType = metadata.quantity ? "QUANTITY" : metadata.unit ? "UNIT" : metadata.spec ? "TECHNICAL_SPECIFICATION" : "OTHER";
  return Object.values(metadata).some((value) => typeof value === "string" && value.length > 0) ? { ...metadata, evidenceType } : undefined;
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

async function getZipIndicatorWarnings(bytes: Uint8Array): Promise<string[]> {
  const zip = await JSZip.loadAsync(bytes);
  const entries = Object.entries(zip.files).filter(([, entry]) => !entry.dir);
  const names = entries.map(([name]) => name);
  const xmlContents = await Promise.all(entries
    .filter(([name]) => name.toLowerCase().endsWith(".xml"))
    .map(async ([name, entry]) => ({ name, content: await entry.async("string") })));
  const warnings: string[] = [];
  if (names.some((name) => /vbaProject\.bin$/i.test(name))) {
    warnings.push("El archivo contiene macros VBA; no se ejecutaron.");
  }
  if (names.some((name) => /externalLinks\//i.test(name)) || xmlContents.some(({ content }) => /externalBook/i.test(content))) {
    warnings.push("El archivo contiene enlaces externos; no se accedió a ellos.");
  }
  if (xmlContents.some(({ content }) => /\[[^\]]+\][^<]*!/i.test(content) || /<f[^>]*>[^<]*\[[^\]]+\]/i.test(content))) {
    warnings.push("El archivo contiene fórmulas con referencias externas; no se evaluaron.");
  }
  if (xmlContents.some(({ name, content }) => /worksheets\//i.test(name) && /<hyperlink(?:\s|>)/i.test(content))) {
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
