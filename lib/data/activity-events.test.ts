import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    activityEvent: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock,
}));

import {
  getBudgetTemplateCreationTraceability,
  listProjectActivityEvents,
  listTemplateLibraryActivityEvents,
  recordActivityEvent,
} from "@/lib/data/activity-events";

describe("activity events data", () => {
  beforeEach(() => {
    prismaMock.activityEvent.create.mockReset();
    prismaMock.activityEvent.findFirst.mockReset();
    prismaMock.activityEvent.findMany.mockReset();
  });

  it("records an activity event through the Prisma delegate", async () => {
    await recordActivityEvent({
      userId: "user-1",
      type: "PROJECT_UPDATED",
      title: "Proyecto actualizado",
      detail: "Hospital Norte",
      href: "/projects/project-1",
    });

    expect(prismaMock.activityEvent.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        type: "PROJECT_UPDATED",
        title: "Proyecto actualizado",
        detail: "Hospital Norte",
        href: "/projects/project-1",
      },
    });
  });

  it("lists activity scoped to a project and its budgets", async () => {
    prismaMock.activityEvent.findMany.mockResolvedValue([
      {
        id: "activity-1",
        userId: "user-1",
        type: "BUDGET_UPDATED",
        title: "Presupuesto actualizado",
        detail: "Presupuesto General",
        href: "/budgets/budget-1",
        createdAt: new Date("2026-05-20T10:00:00.000Z"),
      },
    ]);

    const events = await listProjectActivityEvents({
      userId: "user-1",
      projectId: "project-1",
      budgetIds: ["budget-1", "budget-2"],
      take: 5,
    });

    expect(events).toHaveLength(1);
    expect(prismaMock.activityEvent.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        OR: [
          { href: { startsWith: "/projects/project-1" } },
          { href: { startsWith: "/budgets/budget-1" } },
          { href: { startsWith: "/budgets/budget-2" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
  });

  it("lists reusable template activity for the library", async () => {
    const createdAt = new Date("2026-05-30T12:00:00.000Z");
    prismaMock.activityEvent.findMany.mockResolvedValue([
      {
        id: "activity-template-1",
        userId: "user-1",
        type: "BUDGET_UPDATED",
        title: "Plantilla duplicada",
        detail: "Arquitectura copia",
        href: "/templates/budget/template-copy",
        createdAt,
      },
    ]);

    const events = await listTemplateLibraryActivityEvents({
      userId: "user-1",
      take: 3,
    });

    expect(events).toEqual([
      {
        id: "activity-template-1",
        userId: "user-1",
        type: "BUDGET_UPDATED",
        title: "Plantilla duplicada",
        detail: "Arquitectura copia",
        href: "/templates/budget/template-copy",
        createdAt,
      },
    ]);
    expect(prismaMock.activityEvent.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        OR: [
          { title: { startsWith: "Plantilla " } },
          {
            type: "BUDGET_CREATED",
            title: "Presupuesto creado desde plantilla",
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    });
  });

  it("finds template creation traceability for a budget", async () => {
    const createdAt = new Date("2026-05-29T22:30:00.000Z");
    prismaMock.activityEvent.findFirst.mockResolvedValue({
      id: "activity-1",
      userId: "user-1",
      type: "BUDGET_CREATED",
      title: "Presupuesto creado desde plantilla",
      detail: "Arquitectura desde Base tecnica",
      href: "/budgets/budget-1",
      createdAt,
    });

    const traceability = await getBudgetTemplateCreationTraceability({
      userId: "user-1",
      budgetId: "budget-1",
    });

    expect(traceability).toEqual({
      title: "Presupuesto creado desde plantilla",
      detail: "Arquitectura desde Base tecnica",
      href: "/budgets/budget-1",
      createdAt,
    });
    expect(prismaMock.activityEvent.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        type: "BUDGET_CREATED",
        title: "Presupuesto creado desde plantilla",
        href: "/budgets/budget-1",
      },
      orderBy: { createdAt: "desc" },
    });
  });
});
