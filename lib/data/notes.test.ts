import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    noteTask: {
      findMany: mocks.findMany,
      findFirst: mocks.findFirst,
      create: mocks.create,
      update: mocks.update,
      delete: mocks.delete,
    },
  },
}));

import { createNoteTask, listNoteTasks, updateNoteTask } from "@/lib/data/notes";

const createdAt = new Date("2026-05-27T10:00:00.000Z");
const updatedAt = new Date("2026-05-27T10:15:00.000Z");

describe("note task data", () => {
  beforeEach(() => {
    mocks.findMany.mockReset();
    mocks.findFirst.mockReset();
    mocks.create.mockReset();
    mocks.update.mockReset();
    mocks.delete.mockReset();
  });

  it("lists only the current user's open notes and includes optional context labels", async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: "note-1",
        userId: "user-1",
        projectId: "project-1",
        budgetId: "budget-1",
        budgetItemId: "item-1",
        body: "Revisar partida",
        priority: "HIGH",
        status: "OPEN",
        sourcePath: "/budgets/budget-1",
        createdAt,
        updatedAt,
        resolvedAt: null,
        project: { name: "Colegio Sur" },
        budget: { name: "Estructuras" },
        budgetItem: { code: "01.01", description: "Concreto f'c=210" },
      },
    ]);

    await expect(listNoteTasks("user-1", { status: "OPEN", budgetId: "budget-1" })).resolves.toEqual([
      {
        id: "note-1",
        body: "Revisar partida",
        priority: "HIGH",
        status: "OPEN",
        projectId: "project-1",
        budgetId: "budget-1",
        budgetItemId: "item-1",
        projectName: "Colegio Sur",
        budgetName: "Estructuras",
        budgetItemCode: "01.01",
        budgetItemDescription: "Concreto f'c=210",
        sourcePath: "/budgets/budget-1",
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        resolvedAt: undefined,
      },
    ]);
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          status: "OPEN",
          budgetId: "budget-1",
        }),
      }),
    );
  });

  it("creates a private note for the current user", async () => {
    mocks.create.mockResolvedValue({
      id: "note-2",
      userId: "user-1",
      projectId: null,
      budgetId: null,
      budgetItemId: null,
      body: "Llamar al residente",
      priority: "MEDIUM",
      status: "OPEN",
      sourcePath: "/dashboard",
      createdAt,
      updatedAt,
      resolvedAt: null,
      project: null,
      budget: null,
      budgetItem: null,
    });

    await createNoteTask("user-1", {
      body: "Llamar al residente",
      priority: "MEDIUM",
      sourcePath: "/dashboard",
    });

    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        body: "Llamar al residente",
        priority: "MEDIUM",
        sourcePath: "/dashboard",
        projectId: null,
        budgetId: null,
        budgetItemId: null,
      },
      include: expect.any(Object),
    });
  });

  it("updates only notes owned by the current user and stamps resolvedAt", async () => {
    mocks.findFirst.mockResolvedValue({ id: "note-1" });
    mocks.update.mockResolvedValue({
      id: "note-1",
      userId: "user-1",
      projectId: null,
      budgetId: null,
      budgetItemId: null,
      body: "Resolver observacion",
      priority: "LOW",
      status: "RESOLVED",
      sourcePath: "/dashboard",
      createdAt,
      updatedAt,
      resolvedAt: updatedAt,
      project: null,
      budget: null,
      budgetItem: null,
    });

    await updateNoteTask("note-1", "user-1", { status: "RESOLVED" });

    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        id: "note-1",
        userId: "user-1",
      },
      select: { id: true },
    });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "note-1" },
      data: expect.objectContaining({
        status: "RESOLVED",
        resolvedAt: expect.any(Date),
      }),
      include: expect.any(Object),
    });
  });
});
