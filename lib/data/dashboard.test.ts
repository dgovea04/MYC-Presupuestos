import { describe, expect, it } from "vitest";

import { mapNoteTasksToPendingItems } from "@/lib/data/dashboard";
import type { NoteTaskRecord } from "@/types/notes";

describe("dashboard note pending items", () => {
  it("maps open note tasks to dashboard pending items", () => {
    const notes: NoteTaskRecord[] = [
      {
        id: "note-1",
        body: "Revisar metrado de concreto",
        priority: "HIGH",
        status: "OPEN",
        projectId: "project-1",
        projectName: "Colegio Sur",
        budgetName: "Estructuras",
        budgetItemCode: "01.01",
        budgetItemDescription: "Concreto",
        sourcePath: "/budgets/budget-1",
        createdAt: "2026-05-27T10:00:00.000Z",
        updatedAt: "2026-05-27T10:15:00.000Z",
      },
    ];

    expect(mapNoteTasksToPendingItems(notes)).toEqual([
      {
        id: "note-note-1",
        projectId: "project-1",
        projectName: "Colegio Sur",
        companyName: "Sticky note",
        status: "PLANNING",
        observation: "Revisar metrado de concreto",
        priority: "high",
        updatedAt: new Date("2026-05-27T10:15:00.000Z"),
        href: "/budgets/budget-1",
        type: "USER_NOTE_TASK",
      },
    ]);
  });
});
