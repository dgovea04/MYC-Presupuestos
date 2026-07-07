import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/data/notes", () => ({
  createNoteTask: vi.fn(),
  listNoteTasks: vi.fn(),
}));

import { GET, POST } from "@/app/api/notes/route";
import { getAuthSession } from "@/lib/auth/session";
import { createNoteTask, listNoteTasks } from "@/lib/data/notes";
import type { NoteTaskRecord } from "@/types/notes";

function makeNote(overrides: Partial<NoteTaskRecord> = {}): NoteTaskRecord {
  return {
    id: "note-1",
    body: "Revisar",
    priority: "MEDIUM" as const,
    status: "OPEN" as const,
    sourcePath: "/dashboard",
    author: { name: "Test User", avatarUrl: null },
    sharedWith: [],
    createdAt: "2026-05-27T10:00:00.000Z",
    updatedAt: "2026-05-27T10:00:00.000Z",
    ...overrides,
  };
}

describe("notes route", () => {
  it("requires authentication for listing notes", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/notes"));

    expect(response.status).toBe(401);
  });

  it("passes query filters to the note service", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(listNoteTasks).mockResolvedValue([]);

    const response = await GET(new Request("http://localhost/api/notes?status=OPEN&budgetId=budget-1"));

    expect(response.status).toBe(200);
    expect(listNoteTasks).toHaveBeenCalledWith("user-1", {
      status: "OPEN",
      projectId: undefined,
      budgetId: "budget-1",
      budgetItemId: undefined,
      sourcePath: undefined,
    });
  });

  it("creates notes for the authenticated user", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(createNoteTask).mockResolvedValue(makeNote());

    const response = await POST(
      new Request("http://localhost/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "Revisar", priority: "MEDIUM", sourcePath: "/dashboard" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(createNoteTask).toHaveBeenCalledWith("user-1", {
      body: "Revisar",
      priority: "MEDIUM",
      sourcePath: "/dashboard",
    });
  });
});
