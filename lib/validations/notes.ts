import { z } from "zod";

export const noteTaskPrioritySchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
export const noteTaskStatusSchema = z.enum(["OPEN", "RESOLVED"]);

const optionalIdSchema = z
  .string()
  .trim()
  .min(1)
  .optional();

export const noteTaskCreateSchema = z.object({
  body: z.string().trim().min(1, "Ingresa una nota"),
  priority: noteTaskPrioritySchema.default("MEDIUM"),
  projectId: optionalIdSchema,
  budgetId: optionalIdSchema,
  budgetItemId: optionalIdSchema,
  sourcePath: z.string().trim().min(1, "Indica la vista de origen"),
  sharedWith: z.array(z.string()).optional(),
});

export const noteTaskUpdateSchema = z
  .object({
    body: z.string().trim().min(1, "Ingresa una nota").optional(),
    priority: noteTaskPrioritySchema.optional(),
    status: noteTaskStatusSchema.optional(),
    sharedWith: z.array(z.string()).optional(),
  })
  .refine((value) => value.body !== undefined || value.priority !== undefined || value.status !== undefined || value.sharedWith !== undefined, {
    message: "No hay cambios para guardar",
  });

export type NoteTaskCreateInput = z.infer<typeof noteTaskCreateSchema>;
export type NoteTaskUpdateInput = z.infer<typeof noteTaskUpdateSchema>;
