import ExcelJS from "exceljs";
import JSZip from "jszip";

import { extractDigitalPdf } from "@/lib/pdf-import/digital-extraction";
import { validateDocumentFile, type ReviewDocumentFile } from "./documents";
import { createOcrAdapter, type OcrAdapter } from "./ocr";
import { classifyEvidenceType, normalizeEvidenceMetadata, parseDecimalText } from "./normalization";
import type { ConfidenceLevel, ExtractionCoverage, ExtractionMethod } from "./types";
import { parseReviewCsv } from "./csv";

export type ExtractionInput = {
  file: ReviewDocumentFile;
  ocr?: { adapter?: OcrAdapter; companyId: string; projectId: string; documentVersionId: string };
  xlsxSheetNames?: string[];
  selectedPageNumbers?: number[];
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
  metadata?: { code?: string; description?: string; quantity?: string; unit?: string; yield?: string; spec?: string; technicalSpec?: string; technicalSpecification?: string; discipline?: string; attributes?: Record<string, string>; apuComponents?: string[]; evidenceType?: "QUANTITY" | "UNIT" | "TECHNICAL_SPECIFICATION" | "APU_COMPONENT" | "OTHER" };
  extractionMethod?: ExtractionMethod;
  confidence?: ConfidenceLevel;
};

export type ExtractionCoverageRecord = { page?: number; worksheet?: string; coverage: ExtractionCoverage; method?: ExtractionMethod; confidence?: ConfidenceLevel; warnings?: string[] };
export type PdfPageCoverage = ExtractionCoverageRecord & { page: number };

export type ExtractionOutput = {
  kind: "PDF" | "XLSX" | "CSV";
  sha256: string;
  mimeType: string;
  fileSizeBytes: number;
  items: ExtractionItem[];
  warnings: string[];
  pageCount?: number;
  sheetCount?: number;
  coverage?: ExtractionCoverageRecord[];
  extractionMethod?: ExtractionMethod;
  extractionConfidence?: ConfidenceLevel;
};

export async function extractDocument(input: ExtractionInput): Promise<ExtractionOutput> {
  const validated = await validateDocumentFile(input.file);
  if (validated.extension === ".pdf") {
    return extractPdf(input, validated);
  }
  if (validated.extension === ".csv") return extractCsv(validated);
  return extractXlsx(validated, input.xlsxSheetNames);
}

function extractCsv(validated: Awaited<ReturnType<typeof validateDocumentFile>>): ExtractionOutput {
  const parsed = parseReviewCsv(validated.bytes);
  return { kind: "CSV", sha256: validated.sha256, mimeType: validated.mimeType, fileSizeBytes: validated.fileSizeBytes, items: parsed.rows.map((row) => ({ content: row.values.join("\t"), primary: true, location: { row: row.location.row, range: `A${row.location.row}:${columnToLetters(Math.max(1, row.values.length))}${row.location.row}` }, metadata: metadataFromHeaders(parsed.headers, row.values), extractionMethod: "CSV_CELL_RANGE", confidence: "MEDIUM" })), warnings: parsed.warnings, sheetCount: 1, coverage: [{ worksheet: validated.extension, coverage: "PROCESSED", method: "CSV_CELL_RANGE", confidence: "MEDIUM", warnings: parsed.warnings }] };
}

