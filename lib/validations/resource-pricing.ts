import { z } from "zod";

export const resourcePriceProviderNameSchema = z.enum(["mc-presupuestos-price-api", "fake"]);
export const resourcePriceProviderStatusSchema = z.enum(["DISABLED", "HEALTHY", "DEGRADED", "SUSPENDED"]);
export const resourcePriceRequestModeSchema = z.enum(["ON_DEMAND", "SCHEDULED", "WEBHOOK"]);

export const resourcePriceQuoteSchema = z.object({
  externalResourceId: z.string().trim().min(1).nullable(),
  externalCode: z.string().trim().min(1).nullable(),
  description: z.string().trim().min(1),
  category: z.string().trim().min(1).nullable(),
  unit: z.string().trim().min(1),
  currency: z.string().trim().min(3).max(3),
  price: z.string().trim().min(1),
  observedAt: z.string().datetime({ offset: true }),
  sourceLabel: z.string().trim().min(1),
  sourceVersion: z.string().trim().min(1).nullable().optional(),
  rawHash: z.string().trim().min(1),
});

export const resourcePriceUpdateRequestSchema = z.object({
  resourceIds: z.array(z.string().min(1)).max(1000).optional(),
  mode: resourcePriceRequestModeSchema.default("ON_DEMAND"),
  idempotencyKey: z.string().trim().min(8).max(200).regex(/^[A-Za-z0-9._:-]+$/).optional(),
  provider: z.never().optional(),
  baseUrl: z.never().optional(),
  apiKey: z.never().optional(),
});

export const resourcePriceUpdateItemsQuerySchema = z.object({
  status: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const resourcePriceApplySchema = z.object({
  itemIds: z.array(z.string().min(1)).max(1000).optional(),
});

export const resourcePriceProviderConfigSchema = z.object({
  provider: resourcePriceProviderNameSchema,
  status: resourcePriceProviderStatusSchema,
  baseUrl: z.string().trim().url().nullable().optional(),
  apiVersion: z.string().trim().min(1).max(20).default("v1"),
  credential: z.string().trim().max(500).nullable().optional(),
  timeoutMs: z.coerce.number().int().min(1000).max(60000).default(8000),
  maxBatchSize: z.coerce.number().int().min(1).max(1000).default(50),
  defaultTtlHours: z.coerce.number().int().min(1).max(8760).default(24),
  allowFallback: z.boolean().default(false),
});

export type ResourcePriceUpdateRequestInput = z.infer<typeof resourcePriceUpdateRequestSchema>;
export type ResourcePriceProviderConfigInput = z.infer<typeof resourcePriceProviderConfigSchema>;
