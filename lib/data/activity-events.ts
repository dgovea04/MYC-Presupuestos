import { prisma } from "@/lib/db/prisma";
import { measureAsync } from "@/lib/platform/performance";
import type { ActivityEventType } from "@prisma/client";

type ActivityEventInput = {
  userId: string;
  type: ActivityEventType;
  title: string;
  detail: string;
  href: string;
};

export type ProjectActivityEvent = {
  id: string;
  type: ActivityEventType;
  title: string;
  detail: string;
  href: string;
  createdAt: Date;
};

export type BudgetTemplateCreationTraceability = {
  title: string;
  detail: string;
  href: string;
  createdAt: Date;
};

export type TemplateLibraryActivityEvent = {
  id: string;
  type: ActivityEventType;
  title: string;
  detail: string;
  href: string;
  createdAt: Date;
};

export async function recordActivityEvent(input: ActivityEventInput) {
  if (typeof (prisma as typeof prisma & { activityEvent?: unknown }).activityEvent === "undefined") {
    return;
  }

  await prisma.activityEvent.create({
    data: input,
  });
}

export async function listTemplateLibraryActivityEvents({
  userId,
  take = 5,
}: {
  userId: string;
  take?: number;
}): Promise<TemplateLibraryActivityEvent[]> {
  if (typeof (prisma as typeof prisma & { activityEvent?: unknown }).activityEvent === "undefined") {
    return [];
  }

  return prisma.activityEvent.findMany({
    where: {
      userId,
      OR: [
        { title: { startsWith: "Plantilla " } },
        {
          type: "BUDGET_CREATED",
          title: "Presupuesto creado desde plantilla",
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function listProjectActivityEvents({
  userId,
  projectId,
  budgetIds,
  take = 8,
}: {
  userId: string;
  projectId: string;
  budgetIds: string[];
  take?: number;
}): Promise<ProjectActivityEvent[]> {
  if (typeof (prisma as typeof prisma & { activityEvent?: unknown }).activityEvent === "undefined") {
    return [];
  }

  const hrefFilters = [
    { href: { startsWith: `/projects/${projectId}` } },
    ...budgetIds.map((budgetId) => ({ href: { startsWith: `/budgets/${budgetId}` } })),
  ];

  return prisma.activityEvent.findMany({
    where: {
      userId,
      OR: hrefFilters,
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function getBudgetTemplateCreationTraceability({
  userId,
  budgetId,
}: {
  userId: string;
  budgetId: string;
}): Promise<BudgetTemplateCreationTraceability | null> {
  if (typeof (prisma as typeof prisma & { activityEvent?: unknown }).activityEvent === "undefined") {
    return null;
  }

  const event = await measureAsync("data.activityEvents.budgetTemplateTraceability", () => prisma.activityEvent.findFirst({
    where: {
      userId,
      type: "BUDGET_CREATED",
      title: "Presupuesto creado desde plantilla",
      href: `/budgets/${budgetId}`,
    },
    orderBy: { createdAt: "desc" },
  }), { budgetId });

  if (!event) {
    return null;
  }

  return {
    title: event.title,
    detail: event.detail,
    href: event.href,
    createdAt: event.createdAt,
  };
}
