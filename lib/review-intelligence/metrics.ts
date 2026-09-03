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
}

export interface ReviewRunMetricInput {
  budgetIds: string[];
  budgetItems: Array<{ id: string; budgetId: string }>;
  evidence: Array<{ id: string; documentVersionId: string }>;
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
  return { analyzedItems, totalItems: items.length, coveragePercent, evidenceCount: input.evidence.length, linkedEvidenceCount: linkedEvidence.size, findingsByStatus, findingsByType, failures, incompleteness, deltaVsPrevious: input.previous ? analyzedItems - input.previous.analyzedItems : null };
}
