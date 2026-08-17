import { z } from "zod";

export const serviceResourceLookupSchema = z.object({
  externalResourceId: z.string().trim().min(1).nullable().optional(),
  externalCode: z.string().trim().min(1).nullable().optional(),
  code: z.string().trim().min(1).nullable().optional(),
  description: z.string().trim().min(1),
  category: z.string().trim().min(1).nullable().optional(),
  unit: z.string().trim().min(1),
  currency: z.string().trim().length(3),
  currentPrice: z.string().trim().min(1).optional(),
});

export const lookupRequestSchema = z.object({
  resources: z.array(serviceResourceLookupSchema).min(1).max(1000),
});

export const catalogResourceSchema = z.object({
  externalResourceId: z.string().min(1),
  externalCode: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  unit: z.string().min(1),
  currency: z.string().length(3),
  price: z.string().min(1),
  sourceVersion: z.string().min(1),
});

export const lookupQuoteSchema = z.object({
  externalResourceId: z.string().min(1),
  externalCode: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  unit: z.string().min(1),
  currency: z.string().length(3),
  price: z.string().min(1),
  observedAt: z.string().datetime({ offset: true }),
  sourceLabel: z.string().min(1),
  sourceVersion: z.string().min(1),
  rawHash: z.string().min(1),
});

export type ServiceResourceLookup = z.infer<typeof serviceResourceLookupSchema>;
export type CatalogResource = z.infer<typeof catalogResourceSchema>;
export type LookupQuote = z.infer<typeof lookupQuoteSchema>;
export type LookupRequest = z.infer<typeof lookupRequestSchema>;

export const API_VERSION = "v1";
export const CATALOG_VERSION = "2026-08-17.1";
export const SERVICE_NAME = "mc-presupuestos-price-api";
