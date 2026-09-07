import type { StagedIntegrationData, IntegrationConflict } from "./types";

export type IntegrationValidationResult = StagedIntegrationData & { blocking: boolean };
export async function validateStagedData(input: StagedIntegrationData): Promise<IntegrationValidationResult> {
  const conflicts: IntegrationConflict[] = [...input.conflicts];
  const seen = new Set<string>();
  for (const row of input.rows) {
    if (seen.has(row.externalKey)) conflicts.push({ externalKey: row.externalKey, kind: "DUPLICATE_EXTERNAL_KEY", message: "La clave externa está duplicada." });
    seen.add(row.externalKey);
  }
  return { ...input, conflicts, counts: { total: input.rows.length, valid: input.rows.length - conflicts.length, conflicts: conflicts.length }, blocking: conflicts.length > 0 };
}
