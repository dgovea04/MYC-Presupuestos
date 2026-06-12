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

import { POST } from "@/app/api/ai/apu/route";

describe("POST /api/ai/apu", () => {
  beforeEach(() => {
    mocks.attachProjectHistoryEntry.mockReset();
    mocks.executeAiTask.mockReset();
    mocks.withAiRoute.mockReset();
    mocks.withAiRoute.mockImplementation(async (handler: (session: { user: { id: string } }) => Promise<Response>) =>
      handler({ user: { id: "user-1" } }),
    );
    mocks.executeAiTask.mockResolvedValue({
      answer: "APU generado",
      provider: "openai",
      model: "gpt-5-mini",
      requestedModel: "gpt-5-mini",
      fallbackUsed: false,
      warnings: [],
    });
    mocks.attachProjectHistoryEntry.mockImplementation(async ({ result }: { result: object }) => ({
      ...result,
      historyEntry: { id: "history-apu" },
    }));
  });

  it("executes the Khipu APU task with an optional provider override", async () => {
    const response = await POST(
      new Request("http://localhost/api/ai/apu", {
        method: "POST",
        body: JSON.stringify({
          description: "Concreto f'c 210 kg/cm2",
          unit: "m3",
          provider: "openai",
          projectId: "project-1",
          context: { project: "Hospital Norte", module: "APU" },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ historyEntry: { id: "history-apu" } }));
    expect(mocks.executeAiTask).toHaveBeenCalledWith({
      provider: "openai",
      task: "generate_apu",
      payload: {
        description: "Concreto f'c 210 kg/cm2",
        unit: "m3",
        context: { project: "Hospital Norte", module: "APU" },
      },
      projectId: "project-1",
      userId: "user-1",
    });
    expect(mocks.attachProjectHistoryEntry).toHaveBeenCalledWith({
      action: "apu",
      context: { project: "Hospital Norte", module: "APU" },
      projectId: "project-1",
      result: expect.objectContaining({ answer: "APU generado" }),
      summary: "Concreto f'c 210 kg/cm2",
      userId: "user-1",
    });
  });
});
