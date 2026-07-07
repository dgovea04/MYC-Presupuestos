import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    noteTask: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/collaboration/events", () => ({
  publishBudgetEvent: vi.fn(),
}));

import { createNoteTask, updateNoteTask } from "@/lib/data/notes";
import { publishBudgetEvent } from "@/lib/collaboration/events";
import { prisma } from "@/lib/db/prisma";

const mockNoteTask = (prisma as unknown as {
  noteTask: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
}).noteTask;

function makeNote(overrides: Record<string, unknown> = {}) {
  return {
    id: "note-1",
    body: "Revisar metrado",
    priority: "MEDIUM" as const,
    status: "OPEN" as const,
    sourcePath: "/budgets/budget-1",
    sharedWith: [] as string[],
    userId: "user-1",
    budgetId: null as string | null,
    budgetItemId: null as string | null,
    projectId: null as string | null,
    user: { name: "Carlos", avatarUrl: null as string | null },
    project: null,
    budget: null,
    budgetItem: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    resolvedAt: null as Date | null,
    ...overrides,
  };
}

describe("note.shared SSE event emission", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("createNoteTask", () => {
    it("emits note.shared when created with shared users and a budgetId", async () => {
      mockNoteTask.create.mockResolvedValue(
        makeNote({ budgetId: "budget-1", sharedWith: ["user-2"] }),
      );

      await createNoteTask("user-1", {
        body: "Revisar metrado",
        priority: "MEDIUM",
        sourcePath: "/budgets/budget-1",
        budgetId: "budget-1",
        sharedWith: ["user-2"],
      });

      expect(publishBudgetEvent).toHaveBeenCalledWith(
        "budget-1",
        "note.shared",
        expect.objectContaining({
          noteId: "note-1",
          body: "Revisar metrado",
          sharedByUserId: "user-1",
          sharedWith: ["user-2"],
        }),
      );
    });

    it("does NOT emit when sharedWith is empty", async () => {
      mockNoteTask.create.mockResolvedValue(
        makeNote({ budgetId: "budget-1", sharedWith: [] }),
      );

      await createNoteTask("user-1", {
        body: "Nota sin compartir",
        priority: "LOW",
        sourcePath: "/dashboard",
        budgetId: "budget-1",
      });

      expect(publishBudgetEvent).not.toHaveBeenCalled();
    });

    it("does NOT emit when note has no budgetId", async () => {
      mockNoteTask.create.mockResolvedValue(
        makeNote({ budgetId: null, sharedWith: ["user-2"] }),
      );

      await createNoteTask("user-1", {
        body: "Nota sin presupuesto",
        priority: "HIGH",
        sourcePath: "/dashboard",
        sharedWith: ["user-2"],
      });

      expect(publishBudgetEvent).not.toHaveBeenCalled();
    });

    it("does NOT emit when sharedWith is not provided at all", async () => {
      mockNoteTask.create.mockResolvedValue(
        makeNote({ budgetId: "budget-1" }),
      );

      await createNoteTask("user-1", {
        body: "Nota simple",
        priority: "MEDIUM",
        sourcePath: "/dashboard",
        budgetId: "budget-1",
      });

      expect(publishBudgetEvent).not.toHaveBeenCalled();
    });
  });

  describe("updateNoteTask", () => {
    it("emits note.shared when new users are added to sharedWith", async () => {
      mockNoteTask.findFirst
        .mockResolvedValueOnce({ id: "note-1" })
        .mockResolvedValueOnce({
          sharedWith: ["user-2"],
          budgetId: "budget-1",
          body: "Revisar metrado",
          userId: "user-1",
        });
      mockNoteTask.update.mockResolvedValue(
        makeNote({ budgetId: "budget-1", sharedWith: ["user-2", "user-3"] }),
      );

      await updateNoteTask("note-1", "user-1", {
        sharedWith: ["user-2", "user-3"],
      });

      expect(publishBudgetEvent).toHaveBeenCalledWith(
        "budget-1",
        "note.shared",
        expect.objectContaining({
          noteId: "note-1",
          sharedByUserId: "user-1",
          sharedWith: ["user-3"],
        }),
      );
    });

    it("does NOT emit when no new users are added (remove-only change)", async () => {
      mockNoteTask.findFirst
        .mockResolvedValueOnce({ id: "note-1" })
        .mockResolvedValueOnce({
          sharedWith: ["user-2", "user-3"],
          budgetId: "budget-1",
          body: "Revisar metrado",
          userId: "user-1",
        });
      mockNoteTask.update.mockResolvedValue(
        makeNote({ budgetId: "budget-1", sharedWith: ["user-2"] }),
      );

      await updateNoteTask("note-1", "user-1", {
        sharedWith: ["user-2"],
      });

      expect(publishBudgetEvent).not.toHaveBeenCalled();
    });

    it("does NOT emit when sharedWith is unchanged", async () => {
      mockNoteTask.findFirst
        .mockResolvedValueOnce({ id: "note-1" })
        .mockResolvedValueOnce({
          sharedWith: ["user-2"],
          budgetId: "budget-1",
          body: "Revisar metrado",
          userId: "user-1",
        });
      mockNoteTask.update.mockResolvedValue(
        makeNote({ budgetId: "budget-1", sharedWith: ["user-2"] }),
      );

      await updateNoteTask("note-1", "user-1", {
        sharedWith: ["user-2"],
      });

      expect(publishBudgetEvent).not.toHaveBeenCalled();
    });

    it("does NOT emit when note has no budgetId", async () => {
      mockNoteTask.findFirst
        .mockResolvedValueOnce({ id: "note-1" })
        .mockResolvedValueOnce({
          sharedWith: [],
          budgetId: null,
          body: "Nota sin presupuesto",
          userId: "user-1",
        });
      mockNoteTask.update.mockResolvedValue(
        makeNote({ budgetId: null, sharedWith: ["user-2"] }),
      );

      await updateNoteTask("note-1", "user-1", {
        sharedWith: ["user-2"],
      });

      expect(publishBudgetEvent).not.toHaveBeenCalled();
    });

    it("does NOT emit when sharedWith is not in the update payload", async () => {
      mockNoteTask.findFirst
        .mockResolvedValueOnce({ id: "note-1" })
        .mockResolvedValueOnce(null);
      mockNoteTask.update.mockResolvedValue(
        makeNote({ budgetId: "budget-1" }),
      );

      await updateNoteTask("note-1", "user-1", {
        body: "Updated body",
      });

      expect(publishBudgetEvent).not.toHaveBeenCalled();
    });

    it("does NOT emit on status-only update", async () => {
      mockNoteTask.findFirst
        .mockResolvedValueOnce({ id: "note-1" })
        .mockResolvedValueOnce(null);
      mockNoteTask.update.mockResolvedValue(
        makeNote({ status: "RESOLVED" as const }),
      );

      await updateNoteTask("note-1", "user-1", {
        status: "RESOLVED",
      });

      expect(publishBudgetEvent).not.toHaveBeenCalled();
    });

    it("emits for multiple newly added users", async () => {
      mockNoteTask.findFirst
        .mockResolvedValueOnce({ id: "note-1" })
        .mockResolvedValueOnce({
          sharedWith: [],
          budgetId: "budget-1",
          body: "Revisar metrado",
          userId: "user-1",
        });
      mockNoteTask.update.mockResolvedValue(
        makeNote({ budgetId: "budget-1", sharedWith: ["user-2", "user-3", "user-4"] }),
      );

      await updateNoteTask("note-1", "user-1", {
        sharedWith: ["user-2", "user-3", "user-4"],
      });

      expect(publishBudgetEvent).toHaveBeenCalledWith(
        "budget-1",
        "note.shared",
        expect.objectContaining({
          sharedWith: ["user-2", "user-3", "user-4"],
        }),
      );
    });
  });
});
