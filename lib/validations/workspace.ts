import { z } from "zod";

export const workspaceRoleSchema = z.enum(["OWNER", "ADMIN", "EDITOR", "VIEWER"]);

export const workspaceMembershipStatusSchema = z.enum(["ACTIVE", "INVITED", "SUSPENDED"]);

export const workspaceMembershipSchema = z.object({
  companyId: z.string().min(1),
  userId: z.string().min(1),
  role: workspaceRoleSchema,
  status: workspaceMembershipStatusSchema.default("ACTIVE"),
  invitedById: z.string().optional(),
});

export const activeWorkspaceSelectionSchema = z.object({
  companyId: z.string().min(1, "Workspace requerido"),
});

export const workspaceMemberUpdateSchema = z.object({
  role: workspaceRoleSchema.optional(),
  status: workspaceMembershipStatusSchema.optional(),
}).refine(
  (v) => v.role !== undefined || v.status !== undefined,
  { message: "No hay cambios para guardar" },
);

export const inviteWorkspaceMemberSchema = z.object({
  email: z.string().trim().min(1, "Email requerido").email("Email inválido"),
});

export const bulkInviteWorkspaceSchema = z.object({
  emailsText: z.string().trim().min(1, "Ingresa al menos un email").max(5000, "El lote es demasiado grande"),
});

export const changeRoleSchema = z.object({
  userId: z.string().min(1, "userId requerido"),
  role: workspaceRoleSchema,
});

export const assignCustomRoleSchema = z.object({
  userId: z.string().min(1, "userId requerido"),
  customRoleId: z.string().min(1).nullable(),
});

export const removeMemberSchema = z.object({
  userId: z.string().min(1, "userId requerido"),
});

export const transferWorkspaceOwnershipSchema = z.object({
  userId: z.string().min(1, "Miembro requerido"),
});

export const createWorkspaceRoleSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(60, "Nombre demasiado largo"),
  description: z.string().trim().max(200, "Descripción demasiado larga").nullish(),
  permissions: z.array(z.string().min(1)).max(50, "Demasiados permisos").default([]),
});

export const updateWorkspaceRoleSchema = createWorkspaceRoleSchema.extend({
  roleId: z.string().min(1, "Rol requerido"),
});

export const deleteWorkspaceRoleSchema = z.object({
  roleId: z.string().min(1, "Rol requerido"),
});

export const projectAccessRoleSchema = z.enum(["VIEWER", "EDITOR", "ADMIN"]);

export const shareProjectAccessSchema = z.object({
  userId: z.string().min(1, "Miembro requerido"),
  role: projectAccessRoleSchema.default("VIEWER"),
});

export const revokeProjectAccessSchema = z.object({
  userId: z.string().min(1, "Miembro requerido"),
});

export const createWorkspaceInviteLinkSchema = z.object({
  role: workspaceRoleSchema.exclude(["OWNER"]).default("VIEWER"),
  expiresInDays: z.number().int().min(1).max(30).default(7),
  maxUses: z.number().int().min(1).max(1000).nullable().default(null),
});

export const inviteLinkTokenSchema = z.object({
  token: z.string().trim().min(32),
});

export const toggleStatusSchema = z.object({
  userId: z.string().min(1, "userId requerido"),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  suspendedUntil: z.string().datetime().nullish(),
}).refine(
  (v) => v.status !== "SUSPENDED" || v.suspendedUntil == null || new Date(v.suspendedUntil) > new Date(),
  { message: "La fecha de suspensión debe ser futura" },
).refine(
  (v) => v.status === "SUSPENDED" || v.suspendedUntil == null,
  { message: "suspendedUntil solo aplica al suspender" },
);

export type WorkspaceMembershipInput = z.infer<typeof workspaceMembershipSchema>;
export type ActiveWorkspaceSelection = z.infer<typeof activeWorkspaceSelectionSchema>;
export type InviteWorkspaceMemberInput = z.infer<typeof inviteWorkspaceMemberSchema>;
