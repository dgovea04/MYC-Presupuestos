import type {
  ConfidenceLevel,
  FindingResolution,
  FindingStatus,
  ReviewFindingType,
  ReviewRunStatus,
} from "@/lib/review-intelligence/types";

export type ReviewStage = "validating" | "extracting" | "classifying" | "evidence" | "matching" | "rules" | "prioritizing" | "completed";

export interface ReviewWarningView {
  code: string;
  message: string;
  source?: string;
}

export interface ReviewRunView {
  id: string;
  budgetId: string;
  status: ReviewRunStatus;
  progress: { stage: ReviewStage; completed: number; total: number; percent: number };
  warnings: ReviewWarningView[];
  createdAt: string;
  updatedAt: string;
  finishedAt?: string | null;
  metrics?: { coveragePercent?: number; analyzedItems?: number; totalItems?: number; evidenceCount?: number; linkedEvidenceCount?: number; findingsByStatus?: Record<string, number>; findingsByType?: Record<string, number>; incompleteItems?: number; failedChecks?: number; failures?: number; incompleteness?: number; deltaVsPrevious?: number | null };
}

export interface ReviewDocumentVersionView {
  id: string;
  versionNumber: number;
  mimeType: string;
  fileSizeBytes: number;
  pageCount: number | null;
  sheetCount: number | null;
  extractionStatus: string;
  extractionWarnings?: string[];
}

export interface ReviewDocumentView {
  id: string;
  name: string;
  originalFileName: string;
  category: string;
  status: string;
  currentVersion?: ReviewDocumentVersionView | null;
  warnings: string[];
}

export interface FindingComparisonView {
  message?: string;
  documentValue?: string;
  budgetValue?: string;
  difference?: string;
  percentage?: string;
  potentialImpact?: string;
  unit?: string;
  formula?: string;
  details?: Record<string, string>;
}

export interface FindingLocationView {
  page?: number;
  sheet?: string;
  row?: number;
  column?: number;
  range?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface FindingEvidenceView {
  id: string;
  documentVersionId: string;
  evidenceType: string;
  originalText: string;
  normalizedText?: string | null;
  value?: string | null;
  sourceName?: string;
  sourceVersion?: number;
  warnings?: string[];
  location: FindingLocationView;
  confidence: ConfidenceLevel;
  extractionMethod: string;
  viewUrl?: string;
}

export interface FindingBudgetItemView {
  id: string;
  code: string;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  discipline?: string | null;
  budgetId?: string;
}

export interface FindingLinkView {
  id: string;
  score: string;
  confidence: ConfidenceLevel;
  validationStatus: string;
}

export interface FindingDecisionView {
  id: string;
  userId: string;
  resolution: FindingResolution;
  note?: string | null;
  previousStatus?: string | null;
  newStatus?: string | null;
  correctionVersionId?: string | null;
  createdAt: string;
}

export interface FindingView {
  id: string;
  findingType: ReviewFindingType;
  status: FindingStatus;
  severity: string;
  priority: string | null;
  confidence: ConfidenceLevel;
  potentialImpact: string | null;
  updatedAt: string;
  humanReviewRequired: boolean;
  automaticBudgetMutation: boolean;
  budgetId?: string;
  budgetItem?: FindingBudgetItemView | null;
  comparison?: FindingComparisonView | null;
  evidence?: FindingEvidenceView | null;
  entityLink?: FindingLinkView | null;
  decisionHistory: FindingDecisionView[];
}

export interface PaginatedFindings {
  findings: FindingView[];
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}

export interface FindingFilterState {
  page: number;
  pageSize: number;
  findingType?: ReviewFindingType;
  status?: FindingStatus;
  confidence?: ConfidenceLevel;
  document?: string;
  priority?: number;
  discipline?: string;
  subbudget?: string;
}
