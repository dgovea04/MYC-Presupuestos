import { z } from "zod";
import { reviewFindingTypes, type ReviewConfiguration } from "./types";

const decimalStringSchema = z.string().regex(/^\d+(?:\.\d{1,6})?$/, "Expected a decimal string");
const signedDecimalStringSchema = z.string().regex(/^-?\d+(?:\.\d{1,6})?$/, "Expected a decimal string");

export const comparisonJsonSchema = z.object({
  documentValue: decimalStringSchema.optional(), budgetValue: decimalStringSchema.optional(),
  difference: signedDecimalStringSchema.optional(), percentage: signedDecimalStringSchema.optional(),
  potentialImpact: signedDecimalStringSchema.optional(), unit: z.string().min(1).optional(),
  details: z.record(z.string(), z.string()).optional(),
}).strict();

export const signalsJsonSchema = z.record(z.string(), z.number().min(0).max(1));

export const locationJsonSchema = z.object({
  page: z.number().int().positive().optional(), sheet: z.string().min(1).optional(),
  row: z.number().int().nonnegative().optional(), column: z.number().int().nonnegative().optional(),
  textOffsetStart: z.number().int().nonnegative().optional(), textOffsetEnd: z.number().int().nonnegative().optional(),
}).strict();

export const progressJsonSchema = z.object({
  stage: z.string().min(1), completed: z.number().int().nonnegative(),
  total: z.number().int().positive(), percent: z.number().min(0).max(100),
}).strict();

export const warningsJsonSchema = z.array(z.object({
  code: z.string().min(1), message: z.string().min(1), source: z.string().min(1).optional(),
}).strict());

export const reviewFindingFlagsSchema = z.object({
  humanReviewRequired: z.boolean().default(true), automaticBudgetMutation: z.literal(false).default(false),
}).strict();

export const reviewConfigurationSchema = z.object({
  maxFiles: z.number().int().min(1).max(10), maxPdfPages: z.number().int().min(1).max(300),
  maxFileSizeMb: z.number().positive().max(50), maxXlsxSheets: z.number().int().min(1).max(20),
  tolerancePercent: decimalStringSchema, findingTypes: z.array(z.enum(reviewFindingTypes)).min(1),
}).strict();

export type ComparisonJsonInput = z.infer<typeof comparisonJsonSchema>;
export type SignalsJsonInput = z.infer<typeof signalsJsonSchema>;
export type LocationJsonInput = z.infer<typeof locationJsonSchema>;
export type ProgressJsonInput = z.infer<typeof progressJsonSchema>;
export type WarningsJsonInput = z.infer<typeof warningsJsonSchema>;

export interface TenantProjectOwnershipInput { companyId: string; projectCompanyId: string; }

export interface TenantScopedAssociationInput {
  companyId: string;
  projectId: string;
  relatedCompanyId: string;
  relatedProjectId: string;
  actorCompanyId?: string;
}

export function assertTenantProjectOwnership(input: TenantProjectOwnershipInput): void {
  if (input.companyId !== input.projectCompanyId) {
    throw new Error("Company and project tenant identifiers must match.");
  }
}

export function assertTenantScopedAssociation(input: TenantScopedAssociationInput): void {
  if (!input.companyId || !input.projectId || !input.relatedCompanyId || !input.relatedProjectId) {
    throw new Error("Tenant and project identifiers are required.");
  }
  if (input.companyId !== input.relatedCompanyId || input.projectId !== input.relatedProjectId) {
    throw new Error("Tenant and project identifiers must match.");
  }
  if (input.actorCompanyId !== undefined && input.actorCompanyId !== input.companyId) {
    throw new Error("Actor tenant identifier must match.");
  }
}

export function parseReviewConfiguration(input: unknown): ReviewConfiguration {
  return reviewConfigurationSchema.parse(input);
}
