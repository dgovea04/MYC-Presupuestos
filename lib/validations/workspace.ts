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

export const changeRoleSchema = z.object({
  userId: z.string().min(1, "userId requerido"),
  role: workspaceRoleSchema,
});

export const removeMemberSchema = z.object({
  userId: z.string().min(1, "userId requerido"),
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
