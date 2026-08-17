export type LocalResourcePriceBatchSource = "EXCEL" | "MANUAL" | "ROLLBACK";
export type LocalResourcePriceBatchStatus = "DRAFT" | "PREVIEW_READY" | "PUBLISHED" | "REJECTED" | "ROLLED_BACK";
export type LocalResourcePriceItemStatus = "VALID" | "INVALID" | "UNCHANGED" | "UPDATED" | "CONFLICT" | "APPLIED" | "REJECTED";

export type LocalResourcePriceRowInput = {
  resourceId?: string;
  code: string;
  description: string;
  unit: string;
  currency: string;
  proposedPrice: string;
  observedAt?: string;
  sourceLabel?: string;
  notes?: string;
};

export type LocalResourcePriceBatchSummary = {
  id: string;
  versionNumber: number;
  versionLabel: string;
  source: LocalResourcePriceBatchSource;
  status: LocalResourcePriceBatchStatus;
  fileName: string | null;
  fileHash: string | null;
  notes: string | null;
  totalRows: number;
  validRows: number;
  changedRows: number;
  invalidRows: number;
  createdById: string;
  publishedById: string | null;
  rolledBackById: string | null;
  previewedAt: string | null;
  publishedAt: string | null;
  rolledBackAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LocalResourcePriceBatchItemRecord = {
  id: string;
  batchId: string;
  resourceId: string | null;
  rowNumber: number;
  resourceCode: string;
  resourceDescription: string;
  unit: string;
  currency: string;
  proposedPrice: string | null;
  oldPrice: string | null;
  observedAt: string | null;
  sourceLabel: string | null;
  notes: string | null;
  status: LocalResourcePriceItemStatus;
  reason: string | null;
  description?: string;
};

export type LocalResourcePriceHistoryRecord = {
  id: string;
  resourceId: string;
  batchId: string;
  oldPrice: string;
  newPrice: string;
  changedById: string;
  changedAt: string;
};
