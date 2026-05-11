import { z } from "zod";

export const projectSchema = z.object({
  companyId: z.string().min(1, "Selecciona una empresa"),
  name: z.string().min(3, "Ingresa el nombre de la obra"),
  clientName: z.string().optional(),
  location: z.string().optional(),
  projectType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(["PLANNING", "IN_PROGRESS", "COMPLETED", "ON_HOLD"]),
});

export type ProjectInput = z.infer<typeof projectSchema>;
