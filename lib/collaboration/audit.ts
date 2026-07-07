import { prisma } from "@/lib/db/prisma";
import { resolveBudgetOwnership } from "./authorization";
import { serializeChangeEvent, buildFieldDiff } from "./serializers";
import { publishBudgetEvent } from "./events";
import type { BudgetChangeRecord, CollaborationChangeSource, CollaborationEntityType } from "@/types/collaboration";

type RawChangeEvent = Parameters<typeof serializeChangeEvent>[0];

interface RecordChangeEventInput {
  budgetId: string;
  userId: string | null;
  entityType: CollaborationEntityType;
  entityId: string;
  action: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  source?: CollaborationChangeSource;
  requestId?: string;
}

export async function recordBudgetChangeEvent(
  input: RecordChangeEventInput,
): Promise<BudgetChangeRecord> {
  // System/Khipu events don't have a userId, resolve ownership via budget alone
  let companyId: string;
  let projectId: string;
  if (input.userId) {
    const resolved = await resolveBudgetOwnership(input.budgetId, input.userId);
    companyId = resolved.companyId;
    projectId = resolved.projectId;
  } else {
    // Resolve without user check for system events
    const budget = await prisma.budget.findUnique({
      where: { id: input.budgetId },
      select: { projectId: true, project: { select: { companyId: true } } },
    });
    if (!budget) throw new Error("Presupuesto no encontrado");
    companyId = budget.project.companyId;
    projectId = budget.projectId;
  }

  const { diffSummary, hasChanged } = buildFieldDiff(input.field, input.oldValue, input.newValue);
  if (!hasChanged) {
    throw new Error("No change detected");
  }

  const event = await prisma.budgetChangeEvent.create({
    data: {
      companyId,
      projectId,
      budgetId: input.budgetId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      field: input.field,
      oldValue: input.oldValue,
      newValue: input.newValue,
      diffSummary,
      source: input.source ?? "USER",
      userId: input.userId,
      requestId: input.requestId ?? null,
    },
    include: {
      user: { select: { name: true } },
    },
  });

  const record = serializeChangeEvent(event as unknown as RawChangeEvent);
  publishBudgetEvent(input.budgetId, "change.created", record);
  return record;
}

export async function listBudgetChangeEvents(
  budgetId: string,
  userId: string,
  filters: {
    entityType?: CollaborationEntityType;
    entityId?: string;
    source?: CollaborationChangeSource;
    cursor?: string;
    limit?: number;
  } = {},
): Promise<BudgetChangeRecord[]> {
  await resolveBudgetOwnership(budgetId, userId);

  const { entityType, entityId, source, cursor, limit = 50 } = filters;

  const where: Record<string, unknown> = { budgetId };

  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  if (source) where.source = source;
  if (cursor) {
    where.createdAt = { lt: new Date(cursor) };
  }

  const events = await prisma.budgetChangeEvent.findMany({
    where: where as never,
    include: {
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return events.map((e) => serializeChangeEvent(e as unknown as RawChangeEvent));
}

/**
 * Records a batch of change events within a single context.
 * Useful for mutations that affect multiple fields at once.
 */
export async function recordBudgetChangeEvents(
  budgetId: string,
  userId: string | null,
  changes: Omit<RecordChangeEventInput, "budgetId" | "userId">[],
): Promise<BudgetChangeRecord[]> {
  const results: BudgetChangeRecord[] = [];

  for (const change of changes) {
    try {
      const record = await recordBudgetChangeEvent({
        ...change,
        budgetId,
        userId,
      });
      results.push(record);
    } catch {
      // skip no-change events
    }
  }

  return results;
}
