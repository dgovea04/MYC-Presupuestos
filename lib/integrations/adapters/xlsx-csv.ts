import { createHash } from "node:crypto";
import type { IntegrationAdapter, StagedIntegrationData, StagedIntegrationRow } from "../types";

export type XlsxCsvInput = { rows: readonly Record<string, unknown>[]; sourceName: string; requiredColumns?: readonly string[]; allowedUnits?: readonly string[] };
function text(value: unknown): string { return value === null || value === undefined ? "" : String(value).trim(); }
function normalizeDecimal(value: string): string {
  if (!value) return value;
  const normalized = value.replace(/\s/g, "");
  if (normalized.includes(",") && normalized.includes(".")) return normalized.lastIndexOf(",") > normalized.lastIndexOf(".") ? normalized.replace(/\./g, "").replace(",", ".") : normalized.replace(/,/g, "");
  return normalized.includes(",") ? normalized.replace(",", ".") : normalized;
}
export async function stageXlsxCsv(input: XlsxCsvInput): Promise<StagedIntegrationData> {
  const rows: StagedIntegrationRow[] = input.rows.map((row, index) => { const values = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, /cantidad|quantity|precio|price|unitprice|rendimiento/i.test(key) ? normalizeDecimal(text(value)) : text(value)])); return { externalKey: values.code || values.codigo || `row-${index + 1}`, values, provenance: { source: input.sourceName, row: index + 1 } }; });
  const conflicts = rows.flatMap((row, index) => { const result: { externalKey: string; kind: string; message: string }[] = []; if (rows.findIndex((candidate) => candidate.externalKey === row.externalKey) !== index) result.push({ externalKey: row.externalKey, kind: "DUPLICATE_EXTERNAL_KEY", message: "La clave externa está duplicada." }); for (const column of input.requiredColumns ?? []) if (!row.values[column]) result.push({ externalKey: row.externalKey, kind: "MISSING_REQUIRED_COLUMN", message: `Falta la columna obligatoria ${column}.` }); if (input.allowedUnits && row.values.unit && !input.allowedUnits.includes(row.values.unit)) result.push({ externalKey: row.externalKey, kind: "INCOMPATIBLE_UNIT", message: `La unidad ${row.values.unit} no es compatible.` }); for (const value of Object.values(row.values)) if (/^=/.test(value)) result.push({ externalKey: row.externalKey, kind: "FORMULA_NOT_EXECUTED", message: "Las fórmulas externas no se ejecutan durante staging." }); return result; });
  return { rows, conflicts, counts: { total: rows.length, valid: rows.length - conflicts.length, conflicts: conflicts.length }, payloadHash: createHash("sha256").update(JSON.stringify(rows)).digest("hex") };
}
export const xlsxCsvAdapter: IntegrationAdapter<XlsxCsvInput, StagedIntegrationData> = { id: "xlsx-csv", contractVersion: "1", capabilities: { import: true, export: true, rollback: true, formats: ["xlsx", "csv"] }, async stage(input) { return stageXlsxCsv(input); }, async validate(input) { return input; }, async preview(input) { return input; }, async apply(input) { return { appliedCount: input.rows.length }; }, async rollback(input) { return { rolledBackCount: input.rows.length }; } };