async function extractPdf(input: ExtractionInput, validated: Awaited<ReturnType<typeof validateDocumentFile>>): Promise<ExtractionOutput> {
  const digital = await extractDigitalPdf(await input.file.arrayBuffer());
  const selectedPages = input.selectedPageNumbers?.length ? new Set(input.selectedPageNumbers) : undefined;
  const pages = selectedPages ? digital.pages.filter((page) => selectedPages.has(page.page)) : digital.pages;
  const coverage: PdfPageCoverage[] = pages.map((page) => hasSufficientDigitalText(page.text)
    ? { page: page.page, coverage: "PROCESSED", method: "PDF_TEXT", confidence: "MEDIUM", warnings: [] }
    : { page: page.page, coverage: "OCR_REQUIRED", method: "PDF_TEXT", confidence: "LOW", warnings: [] });
  const items: ExtractionItem[] = pages.flatMap((page) => extractPdfEvidence(page.text, page.page).map((item) => ({ ...item, extractionMethod: "PDF_TEXT" as const, confidence: "MEDIUM" as const })));
  const uncoveredPages = pages.filter((page) => !hasSufficientDigitalText(page.text));
  const pageWarnings: string[] = [];
  if (uncoveredPages.length > 0 && input.ocr) {
    const result = await createOcrAdapter(input.ocr.adapter).extractPages({ companyId: input.ocr.companyId, projectId: input.ocr.projectId, documentVersionId: input.ocr.documentVersionId, mimeType: "application/pdf", fileName: input.file.name, pdfBytes: validated.bytes, pages: uncoveredPages.map((page) => ({ pageNumber: page.page, selectableText: page.text })) });
    const resultsByPage = new Map(result.pages.map((page) => [page.pageNumber, page]));
    for (const page of uncoveredPages) {
      const ocrPage = resultsByPage.get(page.page);
      const warnings = ocrPage?.warnings ?? ["OCR provider did not return a result for this page."];
      const at = coverage.findIndex((entry) => entry.page === page.page);
      coverage[at] = { page: page.page, coverage: ocrPage?.coverage ?? "FAILED", method: result.method, confidence: result.confidence, warnings };
      pageWarnings.push(...warnings.map((warning) => `Page ${page.page}: ${warning}`));
      if (ocrPage?.coverage === "PROCESSED" && ocrPage.text) items.push(...extractPdfEvidence(ocrPage.text, page.page).map((item) => ({ ...item, extractionMethod: result.method, confidence: result.confidence })));
    }
  } else {
    for (const page of uncoveredPages) {
      const warning = "OCR is required but extraction was not configured.";
      const at = coverage.findIndex((entry) => entry.page === page.page);
      coverage[at] = { ...coverage[at]!, warnings: [warning] };
      pageWarnings.push(`Page ${page.page}: ${warning}`);
    }
  }
  const hasProcessedOcr = coverage.some((entry) => entry.method === "OCR_PROVIDER" && entry.coverage === "PROCESSED");
  return {
    kind: "PDF",
    sha256: validated.sha256,
    mimeType: validated.mimeType,
    fileSizeBytes: validated.fileSizeBytes,
    items,
    pageCount: digital.pageCount,
    coverage,
    extractionMethod: hasProcessedOcr ? "OCR_PROVIDER" : "PDF_TEXT",
    extractionConfidence: coverage.some((entry) => entry.method === "OCR_PROVIDER" && entry.confidence === "HIGH") ? "HIGH" : "MEDIUM",
    warnings: [
      "El conteo de páginas PDF puede ser estimado; la ubicación exacta no está disponible porque el adaptador compatible no expone página ni bounding boxes verificables.",
      ...pageWarnings,
    ],
  };
}

