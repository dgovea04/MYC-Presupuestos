import { prisma } from "@/lib/db/prisma";
import { resolveBudgetOwnership } from "./authorization";
import { serializeComment } from "./serializers";
import { publishBudgetEvent } from "./events";
import {
  commentCreateSchema,
  commentUpdateSchema,
  commentsQuerySchema,
  type CommentCreateInput,
  type CommentUpdateInput,
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

  const comment = await prisma.collaborationComment.create({
    data: {
      companyId,
      projectId,
      budgetId,
      entityType: parsed.entityType,
      entityId: parsed.entityId,
      parentCommentId: parsed.parentCommentId ?? null,
      body: parsed.body,
      mentions: parsed.mentions,
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
): Promise<CollaborationCommentRecord> {
  await resolveBudgetOwnership(budgetId, userId);

  const comment = await ensureCommentAccess(commentId, budgetId);

  const updated = await prisma.collaborationComment.update({
    where: { id: commentId },
    data: {
      resolvedAt: new Date(),
      resolvedById: userId,
    },
    include: {
      createdBy: { select: { name: true, avatarUrl: true } },
      resolvedBy: { select: { name: true } },
      _count: { select: { replies: true } },
    },
  });

  const record = serializeComment(updated as unknown as RawComment);
  publishBudgetEvent(budgetId, "comment.updated", record);
  return record;
}

export async function reopenComment(
  commentId: string,
  budgetId: string,
  userId: string,
): Promise<CollaborationCommentRecord> {
  await resolveBudgetOwnership(budgetId, userId);
  await ensureCommentAccess(commentId, budgetId);

  const updated = await prisma.collaborationComment.update({
    where: { id: commentId },
    data: {
      resolvedAt: null,
      resolvedById: null,
    },
    include: {
      createdBy: { select: { name: true, avatarUrl: true } },
      resolvedBy: { select: { name: true } },
      _count: { select: { replies: true } },
    },
  });

  const record = serializeComment(updated as unknown as RawComment);
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
