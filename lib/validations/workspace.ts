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

export type WorkspaceMembershipInput = z.infer<typeof workspaceMembershipSchema>;
export type ActiveWorkspaceSelection = z.infer<typeof activeWorkspaceSelectionSchema>;
