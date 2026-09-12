import type Decimal from "decimal.js";

export const importLearningDomains = ["ITEM", "RESOURCE", "PRICE", "YIELD", "APU"] as const;
export type ImportLearningDomain = (typeof importLearningDomains)[number];

export const importLearningSourceTypes = ["S10_IMPORT", "MCP_IMPORT", "RW7_IMPORT", "PDF_IMPORT", "DB_IMPORT", "DELPHIN_IMPORT"] as const;
export type ImportLearningSourceType = (typeof importLearningSourceTypes)[number];

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

export function parseImportLearningBatch(value: unknown): ImportLearningBatch {
  if (!isRecord(value)) throw new Error("IMPORT_LEARNING_PAYLOAD_INVALID");
  const observationsValue = value.observations;
  if (!Array.isArray(observationsValue)) throw new Error("IMPORT_LEARNING_OBSERVATIONS_INVALID");
  const sourceType = value.sourceType;
  if (!importLearningSourceTypes.includes(sourceType as ImportLearningSourceType)) throw new Error("IMPORT_LEARNING_SOURCE_TYPE_INVALID");
  const batch: ImportLearningBatch = {
    importId: readRequiredString(value.importId, "importId"),
    sourceType: sourceType as ImportLearningSourceType,
    sourceLabel: readRequiredString(value.sourceLabel, "sourceLabel"),
    companyId: readRequiredString(value.companyId, "companyId"),
    projectId: readRequiredString(value.projectId, "projectId"),
    createdById: readRequiredString(value.createdById, "createdById"),
    observedAt: readDate(value.observedAt, "observedAt"),
    observations: observationsValue.map((observation, index) => parseImportLearningObservation(observation, index)),
  };
  validateImportLearningBatch(batch);
  return batch;
}

function parseImportLearningObservation(value: unknown, index: number): ImportLearningObservation {
  if (!isRecord(value)) throw new Error(`IMPORT_LEARNING_OBSERVATION_${index}_INVALID`);
  const evidenceValue = value.evidence;
  if (!isRecord(evidenceValue)) throw new Error(`IMPORT_LEARNING_OBSERVATION_${index}_EVIDENCE_INVALID`);
  const domain = value.domain;
  if (!importLearningDomains.includes(domain as ImportLearningDomain)) throw new Error(`IMPORT_LEARNING_OBSERVATION_${index}_DOMAIN_INVALID`);
  const confidence = value.confidence;
  if (!["VERY_LOW", "LOW", "MEDIUM", "HIGH", "VERY_HIGH"].includes(String(confidence))) throw new Error(`IMPORT_LEARNING_OBSERVATION_${index}_CONFIDENCE_INVALID`);
  const candidate = value.entity;
  return {
    domain: domain as ImportLearningDomain,
    originalRecordId: readRequiredString(value.originalRecordId, `observation[${index}].originalRecordId`),
    value: isRecord(value.value) ? value.value : (() => { throw new Error(`IMPORT_LEARNING_OBSERVATION_${index}_VALUE_INVALID`); })(),
    name: readOptionalString(value.name),
    unit: readOptionalString(value.unit),
    currency: readOptionalString(value.currency),
    confidence: confidence as ImportLearningConfidence,
    observedAt: readDate(value.observedAt, `observation[${index}].observedAt`),
    evidence: {
      originalRecordId: readRequiredString(evidenceValue.originalRecordId, `evidence[${index}].originalRecordId`),
      fileName: readOptionalString(evidenceValue.fileName), page: readOptionalString(evidenceValue.page), sheet: readOptionalString(evidenceValue.sheet), cellRange: readOptionalString(evidenceValue.cellRange), quote: readOptionalString(evidenceValue.quote), checksum: readOptionalString(evidenceValue.checksum), metadata: isRecord(evidenceValue.metadata) ? evidenceValue.metadata as ImportLearningEvidence["metadata"] : undefined,
    },
    entity: isRecord(candidate) && (candidate.domain === "ITEM" || candidate.domain === "RESOURCE") && typeof candidate.name === "string" ? { domain: candidate.domain, name: candidate.name, unit: readOptionalString(candidate.unit), category: readOptionalString(candidate.category), alias: readOptionalString(candidate.alias) } : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function readRequiredString(value: unknown, field: string): string { if (typeof value !== "string" || !value.trim()) throw new Error(`IMPORT_LEARNING_${field.toUpperCase()}_REQUIRED`); return value; }
function readOptionalString(value: unknown): string | undefined { return typeof value === "string" ? value : undefined; }
function readDate(value: unknown, field: string): Date | undefined { if (value === undefined || value === null) return undefined; const date = value instanceof Date ? value : new Date(String(value)); if (Number.isNaN(date.getTime())) throw new Error(`IMPORT_LEARNING_${field.toUpperCase()}_INVALID`); return date; }

export function validateImportLearningBatch(batch: ImportLearningBatch): void {
  if (!batch.importId.trim() || !batch.sourceLabel.trim() || !batch.companyId.trim() || !batch.projectId.trim() || !batch.createdById.trim()) {
    throw new Error("Import learning batch requires import, source, tenant and actor identifiers");
  }
  if (!importLearningSourceTypes.includes(batch.sourceType)) throw new Error("Invalid import learning source type");
  for (const observation of batch.observations) {
    if (!observation.originalRecordId.trim()) throw new Error("Every import observation requires originalRecordId");
    if (!observation.evidence.originalRecordId.trim()) throw new Error("Every import observation requires evidence");
    if (observation.unit !== undefined && !observation.unit.trim()) throw new Error("Observation unit cannot be empty");
    if (observation.domain === "PRICE" && typeof observation.value.value !== "string") throw new Error("Price values must preserve Decimal precision as strings");
    if (observation.domain === "YIELD" && typeof observation.value.value !== "string") throw new Error("Yield values must preserve Decimal precision as strings");
  }
}
