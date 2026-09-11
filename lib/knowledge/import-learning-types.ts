import type Decimal from "decimal.js";

export const importLearningDomains = ["ITEM", "RESOURCE", "PRICE", "YIELD", "APU"] as const;
export type ImportLearningDomain = (typeof importLearningDomains)[number];

export type ImportLearningSourceType =
  | "S10_IMPORT"
  | "MCP_IMPORT"
  | "RW7_IMPORT"
  | "PDF_IMPORT"
  | "DB_IMPORT"
  | "DELPHIN_IMPORT";

export type ImportLearningConfidence = "VERY_LOW" | "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";

export type ImportLearningEvidence = {
  originalRecordId: string;
  fileName?: string;
  page?: string;
  sheet?: string;
  cellRange?: string;
  quote?: string;
  checksum?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type ImportLearningEntityCandidate = {
  domain: "ITEM" | "RESOURCE";
  name: string;
  unit?: string;
  category?: string;
  alias?: string;
};

export type ImportLearningObservation = {
  domain: ImportLearningDomain;
  originalRecordId: string;
  value: Record<string, unknown>;
  name?: string;
  unit?: string;
  currency?: string;
  confidence: ImportLearningConfidence;
  observedAt?: Date;
  evidence: ImportLearningEvidence;
  entity?: ImportLearningEntityCandidate;
};

export type ImportLearningBatch = {
  importId: string;
  sourceType: ImportLearningSourceType;
  sourceLabel: string;
  companyId: string;
  projectId: string;
  createdById: string;
  observedAt?: Date;
  observations: readonly ImportLearningObservation[];
};

export type ImportLearningBatchResult = {
  sourceId: string;
  observationIds: string[];
  assertionIds: string[];
  created: number;
  skipped: Array<{ originalRecordId: string; domain: ImportLearningDomain; reason: string }>;
  conflicts: Array<{ originalRecordId: string; domain: ImportLearningDomain; reason: string }>;
};

export function confidenceFromScore(score: number): ImportLearningConfidence {
  if (score >= 0.95) return "VERY_HIGH";
  if (score >= 0.8) return "HIGH";
  if (score >= 0.6) return "MEDIUM";
  if (score >= 0.3) return "LOW";
  return "VERY_LOW";
}
export type DecimalString = string & { readonly __decimalString: unique symbol };

export function decimalString(value: Decimal.Value): DecimalString {
  return String(value) as DecimalString;
}

export function buildImportLearningIdempotencyKey(importId: string, domain: ImportLearningDomain, originalRecordId: string): string {
  const normalizedImportId = importId.trim();
  const normalizedRecordId = originalRecordId.trim();
  if (!normalizedImportId || !normalizedRecordId) throw new Error("importId and originalRecordId are required");
  return `import-learning:${normalizedImportId}:${domain}:${normalizedRecordId}`;
}

export function validateImportLearningBatch(batch: ImportLearningBatch): void {
  if (!batch.importId.trim() || !batch.sourceLabel.trim() || !batch.companyId.trim() || !batch.projectId.trim() || !batch.createdById.trim()) {
    throw new Error("Import learning batch requires import, source, tenant and actor identifiers");
  }
  if (!batch.sourceType.endsWith("_IMPORT")) throw new Error("Invalid import learning source type");
  for (const observation of batch.observations) {
    if (!observation.originalRecordId.trim()) throw new Error("Every import observation requires originalRecordId");
    if (!observation.evidence.originalRecordId.trim()) throw new Error("Every import observation requires evidence");
    if (observation.unit !== undefined && !observation.unit.trim()) throw new Error("Observation unit cannot be empty");
    if (observation.domain === "PRICE" && typeof observation.value.value !== "string") throw new Error("Price values must preserve Decimal precision as strings");
    if (observation.domain === "YIELD" && typeof observation.value.value !== "string") throw new Error("Yield values must preserve Decimal precision as strings");
  }
}
