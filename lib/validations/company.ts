import { z } from "zod";

export const companySchema = z.object({
  name: z.string().trim().min(2, "Ingresa el nombre de tu empresa o perfil"),
  ruc: z
    .string()
    .trim()
    .refine((value) => value.length === 0 || /^\d{11}$/.test(value), "El RUC debe tener 11 digitos")
    .transform((value) => value || undefined),
});

export type CompanyInput = z.infer<typeof companySchema>;
