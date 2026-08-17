import { z } from "zod";

export const localResourcePriceRowSchema = z.object({
  resourceId: z.string().trim().min(1).max(100).optional(),
  code: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  unit: z.string().trim().min(1).max(40),
  currency: z.string().trim().toUpperCase().length(3),
  proposedPrice: z.string().trim().min(1).max(50),
  observedAt: z.string().datetime({ offset: true }).optional(),
  sourceLabel: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const localResourcePriceManualInputSchema = z.object({
  rows: z.array(localResourcePriceRowSchema).min(1).max(5000),
  notes: z.string().trim().max(1000).optional(),
});

export const localResourcePriceListQuerySchema = z.object({
  status: z.enum(["DRAFT", "PREVIEW_READY", "PUBLISHED", "REJECTED", "ROLLED_BACK"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const localResourcePricePublishSchema = z.object({
  confirmVersion: z.string().trim().min(1).max(80),
});

export type LocalResourcePriceManualInput = z.infer<typeof localResourcePriceManualInputSchema>;
