import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  attachProjectHistoryEntry: vi.fn(),
  withAiRoute: vi.fn(),
}));

vi.mock("@/lib/ai/project-history-route", () => ({
  attachProjectHistoryEntry: mocks.attachProjectHistoryEntry,
}));

vi.mock("@/lib/ai/route-handler", () => ({
  withAiRoute: mocks.withAiRoute,
}));

import { POST } from "@/app/api/ai/review/bridge/route";

describe("POST /api/ai/review/bridge", () => {
  beforeEach(() => {
    mocks.attachProjectHistoryEntry.mockReset();
    mocks.withAiRoute.mockReset();
    mocks.withAiRoute.mockImplementation(async (handler: (session: { user: { id: string } }) => Promise<Response>) =>
      handler({ user: { id: "user-1" } }),
    );
    mocks.attachProjectHistoryEntry.mockImplementation(async ({ result }: { result: object }) => ({
      ...result,
      historyEntry: { id: "history-review-bridge" },
    }));
  });

  it("persists a bridge budget review into project history", async () => {
    const budgetSummary = "Resumen del presupuesto revisado via ChatGPT Bridge.";
    const response = await POST(
      new Request("http://localhost/api/ai/review/bridge", {
        method: "POST",
        body: JSON.stringify({
          projectId: "project-1",
          budgetSummary,
          context: { project: "Hospital Norte", module: "Editor de presupuesto", activeTable: "Presupuesto" },
          result: {
            answer: "Se detectaron partidas similares.",
            model: "ChatGPT Bridge",
            requestedModel: "ChatGPT web",
            fallbackUsed: false,
            warnings: [],
            structuredData: {
              answer: "Se detectaron partidas similares.",
              findings: [],
              assumptions: [],
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ historyEntry: { id: "history-review-bridge" } }));
    expect(mocks.attachProjectHistoryEntry).toHaveBeenCalledWith({
      action: "review",
      context: { project: "Hospital Norte", module: "Editor de presupuesto", activeTable: "Presupuesto" },
      projectId: "project-1",
      result: expect.objectContaining({
        answer: "Se detectaron partidas similares.",
        provider: "chatgpt_bridge",
        task: "review_budget",
      }),
      summary: budgetSummary.slice(0, 140),
      userId: "user-1",
    });
  });
});
