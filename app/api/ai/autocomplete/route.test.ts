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

import { POST } from "@/app/api/ai/autocomplete/route";

describe("POST /api/ai/autocomplete", () => {
  beforeEach(() => {
    mocks.attachProjectHistoryEntry.mockReset();
    mocks.executeAiTask.mockReset();
    mocks.withAiRoute.mockReset();
    mocks.withAiRoute.mockImplementation(async (handler: (session: { user: { id: string } }) => Promise<Response>) =>
      handler({ user: { id: "user-1" } }),
    );
    mocks.executeAiTask.mockResolvedValue({
      answer: "Concreto premezclado f'c 210 kg/cm2",
      provider: "ollama",
      model: "llama3.1",
      requestedModel: "llama3.1",
      fallbackUsed: false,
      warnings: [],
    });
    mocks.attachProjectHistoryEntry.mockImplementation(async ({ result }: { result: object }) => ({
      ...result,
      historyEntry: { id: "history-autocomplete" },
    }));
  });

  it("executes the Khipu autocomplete task with an optional provider override", async () => {
    const response = await POST(
      new Request("http://localhost/api/ai/autocomplete", {
        method: "POST",
        body: JSON.stringify({
          input: "Concreto pre",
          provider: "ollama",
          projectId: "project-1",
          context: { project: "Hospital Norte", activeTable: "Partidas" },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ historyEntry: { id: "history-autocomplete" } }));
    expect(mocks.executeAiTask).toHaveBeenCalledWith({
      provider: "ollama",
      task: "autocomplete",
      payload: {
        input: "Concreto pre",
        context: { project: "Hospital Norte", activeTable: "Partidas" },
      },
      projectId: "project-1",
      userId: "user-1",
    });
    expect(mocks.attachProjectHistoryEntry).toHaveBeenCalledWith({
      action: "autocomplete",
      context: { project: "Hospital Norte", activeTable: "Partidas" },
      projectId: "project-1",
      result: expect.objectContaining({ answer: "Concreto premezclado f'c 210 kg/cm2" }),
      summary: "Concreto pre",
      userId: "user-1",
    });
  });
});
