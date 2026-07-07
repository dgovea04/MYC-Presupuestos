import { z } from "zod";

const cuidSchema = z.string().min(1).max(30);

export const collaborationEntityTypeSchema = z.enum([
  "BUDGET",
  "BUDGET_ITEM",
  "APU",
  "APU_RESOURCE",
  "METRADO_SHEET",
  "METRADO_ROW",
  "WORK_SCHEDULE_ITEM",
]);

export const collaborationPresenceStatusSchema = z.enum(["ACTIVE", "IDLE"]);

export const collaborationChangeSourceSchema = z.enum(["USER", "SYSTEM", "KHIPU"]);

export const collaborationEntityRefSchema = z.object({
  entityType: collaborationEntityTypeSchema,
  entityId: cuidSchema,
});

export const commentCreateSchema = z.object({
  entityType: collaborationEntityTypeSchema,
  entityId: cuidSchema,
  parentCommentId: cuidSchema.optional(),
  body: z.string().trim().min(1, "El comentario no puede estar vacio").max(10_000),
  mentions: z.array(cuidSchema).max(50).default([]),
});

export const commentUpdateSchema = z.object({
  resolved: z.boolean().optional(),
});

export const presenceUpsertSchema = z.object({
  route: z.string().trim().min(1).max(500),
  module: z.string().trim().min(1).max(100),
  status: collaborationPresenceStatusSchema.default("ACTIVE"),
});

export const editSessionStartSchema = z.object({
  entityType: collaborationEntityTypeSchema,
  entityId: cuidSchema,
  field: z.string().trim().min(1).max(200),
});

export const editSessionHeartbeatSchema = z.object({});

export const changeEventQuerySchema = z.object({
  entityType: collaborationEntityTypeSchema.optional(),
  entityId: cuidSchema.optional(),
  source: collaborationChangeSourceSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const versionCreateSchema = z.object({
  label: z.string().trim().max(200).optional(),
  reason: z.string().trim().max(2000).optional(),
});

export const versionQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const commentsQuerySchema = z.object({
  entityType: collaborationEntityTypeSchema.optional(),
  entityId: cuidSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type CommentCreateInput = z.infer<typeof commentCreateSchema>;
export type CommentUpdateInput = z.infer<typeof commentUpdateSchema>;
export type PresenceUpsertInput = z.infer<typeof presenceUpsertSchema>;
export type EditSessionStartInput = z.infer<typeof editSessionStartSchema>;
export type VersionCreateInput = z.infer<typeof versionCreateSchema>;