async function extractXlsx(validated: Awaited<ReturnType<typeof validateDocumentFile>>, selectedSheetNames?: string[]): Promise<ExtractionOutput> {
  const workbook = new ExcelJS.Workbook();
  const workbookInput = validated.bytes as unknown as Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(workbookInput);
  const warnings: string[] = await getZipIndicatorWarnings(validated.bytes);
  const items: ExtractionItem[] = [];
  const processedWorksheets = new Set<string>();

  const selectedSheets = selectedSheetNames?.length ? new Set(selectedSheetNames) : undefined;
  workbook.eachSheet((worksheet) => {
    if (selectedSheets && !selectedSheets.has(worksheet.name)) return;
    processedWorksheets.add(worksheet.name);
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
      const headerRow = findHeaderRow(rows, minRow, maxRow, minColumn, maxColumn);
      const headers = rows[headerRow - 1]?.slice(minColumn - 1, maxColumn).map((value) => normalizeText(value ?? "")) ?? [];
      const structured = headers.some((header) => /desc|partida|spec|tecn|disciplina|apu|componente/i.test(header)) && maxRow > headerRow;
      if (structured) {
        for (let rowNumber = headerRow + 1; rowNumber <= maxRow; rowNumber += 1) {
          const row = rows[rowNumber - 1] ?? [];
          const rowContent = row.slice(minColumn - 1, maxColumn).map((value) => value ?? "").join("\t").trim();
          if (rowContent) {
            warnings.push(...invalidNumericWarnings(headers, row.slice(minColumn - 1, maxColumn), worksheet.name, rowNumber));
            items.push({ content: rowContent, primary: true, location: { sheet: worksheet.name, range: `${columnToLetters(minColumn)}${rowNumber}:${columnToLetters(maxColumn)}${rowNumber}` }, metadata: metadataFromRows(rows, headerRow, rowNumber, minColumn, maxColumn) });
          }
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
    coverage: [...processedWorksheets].map((worksheet) => ({ worksheet, coverage: "PROCESSED" as const, method: "XLSX_CELL_RANGE" as const, confidence: "MEDIUM" as const, warnings: [] })),
    warnings,
  };
}

function findHeaderRow(rows: string[][], minRow: number, maxRow: number, minColumn: number, maxColumn: number): number {
  for (let rowNumber = minRow; rowNumber <= maxRow; rowNumber += 1) {
    const headers = rows[rowNumber - 1]?.slice(minColumn - 1, maxColumn).map((value) => normalizeText(value ?? "")) ?? [];
    const hasDescription = headers.some((header) => /desc|partida/i.test(header));
    const hasQuantity = headers.some((header) => /cant|metr|qty/i.test(header));
    const hasResource = headers.some((header) => /recurso|componente/i.test(header));
    if ((hasDescription || hasResource) && hasQuantity) return rowNumber;
  }
  return minRow;
}

function metadataFromRows(rows: string[][], minRow: number, maxRow: number, minColumn: number, maxColumn: number): ExtractionItem["metadata"] {
  const headers = rows[minRow - 1]?.slice(minColumn - 1, maxColumn).map((value) => normalizeText(value ?? "")) ?? [];
  const values = rows[maxRow - 1]?.slice(minColumn - 1, maxColumn) ?? [];
  return metadataFromHeaders(headers, values);
}

function invalidNumericWarnings(headers: string[], values: string[], worksheet: string, row: number): string[] {
  const warnings: string[] = [];
  headers.forEach((header, index) => {
    if (!/^(quantity|cantidad|metrado|qty|yield|rendimiento|performance)$/i.test(headerKey(header))) return;
    const value = values[index]?.trim() ?? "";
    if (value && parseDecimalText(value) === undefined) warnings.push(`Hoja ${worksheet}, fila ${row}: valor numérico inválido en ${header}.`);
  });
  return warnings;
}

function metadataFromHeaders(headers: string[], values: string[]): ExtractionItem["metadata"] {
  const entries = headers.map((header, index) => [header, values[index]?.trim() ?? ""] as const);
  const find = (matches: (header: string) => boolean): string | undefined => entries.find(([header]) => matches(header))?.[1] || undefined;
  const code = find((header) => /^(codigo|code|cod|id|item)( de)?( partida)?$/.test(headerKey(header))) ?? values.find(isCodeLike);
  const description = find((header) => /^(descripcion|nombre|concepto|actividad|partida)$/.test(headerKey(header)))
    ?? values.find((value) => value !== code && isDescriptionLike(value));
  return normalizedExtractionMetadata({
    code,
    description,
    quantity: find((header) => /^(quantity|cantidad|metrado|qty)$/.test(headerKey(header))),
    unit: find((header) => /^(unit|unidad)$/.test(headerKey(header))),
    yield: find((header) => /^(yield|rendimiento|performance)$/.test(headerKey(header))),
    technicalSpecification: find((header) => {
      const key = headerKey(header);
      return key.includes("spec") || key.includes("tecn") || key.includes("especific");
    }),
    discipline: find((header) => /^(discipline|disciplina|especialidad)$/.test(headerKey(header))),
    apuComponents: find((header) => /apu|componente|recurso/.test(headerKey(header)) && !/tipo recurso|cantidad recurso/.test(headerKey(header))),
    attributes: Object.fromEntries(entries),
  });
}

function isCodeLike(value: string): boolean { return /^[A-Za-z]?\d+(?:[.\-][A-Za-z0-9]+)+$/.test(value.trim()); }

function isDescriptionLike(value: string): boolean {
  const normalized = value.trim();
  return normalized.length >= 3 && /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(normalized) && !/^\[FORMULA:/i.test(normalized);
}


function extractPdfEvidence(text: string, page = 1): ExtractionItem[] {
  return text.split("\f").flatMap((pageText, pageIndex) => {
    const lines = pageText.split(/\r?\n/).map(normalizeText).filter((line) => line && !/^%PDF|^xref|^trailer|^startxref|^endobj|^endstream|^BT|^ET/i.test(line)).flatMap(splitPdfEvidenceLines);
    return lines.map((line) => {
    const metadata = metadataFromPdfLine(line);
      const start = text.indexOf(line);
      return { content: line, primary: true, location: { page: page + pageIndex, textOffsetStart: start >= 0 ? start : undefined, textOffsetEnd: start >= 0 ? start + line.length : undefined }, metadata };
    });
  }).filter((item) => item.metadata !== undefined) as ExtractionItem[];
}

function splitPdfEvidenceLines(line: string): string[] {
  const parts = line.split(/(?=\d+(?:\.\d+)+\s*[-:])/g).map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts.slice(1) : parts;
}

function metadataFromPdfLine(line: string): ExtractionItem["metadata"] {
  const codeMatch = line.match(/^([A-Za-z0-9]+(?:[.\-][A-Za-z0-9]+)+)\s+/);
  const number = line.match(/(-?\d+(?:[.,]\d+)?)\s*(m3|m²|m2|m|kg|und|unidad|l|lt|glb)\b/i) ?? line.match(/(m3|m²|m2|m|kg|und|unidad|l|lt|glb)\s+(-?\d+(?:[.,]\d+)?)/i);
  const quantity = number ? (number[2] && /^[A-Za-z]/.test(number[1] ?? "") ? number[2] : number[1]) : undefined;
  const unit = number ? (number[2] && /^[A-Za-z]/.test(number[1] ?? "") ? number[1] : number[2]) : undefined;
  const explicitUnit = line.match(/\b(?:unidad|und)\s*:\s*([A-Za-z0-9²]+)/i)?.[1];
  const specification = line.match(/(?:especificacion(?: tecnica)?|especificaci\u00f3n(?: t\u00e9cnica)?|especificaciÃ³n(?: tÃ©cnica)?|technical specification|spec)\s*:\s*([^|]+)/i)?.[1]?.trim();
  const yieldValue = line.match(/(?:yield|rendimiento|performance)\s*:\s*([^|]+)/i)?.[1]?.trim();
  const apuComponents = line.match(/(?:apu(?: componentes?)?|componentes?|recurso(?:s)?)\s*:\s*([^|]+)/i)?.[1]?.trim();
  if (!codeMatch && !number && !explicitUnit && !specification && !yieldValue && !apuComponents) return undefined;
  const unitIndex = line.search(/\b(?:unidad|und)\s*:/i);
  const descriptionEnd = number?.index ?? (unitIndex >= 0 ? unitIndex : line.length);
  return normalizedExtractionMetadata({ code: codeMatch?.[1], description: line.slice(codeMatch?.[0].length ?? 0, descriptionEnd).replace(/\s*\|.*$/, "").trim() || undefined, quantity, unit: unit ?? explicitUnit, technicalSpecification: specification, yield: yieldValue, apuComponents });
}

function normalizedExtractionMetadata(metadata: Record<string, unknown>): ExtractionItem["metadata"] {
  const normalized = normalizeEvidenceMetadata(metadata);
  const technicalSpecification = normalized.technicalSpecification;
  const rawUnit = typeof metadata.unit === "string" && metadata.unit.trim() !== "" ? metadata.unit.trim() : undefined;
  const result = {
    code: normalized.code,
    description: normalized.description,
    quantity: normalized.quantity?.toString(),
    unit: rawUnit ?? normalized.unit,
    yield: normalized.yield?.toString(),
    spec: technicalSpecification,
    technicalSpec: technicalSpecification,
    technicalSpecification,
    discipline: normalized.discipline,
    attributes: normalized.attributes,
    apuComponents: normalized.apuComponents,
    evidenceType: classifyEvidenceType(normalized),
  };
  return Object.fromEntries(Object.entries(result).filter(([, value]) => value !== undefined)) as ExtractionItem["metadata"];
}

function headerKey(value: string): string {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ");
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

function hasSufficientDigitalText(value: string): boolean {
  const normalized = normalizeText(value);
  const meaningfulTokens = normalized.match(/[\p{L}\p{N}]{2,}/gu) ?? [];
  const alphanumericCharacters = normalized.match(/[\p{L}\p{N}]/gu) ?? [];
  return normalized.length >= 12 && meaningfulTokens.length >= 2 && alphanumericCharacters.length / normalized.length >= 0.5;
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
