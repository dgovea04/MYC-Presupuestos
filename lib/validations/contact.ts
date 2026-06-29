import { z } from "zod";

export const contactRequestSchema = z.object({
  name: z.string().trim().min(2, "Ingresa tu nombre"),
  email: z.email("Ingresa un correo valido"),
  phone: z.string().trim().max(40, "Telefono demasiado largo").optional().or(z.literal("")),
  company: z.string().trim().max(120, "Empresa demasiado larga").optional().or(z.literal("")),
  message: z.string().trim().min(10, "Cuéntanos un poco más sobre tu consulta").max(2000, "Mensaje demasiado largo"),
});

export type ContactRequestInput = z.infer<typeof contactRequestSchema>;
