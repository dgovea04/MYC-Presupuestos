/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAgentStream } from "@/hooks/use-agent-stream";
import type { AgentStreamInput } from "@/hooks/use-agent-stream";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type SseEvent = { event: string; data: Record<string, unknown> };

/**
 * Crea un ReadableStream que emite SSE frames para testear el hook.
 */
function makeSseStream(events: SseEvent[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chunks = events
    .map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`)
    .join("");

  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`: ${" ".repeat(2048)}\n\n`));
      controller.enqueue(encoder.encode(chunks));
      controller.close();
    },
  });
}

function mockFetchOk(stream: ReadableStream<Uint8Array>) {
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(stream, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    }),
  );
}

function mockFetchError(status: number, body: Record<string, unknown>) {
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function connectInput(overrides: Partial<AgentStreamInput> = {}): AgentStreamInput {
  return {
    message: "Crear presupuesto",
    mode: "goal",
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("useAgentStream", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Initial state ───────────────────────────────────────────────────────

  describe("initial state", () => {
    it("starts with idle status and empty state", () => {
      const { result } = renderHook(() => useAgentStream());

      expect(result.current.status).toBe("idle");
      expect(result.current.messages).toEqual([]);
      expect(result.current.execution.state).toBeNull();
      expect(result.current.execution.toolActivity).toEqual([]);
      expect(result.current.error).toBeNull();
      expect(result.current.execution.pendingApproval).toBeNull();
    });
  });

  // ─── connect ────────────────────────────────────────────────────────────

  describe("connect", () => {
    it("sets status to connecting immediately", async () => {
      const { result } = renderHook(() => useAgentStream());

      // Don't await — we want to check the intermediate state
      act(() => {
        result.current.connect(connectInput());
      });

      expect(result.current.status).toBe("connecting");
    });

    it("adds user message and assistant response", async () => {
      const stream = makeSseStream([
        { event: "delta", data: { text: "Respuesta." } },
        { event: "final", data: { answer: "Ok", warnings: [], latencyMs: 100 } },
      ]);
      mockFetchOk(stream);

      const { result } = renderHook(() => useAgentStream());
      await act(async () => {
        await result.current.connect(connectInput({ message: "Crea presupuesto" }));
      });

      // user message + assistant message (delta appended to placeholder)
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0]).toEqual({
        role: "user",
        content: "Crea presupuesto",
      });
      expect(result.current.messages[1].role).toBe("assistant");
      expect(result.current.messages[1].content).toBe("Respuesta.");
    });

    it("makes a POST request to /api/ai/agent/stream", async () => {
      const stream = makeSseStream([
        { event: "final", data: { answer: "Ok", warnings: [], latencyMs: 50 } },
      ]);
      mockFetchOk(stream);

      const { result } = renderHook(() => useAgentStream());
      await act(async () => {
        await result.current.connect(connectInput({
          message: "Crea presupuesto para hospital",
          projectId: "project-42",
          mode: "goal",
        }));
      });

      expect(fetch).toHaveBeenCalledWith(
        "/api/ai/agent/stream",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "Crea presupuesto para hospital",
            projectId: "project-42",
            mode: "goal",
          }),
        }),
      );
    });

    it("transitions to streaming when response body starts arriving", async () => {
      const stream = makeSseStream([
        { event: "delta", data: { text: "Hola" } },
        { event: "final", data: { answer: "Ok", warnings: [], latencyMs: 50 } },
      ]);
      mockFetchOk(stream);

      const { result } = renderHook(() => useAgentStream());
      await act(async () => {
        await result.current.connect(connectInput());
      });

      expect(result.current.status).toBe("done");
    });

    it("handles HTTP error response gracefully", async () => {
      mockFetchError(400, { error: "Mensaje requerido" });

      const { result } = renderHook(() => useAgentStream());
      await act(async () => {
        await result.current.connect(connectInput());
      });

      expect(result.current.status).toBe("error");
      expect(result.current.error).toBeTruthy();
    });

    it("handles non-JSON HTTP error response gracefully", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response("Internal Server Error", { status: 500 }),
      );

      const { result } = renderHook(() => useAgentStream());
      await act(async () => {
        await result.current.connect(connectInput());
      });

      expect(result.current.status).toBe("error");
    });
  });

  // ─── SSE event handling ─────────────────────────────────────────────────

  describe("SSE event handling", () => {
    it("delta events append to the last assistant message", async () => {
      const stream = makeSseStream([
        { event: "delta", data: { text: "Hola, " } },
        { event: "delta", data: { text: "estoy analizando." } },
        { event: "final", data: { answer: "Ok", warnings: [], latencyMs: 50 } },
      ]);
      mockFetchOk(stream);

      const { result } = renderHook(() => useAgentStream());
      await act(async () => {
        await result.current.connect(connectInput());
      });

      const assistantMessages = result.current.messages.filter((m) => m.role === "assistant");
      expect(assistantMessages).toHaveLength(1);
      expect(assistantMessages[0].content).toBe("Hola, estoy analizando.");
    });

    it("tool_start adds a new tool activity entry", async () => {
      const stream = makeSseStream([
        { event: "tool_start", data: { toolName: "searchPartidas" } },
        { event: "final", data: { answer: "Ok", warnings: [], latencyMs: 50 } },
      ]);
      mockFetchOk(stream);

      const { result } = renderHook(() => useAgentStream());
      await act(async () => {
        await result.current.connect(connectInput());
      });

      expect(result.current.execution.toolActivity).toHaveLength(1);
      expect(result.current.execution.toolActivity[0]).toEqual({
        toolName: "searchPartidas",
        success: false,
        latencyMs: undefined,
        summary: "En progreso...",
      });
    });

    it("tool_result updates the matching tool activity entry", async () => {
      const stream = makeSseStream([
        { event: "tool_start", data: { toolName: "searchPartidas" } },
        {
          event: "tool_result",
          data: { toolName: "searchPartidas", success: true, summary: "5 resultados", latencyMs: 120 },
        },
        { event: "final", data: { answer: "Ok", warnings: [], latencyMs: 50 } },
      ]);
      mockFetchOk(stream);

      const { result } = renderHook(() => useAgentStream());
      await act(async () => {
        await result.current.connect(connectInput());
      });

      expect(result.current.execution.toolActivity).toHaveLength(1);
      expect(result.current.execution.toolActivity[0]).toEqual({
        toolName: "searchPartidas",
        success: true,
        summary: "5 resultados",
        latencyMs: 120,
      });
    });

    it("tool_result updates only the matching 'En progreso...' entry", async () => {
      const stream = makeSseStream([
        { event: "tool_start", data: { toolName: "searchPartidas" } },
        { event: "tool_start", data: { toolName: "calculateBudget" } },
        {
          event: "tool_result",
          data: { toolName: "searchPartidas", success: true, summary: "3 encontradas", latencyMs: 80 },
        },
        { event: "final", data: { answer: "Ok", warnings: [], latencyMs: 50 } },
      ]);
      mockFetchOk(stream);

      const { result } = renderHook(() => useAgentStream());
      await act(async () => {
        await result.current.connect(connectInput());
      });

      expect(result.current.execution.toolActivity).toHaveLength(2);
      // searchPartidas debe estar actualizado
      expect(result.current.execution.toolActivity[0].summary).toBe("3 encontradas");
      // calculateBudget debe seguir en progreso
      expect(result.current.execution.toolActivity[1].summary).toBe("En progreso...");
    });

    it("approval_required sets state and pendingApproval", async () => {
      const stream = makeSseStream([
        {
          event: "approval_required",
          data: { toolName: "deleteChapter", reason: "Eliminar capítulo 3 del presupuesto" },
        },
      ]);
      mockFetchOk(stream);

      const { result } = renderHook(() => useAgentStream());
      await act(async () => {
        await result.current.connect(connectInput());
      });

      expect(result.current.execution.state).toBe("PENDING_APPROVAL");
      expect(result.current.execution.pendingApproval).toEqual({
        toolName: "deleteChapter",
        reason: "Eliminar capítulo 3 del presupuesto",
      });
      // Debe haber un system message sobre la aprobación
      const systemMsgs = result.current.messages.filter((m) => m.role === "system");
      expect(systemMsgs.some((m) => m.content.includes("deleteChapter"))).toBe(true);
    });

    it("final event sets status to done and updates execution", async () => {
      const stream = makeSseStream([
        {
          event: "final",
          data: {
            answer: "Presupuesto creado exitosamente.",
            warnings: ["Advertencia: datos parciales"],
            latencyMs: 2500,
          },
        },
      ]);
      mockFetchOk(stream);

      const { result } = renderHook(() => useAgentStream());
      await act(async () => {
        await result.current.connect(connectInput());
      });

      expect(result.current.status).toBe("done");
      expect(result.current.execution.state).toBe("EXECUTED");
      expect(result.current.execution.summary).toBe("Presupuesto creado exitosamente.");
      expect(result.current.execution.warnings).toEqual(["Advertencia: datos parciales"]);
      expect(result.current.execution.latencyMs).toBe(2500);
    });

    it("error event sets status to error and FAILED state", async () => {
      const stream = makeSseStream([
        { event: "error", data: { message: "OPENROUTER_API_KEY no configurado" } },
      ]);
      mockFetchOk(stream);

      const { result } = renderHook(() => useAgentStream());
      await act(async () => {
        await result.current.connect(connectInput());
      });

      expect(result.current.status).toBe("error");
      expect(result.current.error).toBe("OPENROUTER_API_KEY no configurado");
      expect(result.current.execution.state).toBe("FAILED");
    });

    it("handles multiple tools in sequence through full lifecycle", async () => {
      const stream = makeSseStream([
        { event: "tool_start", data: { toolName: "searchPartidas" } },
        {
          event: "tool_result",
          data: { toolName: "searchPartidas", success: true, summary: "3 resultados", latencyMs: 100 },
        },
        { event: "tool_start", data: { toolName: "calculateBudget" } },
        {
          event: "tool_result",
          data: { toolName: "calculateBudget", success: true, summary: "Total: S/ 45,000", latencyMs: 200 },
        },
        {
          event: "final",
          data: { answer: "Análisis completo.", warnings: [], latencyMs: 500 },
        },
      ]);
      mockFetchOk(stream);

      const { result } = renderHook(() => useAgentStream());
      await act(async () => {
        await result.current.connect(connectInput());
      });

      expect(result.current.execution.toolActivity).toHaveLength(2);
      expect(result.current.execution.toolActivity[0].toolName).toBe("searchPartidas");
      expect(result.current.execution.toolActivity[1].toolName).toBe("calculateBudget");
      expect(result.current.execution.state).toBe("EXECUTED");
    });
  });

  // ─── disconnect ──────────────────────────────────────────────────────────

  describe("disconnect", () => {
    it("resets status to idle", async () => {
      const stream = makeSseStream([
        { event: "delta", data: { text: "..." } },
        { event: "final", data: { answer: "Ok", warnings: [], latencyMs: 50 } },
      ]);
      mockFetchOk(stream);

      const { result } = renderHook(() => useAgentStream());
      await act(async () => {
        result.current.connect(connectInput());
      });

      await waitFor(() => {
        expect(result.current.status).toBe("done");
      });

      act(() => {
        result.current.disconnect();
      });

      expect(result.current.status).toBe("idle");
    });
  });

  // ─── Cleanup on unmount ──────────────────────────────────────────────────

  describe("cleanup", () => {
    it("aborts fetch on unmount after connecting", async () => {
      const abortSpy = vi.spyOn(AbortController.prototype, "abort");

      const { result, unmount } = renderHook(() => useAgentStream());

      // Connect first to create an AbortController
      act(() => {
        result.current.connect(connectInput());
      });

      unmount();

      expect(abortSpy).toHaveBeenCalled();
    });
  });
});
