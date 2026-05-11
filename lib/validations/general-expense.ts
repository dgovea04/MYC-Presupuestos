import { z } from "zod";

export const generalExpenseTitleSchema = z.object({
  code: z.string().trim().optional(),
  name: z.string().trim().min(1, "Ingresa el nombre del titulo"),
  category: z.enum(["STANDARD", "PERSONAL", "TESTING", "DIRECT_COST_BASED"]).default("STANDARD"),
});

export const generalExpenseItemSchema = z.object({
  code: z.string().trim().optional(),
  description: z.string().trim().min(1, "Ingresa la descripcion del item"),
  unit: z.string().trim().min(1, "Ingresa la unidad"),
  quantityDescription: z.string().trim().nullable().optional(),
  quantity: z.coerce.number().min(0, "Ingresa una cantidad valida"),
  participationPercentage: z.coerce.number().min(0, "Ingresa un porcentaje valido"),
  unitPrice: z.coerce.number().min(0, "Ingresa un precio unitario valido"),
});

export const generalExpenseStructureSaveSchema = z.object({
  groups: z.array(
    z.object({
      id: z.string().min(1),
      sortOrder: z.coerce.number().int().min(0),
      titles: z.array(
        z.object({
          id: z.string().min(1),
          code: z.string().trim().min(1, "Ingresa el codigo del titulo"),
          name: z.string().trim().min(1, "Ingresa el nombre del titulo"),
          category: z.enum(["STANDARD", "PERSONAL", "TESTING", "DIRECT_COST_BASED"]),
          sortOrder: z.coerce.number().int().min(0),
          items: z.array(
            z.object({
              id: z.string().min(1),
              code: z.string().trim().min(1, "Ingresa el codigo del item"),
              description: z.string().trim().min(1, "Ingresa la descripcion del item"),
              unit: z.string().trim().min(1, "Ingresa la unidad"),
              quantityDescription: z.string().trim().nullable().optional(),
              quantity: z.coerce.number().min(0, "Ingresa una cantidad valida"),
              participationPercentage: z.coerce.number().min(0, "Ingresa un porcentaje valido"),
              unitPrice: z.coerce.number().min(0, "Ingresa un precio unitario valido"),
              sortOrder: z.coerce.number().int().min(0),
            }),
          ),
        }),
      ),
    }),
  ),
});

export type GeneralExpenseTitleInput = z.infer<typeof generalExpenseTitleSchema>;
export type GeneralExpenseItemInput = z.infer<typeof generalExpenseItemSchema>;
export type GeneralExpenseStructureSaveInput = z.infer<typeof generalExpenseStructureSaveSchema>;
