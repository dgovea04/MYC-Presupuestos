import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getAuthSession } from "@/lib/auth/session";
import { trackServerEvent } from "@/lib/analytics/events";
import { recordActivityEvent } from "@/lib/data/activity-events";
import { BUDGETS_LIST_CACHE_TAG, BUDGET_DETAIL_CACHE_TAG, deleteBudget, getBudgetDetailCacheTag, getBudgetHeaderById, getBudgetLiveUpdateSummaries, saveBudgetPatch, getBudgetById } from "@/lib/data/budgets";
import { getProjectOverviewCacheTag, PROJECT_OVERVIEW_CACHE_TAG } from "@/lib/data/projects";
import { recordBudgetChangeEvents } from "@/lib/collaboration/audit";
import type { CollaborationEntityType } from "@/types/collaboration";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id } = await params;

    // Fetch budget before save for audit diff
    let previousBudget: Awaited<ReturnType<typeof getBudgetById>> | null = null;
    try {
      previousBudget = await getBudgetById(id, session.user.id);
    } catch {
      // Audit best-effort only
    }

    const budget = await saveBudgetPatch(id, session.user.id, body);
    await safelyTrackApuCreated(body, id, session.user.id, session.user.activeCompanyId ?? session.user.companyId);
    
    await recordActivityEvent({
      userId: session.user.id,
      type: "BUDGET_UPDATED",
      title: "Presupuesto actualizado",
      detail: budget.name,
      href: `/budgets/${id}`,
    });

    // Record audit changes (best-effort)
    if (previousBudget) {
      recordBudgetChangeEvents(id, session.user.id, buildBudgetAuditDiffs(previousBudget, budget)).catch(() => {});
    }

    const optimisticBudgets = await getBudgetLiveUpdateSummaries(id, session.user.id);
    revalidateBudgetPaths(budget.projectId, id);
    return NextResponse.json({ budget, optimisticBudgets });
  } catch (error) {
    console.error("Budget PATCH failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar el presupuesto" }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const budget = await getBudgetHeaderById(id, session.user.id);
    if (!budget) {
      return NextResponse.json({ error: "No tienes permisos para eliminar este presupuesto" }, { status: 400 });
    }

    await deleteBudget(id, session.user.id);
    revalidateBudgetPaths(budget.projectId, id);
    if (budget.parentBudgetId) {
      revalidatePath(`/budgets/${budget.parentBudgetId}`);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo eliminar el presupuesto" }, { status: 400 });
  }
}

async function safelyTrackApuCreated(
  body: unknown,
  budgetId: string,
  userId: string,
  companyId?: string | null,
) {
  if (!containsApuWrite(body)) {
    return;
  }

  try {
    await trackServerEvent("apu_created", {
      userId,
      companyId,
      generalBudgetId: budgetId,
      creation_source: "budget_editor",
    });
  } catch {
    // Analytics must not turn a successful budget save into an API failure.
  }
}

function containsApuWrite(body: unknown): boolean {
  if (!isRecord(body)) {
    return false;
  }

  const items = body.items;
  if (!isRecord(items)) {
    return false;
  }

  const createdItems = Array.isArray(items.create) ? items.create : [];
  const updatedItems = Array.isArray(items.update) ? items.update : [];

  return (
    createdItems.some((item) => isRecord(item) && item.apu !== null && item.apu !== undefined) ||
    updatedItems.some((item) => isRecord(item) && isRecord(item.changes) && "apu" in item.changes)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function revalidateBudgetPaths(projectId: string, budgetId: string) {
  revalidatePath("/dashboard");
  revalidateTag("dashboard-stats", "max");
  revalidateTag("dashboard-analytics", "max");
  revalidateTag(BUDGETS_LIST_CACHE_TAG, "max");
  revalidateTag(BUDGET_DETAIL_CACHE_TAG, "max");
  revalidateTag(getBudgetDetailCacheTag(budgetId), "max");
  revalidateTag(PROJECT_OVERVIEW_CACHE_TAG, "max");
  revalidateTag(getProjectOverviewCacheTag(projectId), "max");
  revalidatePath("/budgets");
  revalidatePath(`/budgets/${budgetId}`);
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
}

type AuditDiff = {
  entityType: CollaborationEntityType;
  entityId: string;
  action: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
};

function buildBudgetAuditDiffs(
  previous: { name: string; currency: string; items: Array<{ id: string; description: string; quantity: number; unitPrice: number; partial: number }> },
  next: { name: string; currency: string; items: Array<{ id: string; description: string; quantity: number; unitPrice: number; partial: number }> },
): AuditDiff[] {
  const diffs: AuditDiff[] = [];

  if (previous.name !== next.name) {
    diffs.push({ entityType: "BUDGET", entityId: previous.name, action: "update", field: "name", oldValue: previous.name, newValue: next.name });
  }
  if (previous.currency !== next.currency) {
    diffs.push({ entityType: "BUDGET", entityId: previous.name, action: "update", field: "currency", oldValue: previous.currency, newValue: next.currency });
  }

  const prevItemsById = new Map(previous.items.map((i) => [i.id, i]));
  const nextItemsById = new Map(next.items.map((i) => [i.id, i]));

  for (const [itemId, nextItem] of nextItemsById) {
    const prevItem = prevItemsById.get(itemId);
    if (!prevItem) {
      diffs.push({ entityType: "BUDGET_ITEM", entityId: itemId, action: "create", field: "description", oldValue: null, newValue: nextItem.description });
      continue;
    }

    const fieldPairs: Array<["description" | "quantity" | "unitPrice" | "partial", string | number]> = [
      ["description", nextItem.description],
      ["quantity", nextItem.quantity],
      ["unitPrice", nextItem.unitPrice],
      ["partial", nextItem.partial],
    ];

    for (const [field, newVal] of fieldPairs) {
      const oldVal = prevItem[field];
      if (String(oldVal) !== String(newVal)) {
        diffs.push({
          entityType: "BUDGET_ITEM",
          entityId: itemId,
          action: "update",
          field,
          oldValue: String(oldVal),
          newValue: String(newVal),
        });
      }
    }
  }

  for (const [itemId, prevItem] of prevItemsById) {
    if (!nextItemsById.has(itemId)) {
      diffs.push({ entityType: "BUDGET_ITEM", entityId: itemId, action: "delete", field: "description", oldValue: prevItem.description, newValue: null });
    }
  }

  return diffs;
}
