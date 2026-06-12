import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  getProjectAiMemory: vi.fn(),
  getProjectHeaderById: vi.fn(),
  recordProjectAiMemory: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/ai/context/project-memory", () => ({
  getProjectAiMemory: mocks.getProjectAiMemory,
  recordProjectAiMemory: mocks.recordProjectAiMemory,
}));

vi.mock("@/lib/data/projects", () => ({
  getProjectHeaderById: mocks.getProjectHeaderById,
}));

import { GET, POST } from "@/app/api/projects/[id]/ai-memory/route";

describe("/api/projects/[id]/ai-memory", () => {
  beforeEach(() => {
    mocks.getAuthSession.mockReset();
    mocks.getProjectAiMemory.mockReset();
    mocks.getProjectHeaderById.mockReset();
    mocks.recordProjectAiMemory.mockReset();
  });

  it("returns memory facts after verifying project access", async () => {
    const entries = [
      {
        id: "memory-1",
        projectId: "project-1",
        memoryType: "FACT",
        fact: "Proyecto usa excavadora CAT 320",
        confidence: "0.850",
        source: "user",
        timestamp: "2026-06-11T10:00:00.000Z",
      },
    ];
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectHeaderById.mockResolvedValue({ id: "project-1", name: "Hospital Norte" });
    mocks.getProjectAiMemory.mockResolvedValue(entries);

    const response = await GET(new Request("http://localhost/api/projects/project-1/ai-memory?limit=5"), {
      params: Promise.resolve({ id: "project-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ entries });
    expect(mocks.getProjectAiMemory).toHaveBeenCalledWith({ projectId: "project-1", userId: "user-1", limit: 5 });
  });

  it("records a memory fact after verifying project access", async () => {
    const entry = {
      id: "memory-1",
      projectId: "project-1",
      memoryType: "FACT",
      fact: "Proyecto usa excavadora CAT 320",
      confidence: "0.850",
      source: "user",
      timestamp: "2026-06-11T10:00:00.000Z",
    };
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectHeaderById.mockResolvedValue({ id: "project-1", name: "Hospital Norte" });
    mocks.recordProjectAiMemory.mockResolvedValue(entry);

    const response = await POST(
      new Request("http://localhost/api/projects/project-1/ai-memory", {
        method: "POST",
        body: JSON.stringify({
          memoryType: "FACT",
          fact: "Proyecto usa excavadora CAT 320",
          confidence: "0.85",
          source: "user",
        }),
      }),
      {
        params: Promise.resolve({ id: "project-1" }),
      },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ entry });
    expect(mocks.recordProjectAiMemory).toHaveBeenCalledWith({
      projectId: "project-1",
      userId: "user-1",
      memoryType: "FACT",
      fact: "Proyecto usa excavadora CAT 320",
      confidence: "0.85",
      source: "user",
    });
  });

  it("returns 404 when the project is inaccessible", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getProjectHeaderById.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/projects/project-1/ai-memory"), {
      params: Promise.resolve({ id: "project-1" }),
    });

    expect(response.status).toBe(404);
    expect(mocks.getProjectAiMemory).not.toHaveBeenCalled();
  });
});
