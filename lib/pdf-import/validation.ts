import { z } from "zod";

const decimalPattern = /^-?\d+(\.\d+)?$/;

export const pdfImportDecimalSchema = z
  .union([z.string().trim().regex(decimalPattern), z.number().finite()])
  .transform((value) => (typeof value === "number" ? String(value) : value));

export const pdfImportSourceEvidenceSchema = z.object({
  sourceFileName: z.string().trim().min(1),
  sourcePage: z.number().int().min(1),
  rawText: z.string().trim().min(1),
  confidence: z.number().min(0).max(1),
});

const pdfImportDocumentRoleSchema = z.enum(["BUDGET", "APU", "SUBPARTIDAS", "OTHER", "AUTO"]);
const pdfImportLinkStatusSchema = z.enum([
  "MATCHED",
  "AMBIGUOUS",
  "MISSING_APU",
  "MISSING_BUDGET_ITEM",
  "UNIT_MISMATCH",
  "PRICE_MISMATCH",
  "NEEDS_REVIEW",
]);

const pdfImportSourceFileSchema = z.object({
  id: z.string().trim().min(1),
  fileName: z.string().trim().min(1),
  role: pdfImportDocumentRoleSchema,
  pageCount: z.number().int().min(1),
  confidence: z.number().min(0).max(1),
});

const pdfImportedBudgetLevelSchema = z.object({
  id: z.string().trim().min(1),
  code: z.string().trim(),
  name: z.string().trim().min(1),
  type: z.enum(["TITLE", "SUBTITLE", "ITEM_GROUP", "SUBITEM"]),
  parentId: z.string().trim().min(1).nullable().optional(),
  sortOrder: z.number().int().min(0),
});

export const pdfImportedBudgetItemSchema = z.object({
  id: z.string().trim().min(1),
  levelId: z.string().trim().min(1).nullable().optional(),
  code: z.string().trim().min(1),
  description: z.string().trim().min(1),
  unit: z.string().trim().min(1),
  quantity: pdfImportDecimalSchema,
  unitPrice: pdfImportDecimalSchema,
  partial: pdfImportDecimalSchema,
  sortOrder: z.number().int().min(0),
  evidence: pdfImportSourceEvidenceSchema,
  needsReview: z.boolean().optional(),
  reviewReason: z.string().trim().nullable().optional(),
});

export const pdfImportedBudgetSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  kind: z.enum(["GENERAL", "SUB_BUDGET"]),
  currency: z.string().trim().min(3).max(3),
  levels: z.array(pdfImportedBudgetLevelSchema),
  items: z.array(pdfImportedBudgetItemSchema),
});

export const pdfImportedApuRowSchema = z.object({
  id: z.string().trim().min(1),
  description: z.string().trim().min(1),
  unit: z.string().trim().min(1),
  resourceType: z.string().trim().min(1),
  quantity: pdfImportDecimalSchema,
  unitPrice: pdfImportDecimalSchema,
  subtotal: pdfImportDecimalSchema,
  sortOrder: z.number().int().min(0),
  evidence: pdfImportSourceEvidenceSchema,
  catalogSubpartidaId: z.string().trim().min(1).nullable().optional(),
  resourceId: z.string().trim().min(1).nullable().optional(),
  needsReview: z.boolean().optional(),
  reviewReason: z.string().trim().nullable().optional(),
});

export const pdfImportedApuSchema = z.object({
  id: z.string().trim().min(1),
  budgetItemCode: z.string().trim().nullable().optional(),
  name: z.string().trim().min(1),
  unit: z.string().trim().min(1),
  performance: pdfImportDecimalSchema,
  totalUnitCost: pdfImportDecimalSchema,
  rows: z.array(pdfImportedApuRowSchema),
  evidence: pdfImportSourceEvidenceSchema,
});

export const pdfImportedSubpartidaSchema = z.object({
  id: z.string().trim().min(1),
  code: z.string().trim().nullable().optional(),
  description: z.string().trim().min(1),
  unit: z.string().trim().min(1),
  unitPrice: pdfImportDecimalSchema,
  performance: pdfImportDecimalSchema,
  rows: z.array(pdfImportedApuRowSchema),
  evidence: pdfImportSourceEvidenceSchema,
});

const pdfImportedResourceSchema = z.object({
  id: z.string().trim().min(1),
  code: z.string().trim(),
  description: z.string().trim().min(1),
  category: z.enum(["MATERIAL", "LABOR", "EQUIPMENT", "TOOLS", "OTHER"]),
  unit: z.string().trim().min(1),
  unitPrice: pdfImportDecimalSchema,
  currency: z.string().trim().min(3).max(3),
  evidence: pdfImportSourceEvidenceSchema,
});

const pdfImportLinkSchema = z.object({
  id: z.string().trim().min(1),
  fromId: z.string().trim().min(1),
  toId: z.string().trim().min(1).nullable().optional(),
  kind: z.enum(["BUDGET_ITEM_APU", "APU_SUBPARTIDA", "APU_ROW_RESOURCE"]),
  status: pdfImportLinkStatusSchema,
  confidence: z.number().min(0).max(1),
  reason: z.string().trim().min(1),
});

const pdfImportValidationSchema = z.object({
  id: z.string().trim().min(1),
  severity: z.enum(["error", "warning", "info"]),
  code: z.string().trim().min(1),
  message: z.string().trim().min(1),
  entityId: z.string().trim().min(1).nullable().optional(),
});

const pdfImportReviewApprovalSchema = z.object({
  id: z.string().trim().min(1),
  validationCode: z.string().trim().min(1),
  entityId: z.string().trim().min(1),
  reason: z.string().trim().min(1),
});

export const pdfAiImportDraftSchema = z.object({
  source: z.literal("PDF_AI"),
  project: z.object({
    name: z.string().trim().min(1),
    currency: z.string().trim().min(3).max(3),
  }),
  sourceFiles: z.array(pdfImportSourceFileSchema).min(1),
  budgets: z.array(pdfImportedBudgetSchema),
  apus: z.array(pdfImportedApuSchema),
  subpartidas: z.array(pdfImportedSubpartidaSchema),
  resources: z.array(pdfImportedResourceSchema),
  links: z.array(pdfImportLinkSchema),
  validations: z.array(pdfImportValidationSchema),
  reviewApprovals: z.array(pdfImportReviewApprovalSchema).optional(),
  warnings: z.array(z.string()),
});

export type PdfAiImportDraftInput = z.input<typeof pdfAiImportDraftSchema>;
