import { z } from "zod";

const partidaApuRowSchema = z.object({
  id: z.string().optional(),
  resourceId: z.string().optional(),
  description: z.string().min(1, "Ingresa el insumo"),
  unit: z.string().min(1, "Ingresa la unidad"),
  crew: z.coerce.number().nullable().optional(),
  quantity: z.coerce.number().nonnegative(),
  unitPrice: z.coerce.number().nonnegative(),
  subtotal: z.coerce.number().nonnegative(),
  resourceType: z.string().optional(),
  groupLabel: z.string().optional(),
  sortOrder: z.coerce.number().int().nonnegative(),
});

export const catalogPartidaSchema = z.object({
  description: z.string().min(3, "Ingresa la partida"),
  unit: z.string().min(1, "Ingresa la unidad"),
  unitPrice: z.coerce.number().nonnegative(),
  currency: z.string().default("PEN"),
  source: z.string().optional(),
  performance: z.coerce.number().positive(),
  performanceUnit: z.string().optional(),
  performanceRate: z.string().optional(),
  apuRows: z.array(partidaApuRowSchema).default([]),
});

export type CatalogPartidaInput = z.infer<typeof catalogPartidaSchema>;
export type CatalogPartidaApuRowInput = z.infer<typeof partidaApuRowSchema>;

const catalogPartidaPatchFieldsSchema = catalogPartidaSchema;

export const catalogPartidaStatePatchSchema = z.object({
  create: z.array(
    z.object({
      clientId: z.string().min(1),
      data: catalogPartidaPatchFieldsSchema,
    }),
  ),
  update: z.array(
    z.object({
      id: z.string().min(1),
      changes: catalogPartidaPatchFieldsSchema.partial(),
    }),
  ),
  delete: z.array(z.string().min(1)),
});
