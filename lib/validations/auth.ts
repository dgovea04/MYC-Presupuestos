import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(3, "Ingresa tu nombre"),
  email: z.email("Email invalido"),
  password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres"),
  companyName: z.string().min(2, "Ingresa el nombre de tu empresa o perfil"),
  ruc: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.email("Email invalido"),
  password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres"),
});

export const resendVerificationSchema = z.object({
  email: z.email("Email invalido"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
