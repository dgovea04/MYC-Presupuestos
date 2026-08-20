import { z } from "zod";

const optionalTrimmedString = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();

export const registerSchema = z.object({
  name: z.string().trim().min(3, "Ingresa tu nombre"),
  email: z.email("Email invalido").transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres"),
  companyName: optionalTrimmedString,
  ruc: optionalTrimmedString,
});

export const loginSchema = z.object({
  email: z.email("Email invalido"),
  password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres"),
  mfaCode: z.string().trim().max(20).optional(),
});

export const resendVerificationSchema = z.object({
  email: z.email("Email invalido"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
