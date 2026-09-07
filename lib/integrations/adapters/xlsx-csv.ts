import { createHash } from "node:crypto";
import type { IntegrationAdapter, StagedIntegrationData, StagedIntegrationRow } from "../types";

export type XlsxCsvInput = { rows: readonly Record<string, unknown>[]; sourceName: string };
function text(value: unknown): string { return value === null || value === undefined ? "" : String(value).trim(); }
export async function stageXlsxCsv(input: XlsxCsvInput): Promise<StagedIntegrationData> {
  const rows: StagedIntegrationRow[] = input.rows.map((row, index) => { const values = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, text(value)])); return { externalKey: values.code || values.codigo || `row-${index + 1}`, values, provenance: { source: input.sourceName, row: index + 1 } }; });
  const conflicts = rows.filter((row, index) => rows.findIndex((candidate) => candidate.externalKey === row.externalKey) !== index).map((row) => ({ externalKey: row.externalKey, kind: "DUPLICATE_EXTERNAL_KEY", message: "La clave externa está duplicada." }));
  return { rows, conflicts, counts: { total: rows.length, valid: rows.length - conflicts.length, conflicts: conflicts.length }, payloadHash: createHash("sha256").update(JSON.stringify(rows)).digest("hex") };
}
export const xlsxCsvAdapter: IntegrationAdapter<XlsxCsvInput, StagedIntegrationData> = { id: "xlsx-csv", contractVersion: "1", capabilities: { import: true, export: true, rollback: true, formats: ["xlsx", "csv"] }, async stage(input) { return stageXlsxCsv(input); }, async validate(input) { return input; } };
