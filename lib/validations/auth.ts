import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(3, "Ingresa tu nombre"),
  email: z.email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  companyName: z.string().min(2, "Ingresa el nombre de tu empresa o perfil"),
  ruc: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
