import { z } from "zod";

export const resourceSchema = z.object({
  companyId: z.string().optional(),
  code: z.string().trim().optional(),
  description: z.string().min(3, "Ingresa la descripcion"),
  category: z.enum(["MATERIAL", "LABOR", "EQUIPMENT", "TOOLS", "SUBCONTRACT"]),
  iu: z.string().trim().optional(),
  iuCurrent: z.string().trim().optional(),
  subcategory: z.string().optional(),
  unit: z.string().min(1, "Ingresa la unidad"),
  unitPrice: z.coerce.number().nonnegative(),
  currency: z.string().default("PEN"),
  source: z.string().optional(),
});

export type ResourceInput = z.infer<typeof resourceSchema>;

const resourcePatchFieldsSchema = resourceSchema;

export const resourceStatePatchSchema = z.object({
  create: z.array(
    z.object({
      clientId: z.string().min(1),
      data: resourcePatchFieldsSchema,
    }),
  ),
  update: z.array(
    z.object({
      id: z.string().min(1),
      changes: resourcePatchFieldsSchema.partial(),
    }),
  ),
  delete: z.array(z.string().min(1)),
});

export type ResourceStatePatchInput = z.infer<typeof resourceStatePatchSchema>;
