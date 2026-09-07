import { createHash } from "node:crypto";
import { extractDocument, type ExtractionOutput } from "@/lib/review-intelligence/extractors";
import type { IntegrationAdapter, StagedIntegrationData, StagedIntegrationRow } from "../types";

export type XlsxCsvInput = { rows?: readonly Record<string, unknown>[]; buffer?: Buffer | Uint8Array; sourceName: string; requiredColumns?: readonly string[]; allowedUnits?: readonly string[]; format?: ".xlsx" | ".csv" };
function text(value: unknown): string { return value === null || value === undefined ? "" : String(value).trim(); }
function normalizeDecimal(value: string): string {
  if (!value) return value;
  const normalized = value.replace(/\s/g, "");
  if (normalized.includes(",") && normalized.includes(".")) return normalized.lastIndexOf(",") > normalized.lastIndexOf(".") ? normalized.replace(/\./g, "").replace(",", ".") : normalized.replace(/,/g, "");
  return normalized.includes(",") ? normalized.replace(",", ".") : normalized;
}
export async function stageXlsxCsv(input: XlsxCsvInput): Promise<StagedIntegrationData> {
  const sourceRows = input.rows ?? (input.buffer ? await parseWithRealDocumentParser(input) : []);
  const rows: StagedIntegrationRow[] = sourceRows.map((row, index) => { const values = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, /cantidad|quantity|precio|price|unitprice|rendimiento/i.test(key) ? normalizeDecimal(text(value)) : text(value)])); return { externalKey: values.code || values.codigo || `row-${index + 1}`, values, provenance: { source: input.sourceName, row: index + 1 } }; });
  const conflicts = rows.flatMap((row, index) => { const result: { externalKey: string; kind: string; message: string }[] = []; if (rows.findIndex((candidate) => candidate.externalKey === row.externalKey) !== index) result.push({ externalKey: row.externalKey, kind: "DUPLICATE_EXTERNAL_KEY", message: "La clave externa está duplicada." }); for (const column of input.requiredColumns ?? []) if (!row.values[column]) result.push({ externalKey: row.externalKey, kind: "MISSING_REQUIRED_COLUMN", message: `Falta la columna obligatoria ${column}.` }); if (input.allowedUnits && row.values.unit && !input.allowedUnits.includes(row.values.unit)) result.push({ externalKey: row.externalKey, kind: "INCOMPATIBLE_UNIT", message: `La unidad ${row.values.unit} no es compatible.` }); for (const value of Object.values(row.values)) if (/^=/.test(value)) result.push({ externalKey: row.externalKey, kind: "FORMULA_NOT_EXECUTED", message: "Las fórmulas externas no se ejecutan durante staging." }); return result; });
  return { rows, conflicts, counts: { total: rows.length, valid: rows.length - conflicts.length, conflicts: conflicts.length }, payloadHash: createHash("sha256").update(JSON.stringify(rows)).digest("hex") };
}

async function parseWithRealDocumentParser(input: XlsxCsvInput): Promise<readonly Record<string, unknown>[]> {
  const extension = input.format ?? (input.sourceName.toLowerCase().endsWith(".csv") ? ".csv" : ".xlsx");
  const mimeType = extension === ".csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const bytes = new Uint8Array(input.buffer!.byteLength);
  bytes.set(input.buffer!);
  const file = new File([bytes.buffer], input.sourceName, { type: mimeType });
  const extracted = await extractDocument({ file });
  return extractionRows(extracted);
}

function extractionRows(extracted: ExtractionOutput): readonly Record<string, unknown>[] {
  return extracted.items.map((item) => ({
    code: item.metadata?.code ?? "",
    description: item.metadata?.description ?? item.content,
    quantity: item.metadata?.quantity ?? "",
    unit: item.metadata?.unit ?? "",
    technicalSpec: item.metadata?.technicalSpec ?? item.metadata?.technicalSpecification ?? "",
    sourceSheet: item.location?.sheet ?? "",
    sourceRange: item.location?.range ?? "",
  }));
}
export const xlsxCsvAdapter: IntegrationAdapter<XlsxCsvInput, StagedIntegrationData> = { id: "xlsx-csv", contractVersion: "1", capabilities: { import: true, export: true, rollback: true, formats: ["xlsx", "csv"] }, async stage(input) { return stageXlsxCsv(input); }, async validate(input) { return input; }, async preview(input) { return input; }, async apply(input) { return { appliedCount: input.rows.length }; }, async rollback(input) { return { rolledBackCount: input.rows.length }; } };
