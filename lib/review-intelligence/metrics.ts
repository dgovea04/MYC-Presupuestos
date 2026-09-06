import Decimal from "decimal.js";
import { normalizeUnit } from "./units";

export interface ReviewCoverageByCategory {
  quantity: number;
  unit: number;
  specification: number;
  apuComponent: number;
  yield: number;
}

export interface ReviewRunMetrics {
  analyzedItems: number;
  totalItems: number;
  coveragePercent: number;
  evidenceCount: number;
  linkedEvidenceCount: number;
  findingsByStatus: Record<string, number>;
  findingsByType: Record<string, number>;
  failures: number;
  incompleteness: number;
  deltaVsPrevious: number | null;
  coverageByCategory?: ReviewCoverageByCategory;
  partiallyCoveredSources?: number;
}

export interface ReviewRunMetricInput {
  budgetIds: string[];
  budgetItems: Array<{ id: string; budgetId: string }>;
  evidence: Array<{ id: string; documentVersionId: string; evidenceType?: string; unit?: string | null; metadataJson?: unknown }>;
  documentVersions?: Array<{ id: string; extractionCoverage?: unknown }>;
  links: Array<{ budgetItemId: string; evidenceId: string }>;
  findings: Array<{ budgetItemId: string | null; status: string; findingType: string }>;
  warnings: Array<{ code: string; message: string }>;
  previous?: Pick<ReviewRunMetrics, "analyzedItems" | "coveragePercent" | "failures" | "incompleteness"> | null;
}

export function calculateReviewRunMetrics(input: ReviewRunMetricInput): ReviewRunMetrics {
  const items = input.budgetItems.filter((item) => input.budgetIds.includes(item.budgetId));
  const itemIds = new Set(items.map((item) => item.id));
  const scopedLinks = input.links.filter((link) => itemIds.has(link.budgetItemId));
  const linkedEvidence = new Set(scopedLinks.map((link) => link.evidenceId));
  const coveredItems = new Set(scopedLinks.map((link) => link.budgetItemId));
  const findingsByStatus: Record<string, number> = {};
  const findingsByType: Record<string, number> = {};
  for (const finding of input.findings.filter((item) => item.budgetItemId === null || itemIds.has(item.budgetItemId))) {
    findingsByStatus[finding.status] = (findingsByStatus[finding.status] ?? 0) + 1;
    findingsByType[finding.findingType] = (findingsByType[finding.findingType] ?? 0) + 1;
  }
  const failures = input.warnings.filter((warning) => /fail|error/i.test(`${warning.code} ${warning.message}`)).length;
  const incompleteness = input.warnings.filter((warning) => /incomplete|partial|missing/i.test(`${warning.code} ${warning.message}`)).length + (findingsByType.INCOMPLETE_APU ?? 0) + (findingsByType.MISSING_DOCUMENTATION ?? 0);
  const analyzedItems = items.length;
  const coveragePercent = items.length === 0 ? 0 : Math.round((coveredItems.size / items.length) * 100);
  const coverageByCategory: ReviewCoverageByCategory = { quantity: 0, unit: 0, specification: 0, apuComponent: 0, yield: 0 };
  for (const evidence of input.evidence) {
    const metadata = metadataObject(evidence.metadataJson);
    if (evidence.evidenceType === "QUANTITY") coverageByCategory.quantity += 1;
    if (typeof evidence.unit === "string" && normalizeUnit(evidence.unit).comparable) coverageByCategory.unit += 1;
    if (nonEmptyText(metadata.technicalSpecification) || nonEmptyText(metadata.technicalSpec)) coverageByCategory.specification += 1;
    if (nonEmptyComponents(metadata.apuComponents)) coverageByCategory.apuComponent += 1;
    if (validDecimal(metadata.yield)) coverageByCategory.yield += 1;
  }
  const partiallyCoveredSources = new Set((input.documentVersions ?? []).filter((version) => hasPartialCoverage(version.extractionCoverage)).map((version) => version.id)).size;
  const base = { analyzedItems, totalItems: items.length, coveragePercent, evidenceCount: input.evidence.length, linkedEvidenceCount: linkedEvidence.size, findingsByStatus, findingsByType, failures, incompleteness, deltaVsPrevious: input.previous ? analyzedItems - input.previous.analyzedItems : null };
  const hasEnrichedCoverage = input.documentVersions !== undefined || input.evidence.some((evidence) => evidence.evidenceType !== undefined || evidence.unit !== undefined || evidence.metadataJson !== undefined);
  return hasEnrichedCoverage ? { ...base, coverageByCategory, partiallyCoveredSources } : base;
}

function metadataObject(value: unknown): Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function nonEmptyText(value: unknown): boolean { return typeof value === "string" && value.trim().length > 0; }
function nonEmptyComponents(value: unknown): boolean { return Array.isArray(value) && value.some((component) => nonEmptyText(component)); }
function validDecimal(value: unknown): boolean { if (typeof value !== "string" || value.trim() === "") return false; try { return new Decimal(value).isFinite(); } catch { return false; } }
function hasPartialCoverage(value: unknown): boolean { return Array.isArray(value) && value.some((entry) => metadataObject(entry).coverage === "OCR_REQUIRED" || metadataObject(entry).coverage === "FAILED"); }
