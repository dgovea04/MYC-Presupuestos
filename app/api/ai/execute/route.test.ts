import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  attachProjectHistoryEntry: vi.fn(),
  executeAiTask: vi.fn(),
  withAiRoute: vi.fn(),
}));

vi.mock("@/lib/ai/gateway/execute", () => ({
  executeAiTask: mocks.executeAiTask,
}));

vi.mock("@/lib/ai/project-history-route", () => ({
  attachProjectHistoryEntry: mocks.attachProjectHistoryEntry,
}));

vi.mock("@/lib/ai/route-handler", () => ({
  withAiRoute: mocks.withAiRoute,
}));

import { POST } from "@/app/api/ai/execute/route";

describe("POST /api/ai/execute", () => {
  beforeEach(() => {
    mocks.attachProjectHistoryEntry.mockReset();
    mocks.executeAiTask.mockReset();
    mocks.withAiRoute.mockReset();
    mocks.withAiRoute.mockImplementation(async (handler: (session: { user: { id: string } }) => Promise<Response>) =>
      handler({ user: { id: "user-1" } }),
    );
    mocks.executeAiTask.mockResolvedValue({
      answer: "Revision tecnica",
      provider: "ollama",
      model: "llama3.1",
      requestedModel: "llama3.1",
      fallbackUsed: false,
      warnings: [],
      promptHash: "prompt-hash",
      responseHash: "response-hash",
    });
    mocks.attachProjectHistoryEntry.mockImplementation(async ({ result }: { result: object }) => ({
      ...result,
      historyEntry: { id: "history-1" },
    }));
  });

  it("executes canonical AI tasks and records project history", async () => {
    const response = await POST(
      new Request("http://localhost/api/ai/execute", {
        method: "POST",
        body: JSON.stringify({
          task: "review_budget",
          payload: {
            budgetSummary: "Partida de concreto con costo alto",
          },
          projectId: "project-1",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ historyEntry: { id: "history-1" } }));
    expect(mocks.executeAiTask).toHaveBeenCalledWith({
      provider: "auto",
      task: "review_budget",
      payload: {
        budgetSummary: "Partida de concreto con costo alto",
      },
      projectId: "project-1",
      userId: "user-1",
    });
    expect(mocks.attachProjectHistoryEntry).toHaveBeenCalledWith({
      action: "review",
      context: undefined,
      projectId: "project-1",
      result: expect.objectContaining({ answer: "Revision tecnica" }),
      summary: "Partida de concreto con costo alto",
      userId: "user-1",
    });
  });

  it("rejects invalid canonical tasks", async () => {
    await expect(
      POST(
        new Request("http://localhost/api/ai/execute", {
          method: "POST",
          body: JSON.stringify({
            task: "unknown_task",
            payload: {},
          }),
        }),
      ),
    ).rejects.toThrow();
  });
});
