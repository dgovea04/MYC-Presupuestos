import { z } from "zod";

export const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;
const ACCOUNT_AVATAR_CONTENT_TYPES = ["image/jpeg", "image/png"] as const;

type AvatarFileLike = {
  name: string;
  size: number;
  type: string;
};

const avatarFileSchema = z
  .custom<AvatarFileLike>((value) => {
    if (!value || typeof value !== "object") {
      return false;
    }

    const candidate = value as Partial<AvatarFileLike>;
    return (
      typeof candidate.name === "string" &&
      typeof candidate.size === "number" &&
      typeof candidate.type === "string"
    );
  }, "Selecciona una imagen valida.")
  .refine((file) => ACCOUNT_AVATAR_CONTENT_TYPES.includes(file.type as (typeof ACCOUNT_AVATAR_CONTENT_TYPES)[number]), {
    message: "La imagen debe ser JPG o PNG.",
  })
  .refine((file) => file.size > 0 && file.size <= MAX_AVATAR_SIZE_BYTES, {
    message: "La imagen debe pesar como maximo 2 MB.",
  });

export const accountProfileSchema = z.object({
  name: z.string().trim().min(3, "Ingresa tu nombre").max(120, "El nombre es demasiado largo."),
  phone: z.string().trim().max(40, "El telefono es demasiado largo.").default(""),
  jobTitle: z.string().trim().max(120, "El cargo es demasiado largo.").default(""),
  bio: z.string().trim().max(320, "La descripcion profesional es demasiado larga.").default(""),
});

export const accountPasswordSchema = z
  .object({
    currentPassword: z.string().min(8, "Ingresa tu contrasena actual."),
    newPassword: z.string().min(8, "La nueva contrasena debe tener al menos 8 caracteres."),
    confirmPassword: z.string().min(8, "Confirma tu nueva contrasena."),
  })
  .refine((payload) => payload.newPassword === payload.confirmPassword, {
    message: "La confirmacion de contrasena no coincide.",
    path: ["confirmPassword"],
  });

export const accountAvatarUploadSchema = z.object({
  avatar: avatarFileSchema,
});

export type AccountProfileInput = z.infer<typeof accountProfileSchema>;
export type AccountPasswordInput = z.infer<typeof accountPasswordSchema>;
