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
          context: {
            route: "/projects/project-1/budgets/budget-1",
            projectId: "project-1",
            budgetId: "budget-1",
            module: "Presupuestos",
            selectedItem: "Partida de concreto",
            selectionType: "partida",
            selectionId: "partida-1",
            unit: "m3",
            currentCost: 420,
            activeTable: "presupuesto",
            viewSummary: "Partida de concreto en el presupuesto activo",
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.headers.get("x-accel-buffering")).toBe("no");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    const body = await response.text();
    expect(body).toContain('event: delta\ndata: {"text":"Hola "}');
    expect(body).toContain('event: final\ndata: {"answer":"Hola obra"');
    expect(body).toContain('"historyEntry":{"id":"history-1"}');
    expect(mocks.buildChatMessages).toHaveBeenCalledWith({
      message: "Consulta tecnica",
      projectId: "project-1",
      provider: "auto",
      context: {
        route: "/projects/project-1/budgets/budget-1",
        projectId: "project-1",
        budgetId: "budget-1",
        module: "Presupuestos",
        selectedItem: "Partida de concreto",
        selectionType: "partida",
        selectionId: "partida-1",
        unit: "m3",
        currentCost: 420,
        activeTable: "presupuesto",
        viewSummary: "Partida de concreto en el presupuesto activo",
      },
    });
    expect(mocks.attachProjectHistoryEntry).toHaveBeenCalledWith({
      action: "chat",
      context: {
        route: "/projects/project-1/budgets/budget-1",
        projectId: "project-1",
        budgetId: "budget-1",
        module: "Presupuestos",
        selectedItem: "Partida de concreto",
        selectionType: "partida",
        selectionId: "partida-1",
        unit: "m3",
        currentCost: 420,
        activeTable: "presupuesto",
        viewSummary: "Partida de concreto en el presupuesto activo",
      },
      projectId: "project-1",
      result: expect.objectContaining({ answer: "Hola obra" }),
      summary: "Consulta tecnica",
      userId: "user-1",
    });
  });

  it("makes the first delta readable before the final event resolves", async () => {
    let resolveFinal: () => void = () => undefined;
    const waitForFinal = new Promise<void>((resolve) => {
      resolveFinal = resolve;
    });
    mocks.streamChatAiResponse.mockImplementation(async function* () {
      yield { type: "delta", text: "Hola " };
      await waitForFinal;
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
        body: JSON.stringify({ message: "Consulta tecnica" }),
      }),
    );

    const reader = response.body?.getReader();
    expect(reader).toBeTruthy();
    const decoder = new TextDecoder();
    let firstChunk = "";

    while (!firstChunk.includes("event: delta")) {
      const nextRead = await reader?.read();
      expect(nextRead?.done).toBe(false);
      firstChunk += decoder.decode(nextRead?.value);
    }

    expect(firstChunk).toContain('event: delta\ndata: {"text":"Hola "}');
    expect(firstChunk).not.toContain("event: final");

    resolveFinal();
    reader?.releaseLock();
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
