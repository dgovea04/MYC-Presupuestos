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

import { POST } from "@/app/api/ai/review/route";

describe("POST /api/ai/review", () => {
  beforeEach(() => {
    mocks.attachProjectHistoryEntry.mockReset();
    mocks.executeAiTask.mockReset();
    mocks.withAiRoute.mockReset();
    mocks.withAiRoute.mockImplementation(async (handler: (session: { user: { id: string } }) => Promise<Response>) =>
      handler({ user: { id: "user-1" } }),
    );
    mocks.executeAiTask.mockResolvedValue({
      answer: "Revision generada",
      provider: "gemini",
      model: "gemini-2.5-flash",
      requestedModel: "gemini-2.5-flash",
      fallbackUsed: false,
      warnings: [],
    });
    mocks.attachProjectHistoryEntry.mockImplementation(async ({ result }: { result: object }) => ({
      ...result,
      historyEntry: { id: "history-review" },
    }));
  });

  it("executes the Khipu budget review task with an optional provider override", async () => {
    const budgetSummary = "Partida de acero con costo unitario mayor al promedio historico.";
    const response = await POST(
      new Request("http://localhost/api/ai/review", {
        method: "POST",
        body: JSON.stringify({
          budgetSummary,
          provider: "gemini",
          projectId: "project-1",
          context: { project: "Hospital Norte", module: "Presupuesto" },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ historyEntry: { id: "history-review" } }));
    expect(mocks.executeAiTask).toHaveBeenCalledWith({
      provider: "gemini",
      task: "review_budget",
      payload: {
        budgetSummary,
        context: { project: "Hospital Norte", module: "Presupuesto" },
      },
      projectId: "project-1",
      userId: "user-1",
    });
    expect(mocks.attachProjectHistoryEntry).toHaveBeenCalledWith({
      action: "review",
      context: { project: "Hospital Norte", module: "Presupuesto" },
      projectId: "project-1",
      result: expect.objectContaining({ answer: "Revision generada" }),
      summary: budgetSummary.slice(0, 140),
      userId: "user-1",
    });
  });
});
