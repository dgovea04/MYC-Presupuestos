import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordAiProjectHistory: vi.fn(),
}));

vi.mock("@/lib/ai/project-history", () => ({
  recordAiProjectHistory: mocks.recordAiProjectHistory,
}));

import { attachProjectHistoryEntry } from "@/lib/ai/project-history-route";
import type { AiEndpointResult } from "@/lib/ai/types";

describe("attachProjectHistoryEntry", () => {
  beforeEach(() => {
    mocks.recordAiProjectHistory.mockReset();
  });

  it("returns the original result when no project id is provided", async () => {
    const result = createResult();

    await expect(
      attachProjectHistoryEntry({
        action: "chat",
        context: { project: "Hospital Norte" },
        projectId: undefined,
        result,
        summary: "Consulta tecnica",
        userId: "user-1",
      }),
    ).resolves.toEqual(result);
    expect(mocks.recordAiProjectHistory).not.toHaveBeenCalled();
  });

  it("returns the result with a history entry when project history is saved", async () => {
    const result = createResult();
    mocks.recordAiProjectHistory.mockResolvedValue({
      id: "history-1",
      projectId: "project-1",
      userId: "user-1",
      action: "chat",
      summary: "Consulta tecnica",
      context: { project: "Hospital Norte" },
      result,
      timestamp: "2026-06-09T16:10:00.000Z",
    });

    await expect(
      attachProjectHistoryEntry({
        action: "chat",
        context: { project: "Hospital Norte" },
        projectId: "project-1",
        result,
        summary: "Consulta tecnica",
        userId: "user-1",
      }),
    ).resolves.toEqual({
      ...result,
      historyEntry: expect.objectContaining({ id: "history-1" }),
    });
  });

  it("keeps the AI answer when history persistence fails and appends a warning", async () => {
    const result = createResult();
    mocks.recordAiProjectHistory.mockRejectedValue(new Error("database down"));

    const response = await attachProjectHistoryEntry({
      action: "review",
      context: {},
      projectId: "project-1",
      result,
      summary: "Revision",
      userId: "user-1",
    });

    expect(response.answer).toBe("Respuesta tecnica");
    expect(response.warnings).toContain("Khipu respondio, pero no se pudo guardar el historial del proyecto.");
  });
});

function createResult(): AiEndpointResult {
  return {
    answer: "Respuesta tecnica",
    model: "llama3.1",
    requestedModel: "llama3.1",
    fallbackUsed: false,
    warnings: [],
    latencyMs: 320,
  };
}
