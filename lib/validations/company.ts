import { z } from "zod";

export const companySchema = z.object({
  name: z.string().trim().min(2, "Ingresa el nombre de tu empresa o perfil"),
  ruc: z
    .string()
    .trim()
    .refine((value) => value.length === 0 || /^\d{11}$/.test(value), "El RUC debe tener 11 digitos")
    .transform((value) => value || undefined),
});

const COMPANY_LOGO_MAX_SIZE = 3 * 1024 * 1024;
const COMPANY_LOGO_TYPES = ["image/png", "image/jpeg"] as const;

export const companyLogoUploadSchema = z.object({
  logo: z
    .instanceof(File, { message: "Selecciona un logo valido." })
    .refine((file) => file.size > 0, "Selecciona un logo valido.")
    .refine((file) => file.size <= COMPANY_LOGO_MAX_SIZE, "El logo supera el tamano permitido.")
    .refine((file) => COMPANY_LOGO_TYPES.includes(file.type as (typeof COMPANY_LOGO_TYPES)[number]), "El logo debe estar en PNG o JPG."),
});

export type CompanyInput = z.infer<typeof companySchema>;
