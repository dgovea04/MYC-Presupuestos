import type { IntegrationAdapter, StagedIntegrationData } from "../types";
import { createS10ImportDraftPreview, parseS10ExportSnapshotJson, type S10ImportDraftPreview } from "@/lib/s10/import-preview";
import type { S10ExportSnapshot } from "@/lib/s10/import-mapper";
import { stageXlsxCsv } from "./xlsx-csv";
export type S10Input = { snapshot?: S10ExportSnapshot; snapshotJson?: string; rows?: readonly Record<string, unknown>[]; sourceName?: string };
export async function stageS10(input: S10Input): Promise<StagedIntegrationData> {
  if (input.snapshot || input.snapshotJson) {
    const snapshot = input.snapshot ?? parseS10ExportSnapshotJson(input.snapshotJson!);
    const preview = createS10ImportDraftPreview(snapshot);
    return stagePreview(preview, input.sourceName ?? "s10");
  }
  return stageXlsxCsv({ rows: input.rows ?? [], sourceName: input.sourceName ?? "s10" });
}

function stagePreview(preview: S10ImportDraftPreview, sourceName: string): StagedIntegrationData {
  const rows = preview.sampleItems.map((item, index) => ({
    externalKey: item.code || `s10-row-${index + 1}`,
    values: { code: item.code, description: item.description, unit: item.unit, quantity: String(item.quantity), unitPrice: String(item.unitPrice), partial: String(item.partial), apuStatus: item.apuStatus },
    provenance: { source: sourceName, row: index + 1 },
  }));
  const conflicts = preview.warnings.map((message) => ({ externalKey: "S10", kind: "PARSER_WARNING", message }));
  return { rows, conflicts, counts: { total: rows.length, valid: Math.max(0, rows.length - conflicts.length), conflicts: conflicts.length }, payloadHash: JSON.stringify({ source: preview.source, sourceBudgetCode: preview.sourceBudgetCode, rows }) };
}
export const s10Adapter: IntegrationAdapter<S10Input, StagedIntegrationData> = { id: "s10", contractVersion: "1", capabilities: { import: true, export: true, rollback: true, formats: ["s10", "s2k"] }, async stage(input) { return stageS10(input); }, async validate(input) { return input; }, async preview(input) { return input; }, async apply(input) { return { appliedCount: input.rows.length }; }, async rollback(input) { return { rolledBackCount: input.rows.length }; } };
