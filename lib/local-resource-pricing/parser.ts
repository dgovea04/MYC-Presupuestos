import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import { localResourcePriceRowSchema } from "@/lib/validations/local-resource-pricing";
import type { LocalResourcePriceRowInput } from "@/types/local-resource-pricing";

const HEADER_ALIASES = {
  resourceId: ["resourceid", "id", "insumoid", "idinsumo", "recursoid"],
  code: ["code", "codigo", "cod", "codigoinsumo", "insumocodigo"],
  description: ["description", "descripcion", "insumo", "recurso", "nombre"],
  unit: ["unit", "unidad", "und"],
  currency: ["currency", "moneda", "divisa"],
  proposedPrice: ["unitprice", "preciounitario", "precio", "price", "nuevoprecio", "preciovigente"],
  observedAt: ["observedat", "fecha", "fechaprecio", "fechaobservacion"],
  sourceLabel: ["source", "fuente", "fuenteprecio", "origen"],
  notes: ["notes", "notas", "observaciones", "comentario"],
} as const;

type ParsedCell = string | number | Date | null;

type HeaderKey = keyof typeof HEADER_ALIASES;

export function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function parseDecimalCell(value: ParsedCell) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return "";
  const normalized = value.trim().replace(/\s/g, "");
  if (!normalized) return "";
  const comma = normalized.lastIndexOf(",");
  const dot = normalized.lastIndexOf(".");
  if (comma > dot) return normalized.replace(/\./g, "").replace(",", ".");
  return normalized.replace(/,/g, "");
}

export function parseDateCell(value: ParsedCell) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = new Date(value.trim());
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export function extractRowsFromMatrix(matrix: ParsedCell[][]): LocalResourcePriceRowInput[] {
  const headerIndex = matrix.findIndex((row) => {
    const normalized = row.map((cell) => normalizeHeader(String(cell ?? "")));
    return normalized.some((value) => HEADER_ALIASES.code.includes(value as never)) && normalized.some((value) => HEADER_ALIASES.proposedPrice.includes(value as never));
  });
  if (headerIndex < 0) throw new Error("El Excel debe incluir encabezados de código y precio.");

  const header = matrix[headerIndex] ?? [];
  const headerMap = new Map<HeaderKey, number>();
  header.forEach((cell, index) => {
    const normalized = normalizeHeader(String(cell ?? ""));
    const key = (Object.keys(HEADER_ALIASES) as HeaderKey[]).find((candidate) => HEADER_ALIASES[candidate].includes(normalized as never));
    if (key) headerMap.set(key, index);
  });

  const rows: LocalResourcePriceRowInput[] = [];
  for (const row of matrix.slice(headerIndex + 1)) {
    if (row.every((cell) => cell == null || String(cell).trim() === "")) continue;
    const read = (key: HeaderKey) => headerMap.has(key) ? row[headerMap.get(key) ?? -1] ?? null : null;
    const candidate = {
      resourceId: textCell(read("resourceId")) || undefined,
      code: textCell(read("code")),
      description: textCell(read("description")) || textCell(read("code")),
      unit: textCell(read("unit")),
      currency: textCell(read("currency")).toUpperCase() || "PEN",
      proposedPrice: parseDecimalCell(read("proposedPrice")),
      observedAt: parseDateCell(read("observedAt")),
      sourceLabel: textCell(read("sourceLabel")) || undefined,
      notes: textCell(read("notes")) || undefined,
    } satisfies LocalResourcePriceRowInput;
    rows.push(candidate);
  }
  return rows;
}

export async function parseLocalResourcePriceWorkbook(buffer: ArrayBuffer | Uint8Array) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as Parameters<typeof workbook.xlsx.load>[0]);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("El archivo Excel no contiene hojas.");
  const matrix: ParsedCell[][] = [];
  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const values: ParsedCell[] = [];
    for (let column = 1; column <= worksheet.columnCount; column += 1) {
      const cell = row.getCell(column);
      values.push(cell.value instanceof Date ? cell.value : cell.text || scalarCell(cell.value));
    }
    matrix.push(values);
  }
  const rows = extractRowsFromMatrix(matrix);
  const bytes = buffer instanceof Uint8Array ? Buffer.from(buffer) : Buffer.from(new Uint8Array(buffer));
  return { rows, fileHash: createHash("sha256").update(bytes).digest("hex"), worksheetName: worksheet.name };
}

export function validateParsedRows(rows: LocalResourcePriceRowInput[]) {
  return rows.map((row, index) => {
    const parsed = localResourcePriceRowSchema.safeParse(row);
    return {
      rowNumber: index + 2,
      value: row,
      error: parsed.success ? null : parsed.error.issues.map((issue) => issue.message).join("; "),
    };
  });
}

function textCell(value: ParsedCell) {
  if (value == null) return "";
  return String(value).trim();
}

function scalarCell(value: ExcelJS.CellValue): string | number | null {
  if (typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  return null;
}
