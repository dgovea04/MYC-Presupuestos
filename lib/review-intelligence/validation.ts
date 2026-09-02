import { z } from "zod";
import {
  reviewFindingTypes,
  type ReviewConfiguration,
  type ReviewFindingType,
} from "./types";

const decimalStringSchema = z.string().regex(/^\d+(?:\.\d{1,6})?$/, "Expected a decimal string");

export const reviewConfigurationSchema = z.object({
  maxFiles: z.number().int().min(1).max(10),
  maxPdfPages: z.number().int().min(1).max(300),
  maxFileSizeMb: z.number().positive().max(50),
  maxXlsxSheets: z.number().int().min(1).max(20),
  tolerancePercent: decimalStringSchema,
  findingTypes: z.array(z.enum(reviewFindingTypes)).min(1),
});

export function parseReviewConfiguration(input: unknown): ReviewConfiguration {
  const parsed = reviewConfigurationSchema.parse(input);
  return {
    ...parsed,
    findingTypes: [...parsed.findingTypes] as ReviewFindingType[],
  };
}
