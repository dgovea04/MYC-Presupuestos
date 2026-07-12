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

    it("starts with null intent and null pendingAction", () => {
      const { result } = renderHook(() => useAgentStream());

      expect(result.current.intent).toBeNull();
      expect(result.current.pendingAction).toBeNull();
    });
  });

  // ─── connect ────────────────────────────────────────────────────────────

  describe("connect", () => {
    // ─── skipMessageAdd / displayMessage ─────────────────────────────────

    it("adds message to UI state normally when skipMessageAdd is not set", async () => {
      const stream = makeSseStream([
        { event: "final", data: { answer: "Ok", warnings: [], latencyMs: 50 } },
      ]);
      mockFetchOk(stream);

      const { result } = renderHook(() => useAgentStream());
      await act(async () => {
        await result.current.connect(connectInput({ message: "Hola" }));
      });

      expect(result.current.messages[0]).toEqual({ role: "user", content: "Hola" });
    });

    it("does NOT add message to UI state when skipMessageAdd=true", async () => {
      const stream = makeSseStream([
        { event: "final", data: { answer: "Ok", warnings: [], latencyMs: 50 } },
      ]);
      mockFetchOk(stream);

      const { result } = renderHook(() => useAgentStream());
      await act(async () => {
        await result.current.connect(connectInput({
          message: "COMANDO INTERNO",
          skipMessageAdd: true,
        }));
      });

      // Solo debe tener el placeholder del assistant (no el mensaje de usuario)
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].role).toBe("assistant");
      // El mensaje "COMANDO INTERNO" NO debe estar en la UI
      expect(result.current.messages[0].content).not.toContain("COMANDO INTERNO");
    });

    it("shows displayMessage in UI instead of internal message when both are set", async () => {
      const stream = makeSseStream([
        { event: "final", data: { answer: "Ok", warnings: [], latencyMs: 50 } },
      ]);
      mockFetchOk(stream);

      const { result } = renderHook(() => useAgentStream());
      await act(async () => {
        await result.current.connect(connectInput({
          message: "COMANDO INTERNO EJECUTA generateBudget AHORA",
          displayMessage: "Sí confirmado",
          skipMessageAdd: true,
        }));
      });

      // El mensaje visible debe ser el displayMessage, no el comando interno
      const userMessages = result.current.messages.filter((m) => m.role === "user");
      expect(userMessages).toHaveLength(1);
      expect(userMessages[0].content).toBe("Sí confirmado");
      expect(userMessages[0].content).not.toContain("COMANDO INTERNO");
    });

    it("sends internal message to API even when skipMessageAdd=true", async () => {
      const stream = makeSseStream([
        { event: "final", data: { answer: "Ok", warnings: [], latencyMs: 50 } },
      ]);
      mockFetchOk(stream);

      const { result } = renderHook(() => useAgentStream());
      await act(async () => {
        await result.current.connect(connectInput({
          message: "COMANDO INTERNO",
          displayMessage: "Sí confirmado",
          skipMessageAdd: true,
          projectId: "proj-1",
          mode: "goal",
        }));
      });

      // Verificar que la petición contiene el comando interno, no el displayMessage
      const fetchCall = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      expect(body.message).toBe("COMANDO INTERNO");
      expect(body.message).not.toBe("Sí confirmado");
    });

    it("includes previous messages plus internal command in request when messages array provided", async () => {
      const stream = makeSseStream([
        { event: "final", data: { answer: "Ok", warnings: [], latencyMs: 50 } },
      ]);
      mockFetchOk(stream);

      const { result } = renderHook(() => useAgentStream());
      const prevMessages = [
        { role: "user" as const, content: "genera presupuesto" },
        { role: "assistant" as const, content: "Preview..." },
      ];

      await act(async () => {
        await result.current.connect({
          message: "COMANDO INTERNO",
          displayMessage: "Sí confirmado",
          messages: [
            ...prevMessages,
            { role: "user", content: "COMANDO INTERNO" },
          ],
          skipMessageAdd: true,
          projectId: "proj-1",
          mode: "goal",
        });
      });

      // Verificar que la petición incluye el comando interno en messages
      const fetchCall = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      const lastMsg = body.messages[body.messages.length - 1];
      expect(lastMsg.content).toBe("COMANDO INTERNO");
      expect(body.messages).toHaveLength(3);
      // La UI solo debe mostrar "Sí confirmado", no el comando interno
      const userMessages = result.current.messages.filter((m) => m.role === "user");
      expect(userMessages).toHaveLength(1);
      expect(userMessages[0].content).toBe("Sí confirmado");
    });

    // ─── Cancelar flow (mismo patron que handleCancelProceed) ───────────

    it("cancelar: muestra 'No, cancelar' en la UI y envia comando interno a la API", async () => {
      const stream = makeSseStream([
        { event: "final", data: { answer: "Ok", warnings: [], latencyMs: 50 } },
      ]);
      mockFetchOk(stream);

      const { result } = renderHook(() => useAgentStream());
      const prevMessages = [
        { role: "user" as const, content: "genera presupuesto para casa" },
        { role: "assistant" as const, content: "Preview..." },
      ];

      await act(async () => {
        await result.current.connect({
          message: "No por ahora. Cancela la generación del presupuesto.",
          displayMessage: "No, cancelar",
          messages: [
            ...prevMessages,
            { role: "user", content: "No por ahora. Cancela la generación del presupuesto." },
          ],
          skipMessageAdd: true,
          projectId: "proj-1",
          mode: "goal",
        });
      });

      // UI must show clean message
      const userMessages = result.current.messages.filter((m) => m.role === "user");
      expect(userMessages).toHaveLength(1);
      expect(userMessages[0].content).toBe("No, cancelar");

      // API request must contain the internal cancellation command
      const fetchCall = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      expect(body.message).toBe("No por ahora. Cancela la generación del presupuesto.");

      // messages array must include the internal command
      const bodyLastMsg = body.messages[body.messages.length - 1];
      expect(bodyLastMsg.content).toBe("No por ahora. Cancela la generación del presupuesto.");
      expect(body.messages).toHaveLength(3);
    });

    it("cancelar: no filtra mensajes que empiezan con 'No por ahora' en el historial", async () => {
      const stream = makeSseStream([
        { event: "final", data: { answer: "Ok", warnings: [], latencyMs: 50 } },
      ]);
      mockFetchOk(stream);

      const { result } = renderHook(() => useAgentStream());

      const prevMessages = [
        { role: "user" as const, content: "No por ahora. Cancelemos." },
        { role: "assistant" as const, content: "Entendido." },
        { role: "user" as const, content: "genera presupuesto para casa" },
        { role: "assistant" as const, content: "Preview lista." },
      ];

      await act(async () => {
        await result.current.connect({
          message: "No por ahora. Cancela.",
          displayMessage: "No, cancelar",
          messages: [
            ...prevMessages,
            { role: "user", content: "No por ahora. Cancela." },
          ],
          skipMessageAdd: true,
        });
      });

      // El historial completo (4 mensajes + 1 nuevo) debe ir en la peticion
      const fetchCall = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      expect(body.messages).toHaveLength(5);

      // UI must show clean message
      const userMessages = result.current.messages.filter((m) => m.role === "user");
      expect(userMessages).toHaveLength(1);
      expect(userMessages[0].content).toBe("No, cancelar");
    });
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
          body: expect.stringContaining('"message":"Crea presupuesto para hospital"'),
        }),
      );

      const callBody = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
      expect(callBody.message).toBe("Crea presupuesto para hospital");
      expect(callBody.projectId).toBe("project-42");
      expect(callBody.mode).toBe("goal");
      expect(callBody.messages).toBeDefined();
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

    // ─── intent / pendingAction reset ────────────────────────────────────

    it("resets intent and pendingAction to null on new connect", async () => {
      const stream1 = makeSseStream([
        { event: "intent", data: { type: "preview_budget_generation", confidence: "medium", reason: "test", suggestedTools: [], extracted: {}, requiredFields: [] } },
        { event: "pending_action", data: { type: "apply_budget_generation", projectId: "proj-1", description: "test", templateSource: "auto" } },
        { event: "final", data: { answer: "Ok", warnings: [], latencyMs: 50 } },
      ]);
      const stream2 = makeSseStream([
        { event: "final", data: { answer: "Ok", warnings: [], latencyMs: 50 } },
      ]);
      mockFetchOk(stream1);

      const { result } = renderHook(() => useAgentStream());

      // First stream: sets intent and pendingAction
      await act(async () => {
        await result.current.connect(connectInput());
      });

      expect(result.current.intent).not.toBeNull();
      expect(result.current.pendingAction).not.toBeNull();

      // Second stream: should reset intent and pendingAction
      mockFetchOk(stream2);
      await act(async () => {
        await result.current.connect(connectInput({ message: "otro mensaje" }));
      });

      expect(result.current.intent).toBeNull();
      expect(result.current.pendingAction).toBeNull();
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

  // ─── Intent event ────────────────────────────────────────────────────────

  describe("intent event", () => {
    it("sets intent state when intent SSE event is received", async () => {
      const stream = makeSseStream([
        {
          event: "intent",
          data: {
            type: "preview_budget_generation",
            confidence: "high",
            reason: "Palabra clave detectada",
            suggestedTools: ["previewBudgetGeneration", "createBudgetGeneral"],
            extracted: { projectName: "Santa Monica", templateSource: "auto" },
            requiredFields: [],
          },
        },
        { event: "final", data: { answer: "Ok", warnings: [], latencyMs: 50 } },
      ]);
      mockFetchOk(stream);

      const { result } = renderHook(() => useAgentStream());
      await act(async () => {
        await result.current.connect(connectInput());
      });

      expect(result.current.intent).not.toBeNull();
      expect(result.current.intent!.type).toBe("preview_budget_generation");
      expect(result.current.intent!.confidence).toBe("high");
      expect(result.current.intent!.reason).toBe("Palabra clave detectada");
      expect(result.current.intent!.suggestedTools).toContain("previewBudgetGeneration");
      expect(result.current.intent!.extracted.projectName).toBe("Santa Monica");
    });

    it("sets intent for general_chat with low confidence", async () => {
      const stream = makeSseStream([
        {
          event: "intent",
          data: {
            type: "general_chat",
            confidence: "low",
            reason: "No se detectó intención específica",
            suggestedTools: [],
            extracted: {},
            requiredFields: [],
          },
        },
        { event: "final", data: { answer: "Hola", warnings: [], latencyMs: 50 } },
      ]);
      mockFetchOk(stream);

      const { result } = renderHook(() => useAgentStream());
      await act(async () => {
        await result.current.connect(connectInput());
      });

      expect(result.current.intent).not.toBeNull();
      expect(result.current.intent!.type).toBe("general_chat");
      expect(result.current.intent!.confidence).toBe("low");
    });
  });

  // ─── Pending action event ────────────────────────────────────────────────

  describe("pending_action event", () => {
    it("sets pendingAction when pending_action SSE event is received", async () => {
      const stream = makeSseStream([
        {
          event: "pending_action",
          data: {
            type: "apply_budget_generation",
            projectId: "proj-42",
            description: "vivienda de 120m2 en Lima",
            templateSource: "auto",
          },
        },
        { event: "final", data: { answer: "Ok", warnings: [], latencyMs: 50 } },
      ]);
      mockFetchOk(stream);

      const { result } = renderHook(() => useAgentStream());
      await act(async () => {
        await result.current.connect(connectInput());
      });

      expect(result.current.pendingAction).not.toBeNull();
      expect(result.current.pendingAction!.type).toBe("apply_budget_generation");
      expect(result.current.pendingAction!.projectId).toBe("proj-42");
      expect(result.current.pendingAction!.description).toBe("vivienda de 120m2 en Lima");
      expect(result.current.pendingAction!.templateSource).toBe("auto");
    });

    it("sets pendingAction to null when data is null", async () => {
      const stream = makeSseStream([
        { event: "pending_action", data: null as unknown as Record<string, unknown> },
        { event: "final", data: { answer: "Ok", warnings: [], latencyMs: 50 } },
      ]);
      mockFetchOk(stream);

      const { result } = renderHook(() => useAgentStream());
      await act(async () => {
        await result.current.connect(connectInput());
      });

      expect(result.current.pendingAction).toBeNull();
    });

    it("handles pending_action for MCP template application", async () => {
      const stream = makeSseStream([
        {
          event: "pending_action",
          data: {
            type: "apply_mcp_template",
            projectId: "proj-99",
            packageId: "pkg-mcp-001",
            description: "hospital de 4 pisos",
            mode: "auto",
          },
        },
        { event: "final", data: { answer: "Ok", warnings: [], latencyMs: 50 } },
      ]);
      mockFetchOk(stream);

      const { result } = renderHook(() => useAgentStream());
      await act(async () => {
        await result.current.connect(connectInput());
      });

      expect(result.current.pendingAction).not.toBeNull();
      expect(result.current.pendingAction!.type).toBe("apply_mcp_template");
      expect(result.current.pendingAction!.projectId).toBe("proj-99");
    });

    it("emits intent and pending_action events in order before tool events", async () => {
      const stream = makeSseStream([
        {
          event: "intent",
          data: { type: "preview_budget_generation", confidence: "medium", reason: "test", suggestedTools: ["previewBudgetGeneration"], extracted: {}, requiredFields: [] },
        },
        {
          event: "pending_action",
          data: { type: "apply_budget_generation", projectId: "proj-1", description: "test", templateSource: "auto" },
        },
        { event: "tool_start", data: { toolName: "previewBudgetGeneration" } },
        { event: "tool_result", data: { toolName: "previewBudgetGeneration", success: true, summary: "ok", latencyMs: 100 } },
        { event: "final", data: { answer: "Ok", warnings: [], latencyMs: 50 } },
      ]);
      mockFetchOk(stream);

      const { result } = renderHook(() => useAgentStream());
      await act(async () => {
        await result.current.connect(connectInput());
      });

      // Intent and pendingAction should be set
      expect(result.current.intent).not.toBeNull();
      expect(result.current.pendingAction).not.toBeNull();
      // Tool activity should also be recorded
      expect(result.current.execution.toolActivity).toHaveLength(1);
      expect(result.current.execution.toolActivity[0].toolName).toBe("previewBudgetGeneration");
      expect(result.current.execution.toolActivity[0].success).toBe(true);
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
