import { prisma } from "@/lib/db/prisma";
import { resolveBudgetOwnership } from "./authorization";
import { assertBudgetCollaborationAccess } from "./authorization";
import { serializeComment } from "./serializers";
import { publishBudgetEvent } from "./events";
import {
  commentCreateSchema,
  commentsQuerySchema,
  type CommentCreateInput,
} from "@/lib/validations/collaboration";
import type { CollaborationCommentRecord } from "@/types/collaboration";

type RawComment = Parameters<typeof serializeComment>[0];

export async function listCommentsForEntity(
  budgetId: string,
  userId: string,
  rawQuery: Record<string, unknown>,
): Promise<CollaborationCommentRecord[]> {
  const { companyId } = await resolveBudgetOwnership(budgetId, userId);
  const query = commentsQuerySchema.parse(rawQuery);

  const where: Record<string, unknown> = {
    budgetId,
    companyId,
  };

  if (query.entityType) where.entityType = query.entityType;
  if (query.entityId) where.entityId = query.entityId;
  if (query.entityType && query.entityId) await assertBudgetCollaborationAccess({ userId, budgetId, action: "READ", entity: { entityType: query.entityType, entityId: query.entityId } });
  if (query.cursor) {
    where.createdAt = { lt: new Date(query.cursor) };
  }

  const comments = await prisma.collaborationComment.findMany({
    where: where as never,
    include: {
      createdBy: { select: { name: true, avatarUrl: true } },
      resolvedBy: { select: { name: true } },
      _count: { select: { replies: true } },
    },
    orderBy: { createdAt: "desc" },
    take: query.limit,
  });

  return comments.map((c) => serializeComment(c as unknown as RawComment));
}

export async function createComment(
  budgetId: string,
  userId: string,
  input: CommentCreateInput,
): Promise<CollaborationCommentRecord> {
  const { companyId, projectId } = await resolveBudgetOwnership(budgetId, userId);
  const parsed = commentCreateSchema.parse(input);
  await assertBudgetCollaborationAccess({ userId, budgetId, action: "COMMENT", entity: parsed });
  const mentions = [...new Set(parsed.mentions)];
  if (mentions.length > 0) {
    const count = await prisma.companyMembership.count({ where: { companyId, userId: { in: mentions }, status: "ACTIVE" } });
    if (count !== mentions.length) throw new Error("Una o más menciones no pertenecen al proyecto");
  }
  if (parsed.parentCommentId) {
    const parent = await prisma.collaborationComment.findFirst({ where: { id: parsed.parentCommentId, budgetId, companyId, entityType: parsed.entityType, entityId: parsed.entityId }, select: { id: true } });
    if (!parent) throw new Error("El comentario padre no existe o no pertenece a la entidad");
  }

  const comment = await prisma.collaborationComment.create({
    data: {
      companyId,
      projectId,
      budgetId,
      entityType: parsed.entityType,
      entityId: parsed.entityId,
      parentCommentId: parsed.parentCommentId ?? null,
      body: parsed.body,
      mentions,
      createdById: userId,
    },
    include: {
      createdBy: { select: { name: true, avatarUrl: true } },
      resolvedBy: { select: { name: true } },
      _count: { select: { replies: true } },
    },
  });

  const record = serializeComment(comment as unknown as RawComment);
  publishBudgetEvent(budgetId, "comment.created", record);
  return record;
}

export async function replyToComment(
  budgetId: string,
  parentCommentId: string,
  userId: string,
  input: CommentCreateInput,
): Promise<CollaborationCommentRecord> {
  // Validate parent comment exists
  const parent = await prisma.collaborationComment.findUnique({
    where: { id: parentCommentId, budgetId },
    select: { id: true },
  });
  if (!parent) {
    throw new Error("El comentario padre no existe");
  }

  return createComment(budgetId, userId, {
    ...input,
    parentCommentId,
  });
}

export async function resolveComment(
  commentId: string,
  budgetId: string,
  userId: string,
  expectedUpdatedAt?: Date,
): Promise<CollaborationCommentRecord> {
  await resolveBudgetOwnership(budgetId, userId);

  await ensureCommentAccess(commentId, budgetId);

  const updated = await prisma.collaborationComment.updateMany({
    where: { id: commentId, budgetId, ...(expectedUpdatedAt ? { updatedAt: expectedUpdatedAt } : {}) },
    data: {
      resolvedAt: new Date(),
      resolvedById: userId,
    },
  });
  if (updated.count === 0) throw new Error("El comentario cambió; actualiza e inténtalo de nuevo");
  const result = await prisma.collaborationComment.findUniqueOrThrow({
    where: { id: commentId },
    include: {
      createdBy: { select: { name: true, avatarUrl: true } },
      resolvedBy: { select: { name: true } },
      _count: { select: { replies: true } },
    },
  });

  const record = serializeComment(result as unknown as RawComment);
  publishBudgetEvent(budgetId, "comment.updated", record);
  return record;
}

export async function reopenComment(
  commentId: string,
  budgetId: string,
  userId: string,
  expectedUpdatedAt?: Date,
): Promise<CollaborationCommentRecord> {
  await resolveBudgetOwnership(budgetId, userId);
  await ensureCommentAccess(commentId, budgetId);

  const updated = await prisma.collaborationComment.updateMany({
    where: { id: commentId, budgetId, ...(expectedUpdatedAt ? { updatedAt: expectedUpdatedAt } : {}) },
    data: {
      resolvedAt: null,
      resolvedById: null,
    },
  });
  if (updated.count === 0) throw new Error("El comentario cambió; actualiza e inténtalo de nuevo");
  const result = await prisma.collaborationComment.findUniqueOrThrow({
    where: { id: commentId },
    include: {
      createdBy: { select: { name: true, avatarUrl: true } },
      resolvedBy: { select: { name: true } },
      _count: { select: { replies: true } },
    },
  });

  const record = serializeComment(result as unknown as RawComment);
  publishBudgetEvent(budgetId, "comment.updated", record);
  return record;
}

async function ensureCommentAccess(commentId: string, budgetId: string) {
  const comment = await prisma.collaborationComment.findFirst({
    where: { id: commentId, budgetId },
    select: { id: true },
  });

  if (!comment) {
    throw new Error("Comentario no encontrado");
  }

  return comment;
}
