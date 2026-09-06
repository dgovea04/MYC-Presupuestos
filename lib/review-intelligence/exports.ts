export interface ReviewSummaryFinding {
  id: string;
  budgetItemCode: string | null;
  description: string | null;
  findingType: string;
  status: string;
  priority: string | null;
  potentialImpact: string | null;
  evidenceSource: string | null;
  evidenceLocation: string | null;
}

export interface ReviewSummaryExportInput {
  run: { id: string; status: string; createdAt: string; rulesVersion: string };
  metrics: Record<string, number>;
  findings: ReviewSummaryFinding[];
}

export interface ReviewSummaryExport {
  run: ReviewSummaryExportInput["run"];
  metrics: Record<string, number>;
  findings: ReviewSummaryFinding[];
}

const headers = ["finding_id", "budget_item_code", "description", "finding_type", "status", "priority", "potential_impact", "evidence_source", "evidence_location"] as const;

export function buildReviewSummaryExport(input: ReviewSummaryExportInput): { csv: string; json: ReviewSummaryExport } {
  const findings = [...input.findings].sort((left, right) => left.id.localeCompare(right.id));
  const json: ReviewSummaryExport = { run: input.run, metrics: { ...input.metrics }, findings };
  const rows = findings.map((finding) => headers.map((header) => csvCell(finding[headerMap[header]])).join(","));
  return { json, csv: [headers.join(","), ...rows].join("\n") + "\n" };
}

const headerMap: Record<(typeof headers)[number], keyof ReviewSummaryFinding> = {
  finding_id: "id", budget_item_code: "budgetItemCode", description: "description", finding_type: "findingType", status: "status", priority: "priority", potential_impact: "potentialImpact", evidence_source: "evidenceSource", evidence_location: "evidenceLocation",
};

function csvCell(value: string | null): string {
  if (value === null) return "";
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
