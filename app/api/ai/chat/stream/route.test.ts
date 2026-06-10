import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  attachProjectHistoryEntry: vi.fn(),
  buildChatMessages: vi.fn(),
  streamChatAiResponse: vi.fn(),
  withAiRoute: vi.fn(),
}));

vi.mock("@/lib/ai/project-history-route", () => ({
  attachProjectHistoryEntry: mocks.attachProjectHistoryEntry,
}));

vi.mock("@/lib/ai/prompts", () => ({
  buildChatMessages: mocks.buildChatMessages,
}));

vi.mock("@/lib/ai/route-handler", () => ({
  withAiRoute: mocks.withAiRoute,
}));

vi.mock("@/lib/ai/service", () => ({
  streamChatAiResponse: mocks.streamChatAiResponse,
}));

import { POST } from "@/app/api/ai/chat/stream/route";

describe("POST /api/ai/chat/stream", () => {
  beforeEach(() => {
    mocks.attachProjectHistoryEntry.mockReset();
    mocks.buildChatMessages.mockReset();
    mocks.streamChatAiResponse.mockReset();
    mocks.withAiRoute.mockReset();
    mocks.withAiRoute.mockImplementation(async (handler: (session: { user: { id: string } }) => Promise<Response>) =>
      handler({ user: { id: "user-1" } }),
    );
    mocks.buildChatMessages.mockReturnValue([{ role: "user", content: "Consulta tecnica" }]);
    mocks.attachProjectHistoryEntry.mockImplementation(async ({ result }) => ({
      ...result,
      historyEntry: { id: "history-1" },
    }));
  });

  it("emits delta and final events for a streamed chat response", async () => {
    mocks.streamChatAiResponse.mockImplementation(async function* () {
      yield { type: "delta", text: "Hola " };
      yield {
        type: "final",
        result: {
          answer: "Hola obra",
          model: "llama3.1",
          requestedModel: "llama3.1",
          fallbackUsed: false,
          warnings: [],
        },
      };
    });

    const response = await POST(
      new Request("http://localhost/api/ai/chat/stream", {
        method: "POST",
        body: JSON.stringify({
          message: "Consulta tecnica",
          projectId: "project-1",
          context: { project: "Hospital Norte" },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const body = await response.text();
    expect(body).toContain('event: delta\ndata: {"text":"Hola "}');
    expect(body).toContain('event: final\ndata: {"answer":"Hola obra"');
    expect(body).toContain('"historyEntry":{"id":"history-1"}');
    expect(mocks.attachProjectHistoryEntry).toHaveBeenCalledWith({
      action: "chat",
      context: { project: "Hospital Norte" },
      projectId: "project-1",
      result: expect.objectContaining({ answer: "Hola obra" }),
      summary: "Consulta tecnica",
      userId: "user-1",
    });
  });

  it("emits an error event when streaming fails after the response starts", async () => {
    mocks.streamChatAiResponse.mockImplementation(async function* () {
      yield { type: "delta", text: "Hola" };
      throw new Error("stream failed");
    });

    const response = await POST(
      new Request("http://localhost/api/ai/chat/stream", {
        method: "POST",
        body: JSON.stringify({ message: "Consulta tecnica" }),
      }),
    );

    const body = await response.text();
    expect(body).toContain('event: delta\ndata: {"text":"Hola"}');
    expect(body).toContain('event: error\ndata: {"error":"stream failed"}');
  });
});
