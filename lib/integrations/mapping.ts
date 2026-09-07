import type { StagedIntegrationRow } from "./types";

export type IntegrationUpdate = { id: string; description?: string; unit?: string; quantity?: string; unitPrice?: string };
export type UnresolvedIntegrationMapping = { externalKey: string; reason: "UNRESOLVED_MAPPING" };
export type IntegrationMappingResult = { updates: IntegrationUpdate[]; unresolved: UnresolvedIntegrationMapping[] };

const DECIMAL_PATTERN = /^-?(?:\d+|\d+\.\d+|\.\d+)$/;

function isDecimal(value: string | undefined): boolean {
  return value === undefined || DECIMAL_PATTERN.test(value.trim());
}

export function buildIntegrationUpdates(rows: readonly StagedIntegrationRow[]): IntegrationMappingResult {
  const updates: IntegrationUpdate[] = [];
  const unresolved: UnresolvedIntegrationMapping[] = [];
  for (const row of rows) {
    const quantity = row.values.quantity?.trim();
    const unitPrice = row.values.unitPrice?.trim();
    if (!row.internalCandidateId || !isDecimal(quantity) || !isDecimal(unitPrice)) {
      unresolved.push({ externalKey: row.externalKey, reason: "UNRESOLVED_MAPPING" });
      continue;
    }
    updates.push({
      id: row.internalCandidateId,
      ...(row.values.description ? { description: row.values.description } : {}),
      ...(row.values.unit ? { unit: row.values.unit } : {}),
      ...(quantity ? { quantity } : {}),
      ...(unitPrice ? { unitPrice } : {}),
    });
  }
  return { updates, unresolved };
}
