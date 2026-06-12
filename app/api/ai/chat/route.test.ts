import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  attachProjectHistoryEntry: vi.fn(),
  executeAiTask: vi.fn(),
  withAiRoute: vi.fn(),
}));

vi.mock("@/lib/ai/project-history-route", () => ({
  attachProjectHistoryEntry: mocks.attachProjectHistoryEntry,
}));

vi.mock("@/lib/ai/route-handler", () => ({
  withAiRoute: mocks.withAiRoute,
}));

vi.mock("@/lib/ai/gateway/execute", () => ({
  executeAiTask: mocks.executeAiTask,
}));

import { POST } from "@/app/api/ai/chat/route";

describe("POST /api/ai/chat", () => {
  beforeEach(() => {
    mocks.attachProjectHistoryEntry.mockReset();
    mocks.executeAiTask.mockReset();
    mocks.withAiRoute.mockReset();
    mocks.withAiRoute.mockImplementation(async (handler: (session: { user: { id: string } }) => Promise<Response>) =>
      handler({ user: { id: "user-1" } }),
    );
    mocks.executeAiTask.mockResolvedValue({
      answer: "Respuesta tecnica",
      provider: "ollama",
      model: "llama3.1",
      requestedModel: "llama3.1",
      fallbackUsed: false,
      warnings: [],
    });
    mocks.attachProjectHistoryEntry.mockImplementation(async ({ result }: { result: object }) => ({
      ...result,
      historyEntry: { id: "history-1" },
    }));
  });

  it("records project history when projectId is provided", async () => {
    const response = await POST(
      new Request("http://localhost/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          message: "Consulta tecnica",
          provider: "ollama",
          projectId: "project-1",
          context: { project: "Hospital Norte", module: "APU" },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ historyEntry: { id: "history-1" } }));
    expect(mocks.executeAiTask).toHaveBeenCalledWith({
      provider: "ollama",
      task: "chat",
      payload: {
        message: "Consulta tecnica",
        context: { project: "Hospital Norte", module: "APU" },
      },
      projectId: "project-1",
      userId: "user-1",
    });
    expect(mocks.attachProjectHistoryEntry).toHaveBeenCalledWith({
      action: "chat",
      context: { project: "Hospital Norte", module: "APU" },
      projectId: "project-1",
      result: expect.objectContaining({ answer: "Respuesta tecnica" }),
      summary: "Consulta tecnica",
      userId: "user-1",
    });
  });

  it("keeps chat behavior when projectId is absent", async () => {
    await POST(
      new Request("http://localhost/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          message: "Consulta tecnica",
        }),
      }),
    );

    expect(mocks.attachProjectHistoryEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: undefined,
        summary: "Consulta tecnica",
      }),
    );
  });
});
