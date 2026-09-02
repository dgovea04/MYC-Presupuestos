export const reviewRunStatuses = [
  "DRAFT",
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "COMPLETED_WITH_WARNINGS",
  "FAILED",
  "CANCELLED",
  "STALE",
] as const;

export type ReviewRunStatus = (typeof reviewRunStatuses)[number];

export const reviewFindingTypes = [
  "QUANTITY_MISMATCH",
  "UNIT_INCONSISTENCY",
  "TECHNICAL_SPEC_MISMATCH",
  "MISSING_DOCUMENTATION",
  "INCOMPLETE_APU",
] as const;

export type ReviewFindingType = (typeof reviewFindingTypes)[number];

export const findingStatuses = ["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED", "STALE"] as const;
export type FindingStatus = (typeof findingStatuses)[number];

export const findingResolutions = [
  "ACCEPTED",
  "REJECTED",
  "NOT_APPLICABLE",
  "NEEDS_MORE_EVIDENCE",
  "CORRECTED",
] as const;
export type FindingResolution = (typeof findingResolutions)[number];

export const documentStatuses = [
  "UPLOADED",
  "PROCESSING",
  "READY",
  "COMPLETED_WITH_WARNINGS",
  "FAILED",
  "ARCHIVED",
] as const;
export type DocumentStatus = (typeof documentStatuses)[number];

export const evidenceTypes = [
  "QUANTITY",
  "UNIT",
  "TECHNICAL_SPECIFICATION",
  "DOCUMENT_REFERENCE",
  "APU_COMPONENT",
  "OTHER",
] as const;
export type EvidenceType = (typeof evidenceTypes)[number];

export const confidenceLevels = ["LOW", "MEDIUM", "HIGH"] as const;
export type ConfidenceLevel = (typeof confidenceLevels)[number];

export interface ReviewConfiguration {
  maxFiles: number;
  maxPdfPages: number;
  maxFileSizeMb: number;
  maxXlsxSheets: number;
  tolerancePercent: string;
  findingTypes: ReviewFindingType[];
}
