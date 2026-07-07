import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/data/notes", () => ({
  deleteNoteTask: vi.fn(),
  updateNoteTask: vi.fn(),
}));

import { DELETE, PATCH } from "@/app/api/notes/[id]/route";
import { getAuthSession } from "@/lib/auth/session";
import { deleteNoteTask, updateNoteTask } from "@/lib/data/notes";
import type { NoteTaskRecord } from "@/types/notes";

function makeNote(overrides: Partial<NoteTaskRecord> = {}): NoteTaskRecord {
  return {
    id: "note-1",
    body: "Listo",
    priority: "LOW" as const,
    status: "RESOLVED" as const,
    sourcePath: "/dashboard",
    author: { name: "Test User", avatarUrl: null },
    sharedWith: [],
    createdAt: "2026-05-27T10:00:00.000Z",
    updatedAt: "2026-05-27T10:00:00.000Z",
    resolvedAt: "2026-05-27T10:00:00.000Z",
    ...overrides,
  };
}

describe("note detail route", () => {
  it("updates a note for the authenticated user", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(updateNoteTask).mockResolvedValue(makeNote());

    const response = await PATCH(
      new Request("http://localhost/api/notes/note-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "RESOLVED" }),
      }),
      { params: Promise.resolve({ id: "note-1" }) },
    );

    expect(response.status).toBe(200);
    expect(updateNoteTask).toHaveBeenCalledWith("note-1", "user-1", { status: "RESOLVED" });
  });

  it("deletes a note for the authenticated user", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(deleteNoteTask).mockResolvedValue(undefined);

    const response = await DELETE(new Request("http://localhost/api/notes/note-1"), {
      params: Promise.resolve({ id: "note-1" }),
    });

    expect(response.status).toBe(200);
    expect(deleteNoteTask).toHaveBeenCalledWith("note-1", "user-1");
  });
});
