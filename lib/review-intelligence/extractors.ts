import ExcelJS from "exceljs";
import JSZip from "jszip";

import { extractPdfImportFile } from "@/lib/pdf-import/extraction";
import { validateDocumentFile, type ReviewDocumentFile } from "./documents";

export type ExtractionInput = {
  file: ReviewDocumentFile;
};

export type ExtractionLocation = {
  page?: number;
  sheet?: string;
  range?: string;
  textOffsetStart?: number;
  textOffsetEnd?: number;
};

export type ExtractionItem = {
  content: string;
  primary?: boolean;
  location?: ExtractionLocation;
  metadata?: { code?: string; description?: string; quantity?: string; unit?: string; spec?: string; technicalSpec?: string; discipline?: string; attributes?: Record<string, string>; apuComponents?: string[]; evidenceType?: "QUANTITY" | "UNIT" | "TECHNICAL_SPECIFICATION" | "APU_COMPONENT" | "OTHER" };
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
  const text = normalizeText(extracted.text);
  return {
    kind: "PDF",
    sha256: validated.sha256,
    mimeType: validated.mimeType,
    fileSizeBytes: validated.fileSizeBytes,
    items: extractPdfEvidence(text),
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
      const headers = rows[minRow - 1]?.slice(minColumn - 1, maxColumn).map((value) => normalizeText(value ?? "")) ?? [];
      const structured = headers.some((header) => /desc|partida|spec|tecn|disciplina|apu|componente/i.test(header)) && maxRow > minRow;
      if (structured) {
        for (let rowNumber = minRow + 1; rowNumber <= maxRow; rowNumber += 1) {
          const row = rows[rowNumber - 1] ?? [];
          const rowContent = row.slice(minColumn - 1, maxColumn).map((value) => value ?? "").join("\t").trim();
          if (rowContent) items.push({ content: rowContent, primary: true, location: { sheet: worksheet.name, range: `${columnToLetters(minColumn)}${rowNumber}:${columnToLetters(maxColumn)}${rowNumber}` }, metadata: metadataFromRows(rows, minRow, rowNumber, minColumn, maxColumn) });
        }
      } else items.push({ content, primary: true, location: { sheet: worksheet.name, range: `${columnToLetters(minColumn)}${minRow}:${columnToLetters(maxColumn)}${maxRow}` }, metadata: metadataFromRows(rows, minRow, maxRow, minColumn, maxColumn) });
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
  const values = rows[maxRow - 1]?.slice(minColumn - 1, maxColumn) ?? [];
  const find = (patterns: RegExp[]): string | undefined => { const index = headers.findIndex((header) => patterns.some((pattern) => pattern.test(header))); const value = index >= 0 ? values[index] : undefined; return value?.trim() || undefined; };
  const spec = find([/spec/i, /tecn/i]);
  const apuComponents = find([/apu/i, /componente/i])?.split(/[;,|]/).map((value) => value.trim()).filter(Boolean);
  const metadata = { code: find([/c.{0,2}dig/i, /^id$/i]), description: find([/desc/i, /partida/i]), quantity: find([/cant/i, /metr/i, /qty/i]), unit: find([/^uni/i, /^unit/i]), spec, technicalSpec: spec, discipline: find([/disc/i, /especial/i]), attributes: {}, apuComponents };
  const evidenceType = metadata.quantity ? "QUANTITY" : metadata.unit ? "UNIT" : metadata.spec ? "TECHNICAL_SPECIFICATION" : "OTHER";
  return Object.values(metadata).some((value) => typeof value === "string" && value.length > 0 || Array.isArray(value) && value.length > 0) ? { ...metadata, evidenceType } : undefined;
}

function extractPdfEvidence(text: string): ExtractionItem[] {
  return text.split("\f").flatMap((pageText, pageIndex) => {
    const candidates = [...pageText.matchAll(/\(([^()\r\n]{3,})\)/g)].map((match) => match[1] ?? "");
    const lines = (candidates.length > 0 ? candidates : pageText.split(/\r?\n/)).map(normalizeText).filter((line) => line && !/^%PDF|^xref|^trailer|^startxref|^endobj|^endstream|^BT|^ET/i.test(line));
    return lines.map((line) => {
    const metadata = metadataFromPdfLine(line);
      const start = text.indexOf(line);
      return { content: line, primary: true, location: { page: pageIndex + 1, textOffsetStart: start >= 0 ? start : undefined, textOffsetEnd: start >= 0 ? start + line.length : undefined }, metadata };
    });
  }).filter((item) => item.metadata !== undefined) as ExtractionItem[];
}

function metadataFromPdfLine(line: string): ExtractionItem["metadata"] {
  const codeMatch = line.match(/^([A-Za-z0-9]+(?:[.\-][A-Za-z0-9]+)+)\s+/);
  const number = line.match(/(-?\d+(?:[.,]\d+)?)\s*(m3|m²|m2|m|kg|und|unidad|l|lt|glb)\b/i) ?? line.match(/(m3|m²|m2|m|kg|und|unidad|l|lt|glb)\s+(-?\d+(?:[.,]\d+)?)/i);
  if (!codeMatch && !number) return undefined;
  const quantity = number ? (number[2] && /^[A-Za-z]/.test(number[1] ?? "") ? number[2] : number[1]) : undefined;
  const unit = number ? (number[2] && /^[A-Za-z]/.test(number[1] ?? "") ? number[1] : number[2]) : undefined;
  return { code: codeMatch?.[1], description: line.slice(codeMatch?.[0].length ?? 0, number?.index ?? line.length).trim() || undefined, quantity: quantity?.replace(",", "."), unit, evidenceType: number ? "QUANTITY" : "OTHER" };
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
