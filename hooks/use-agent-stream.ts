"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type {
  AgentExecutionState,
  AgentToolActivitySummary,
} from "@/lib/ai/agent/types";

// ─── Public types ────────────────────────────────────────────────────────────

export type AgentStreamStatus = "idle" | "connecting" | "streaming" | "done" | "error";

export type AgentStreamMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type AgentStreamExecution = {
  executionId: string | null;
  state: AgentExecutionState | null;
  summary: string | null;
  pendingApproval: {
    approvalId: string;
    toolName: string;
    reason: string;
  } | null;
  toolActivity: AgentToolActivitySummary[];
  warnings: string[];
  latencyMs: number | null;
};

export type AgentStreamState = {
  status: AgentStreamStatus;
  messages: AgentStreamMessage[];
  execution: AgentStreamExecution;
  error: string | null;
};

export type AgentStreamInput = {
  message: string;
  /** Historial completo de la conversación para mantener contexto entre turnos */
  messages?: AgentStreamMessage[];
  projectId?: string;
  /** ID del workspace/empresa activa para pasar al agente como contexto */
  workspaceId?: string;
  mode?: "chat" | "goal" | "workflow";
  /** Slug del workflow/bundle especialista a usar, ej: "crear-presupuesto-base" */
  workflowId?: string;
  /** Si es true, no agrega el mensaje al estado de UI (útil para enviar comandos internos) */
  skipMessageAdd?: boolean;
  /** Mensaje limpio para mostrar en la UI cuando skipMessageAdd=true */
  displayMessage?: string;
};

const EMPTY_EXECUTION: AgentStreamExecution = {
  executionId: null,
  state: null,
  summary: null,
  pendingApproval: null,
  toolActivity: [],
  warnings: [],
  latencyMs: null,
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAgentStream() {
  const [status, setStatus] = useState<AgentStreamStatus>("idle");
  const [messages, setMessages] = useState<AgentStreamMessage[]>([]);
  const [execution, setExecution] = useState<AgentStreamExecution>(EMPTY_EXECUTION);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const connect = useCallback(async (input: AgentStreamInput) => {
    // Reset state
    setStatus("connecting");
    setError(null);

    // Si skipMessageAdd está activo, NO mostrar el mensaje en la UI
    // (útil para comandos internos como la confirmación de presupuesto)
    if (!input.skipMessageAdd) {
      const userMessage: AgentStreamMessage = { role: "user", content: input.message };
      setMessages((prev) => [...prev, userMessage]);
    } else if (input.displayMessage) {
      // Mostrar un mensaje limpio en la UI mientras el comando real va internamente
      setMessages((prev) => [...prev, { role: "user", content: input.displayMessage }]);
    }

    setExecution((prev) => ({
      ...EMPTY_EXECUTION,
      toolActivity: prev.toolActivity, // preserve previous activity if reconnecting
    }));

    // Create assistant message placeholder for deltas to append to
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Incluir historial completo de mensajes para mantener contexto entre turnos
      // Si no se provee messages, se envía solo el mensaje actual (compatibilidad)
      const requestMessages = input.messages ?? [
        { role: "user" as const, content: input.message },
      ];

      const response = await fetch("/api/ai/agent/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input.message,
          messages: requestMessages,
          projectId: input.projectId,
          workspaceId: input.workspaceId,
          mode: input.mode ?? "goal",
          workflowId: input.workflowId,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Error de conexión" }));
        throw new Error(typeof err.error === "string" ? err.error : `HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error("El servidor no devolvió un stream.");
      }

      setStatus("streaming");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE frames from buffer
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? ""; // keep incomplete frame in buffer

        for (const frame of frames) {
          if (!frame.trim() || frame.startsWith(":")) continue;

          const eventMatch = frame.match(/^event:\s*(.+)$/m);
          const dataMatch = frame.match(/^data:\s*(.+)$/m);

          if (!eventMatch || !dataMatch) continue;

          const eventType = eventMatch[1].trim();
          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(dataMatch[1]);
          } catch {
            continue; // skip malformed JSON
          }

          handleEvent(eventType, parsed);
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "Error de conexión.";
      setError(msg);
      setStatus("error");
      // Append error as system message
      setMessages((prev) => [
        ...prev,
        { role: "system", content: `❌ ${msg}` },
      ]);
    }
  }, []);

  const disconnect = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
  }, []);

  // Cleanup on unmount: abort any active stream to prevent zombie connections
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  // ── Event handler ──────────────────────────────────────────────────────────

  function handleEvent(type: string, data: Record<string, unknown>) {
    switch (type) {
      case "delta": {
        const text = data.text as string;
        // Append delta to last assistant message
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === "assistant") {
            updated[updated.length - 1] = { ...last, content: last.content + text };
          }
          return updated;
        });
        break;
      }

      case "tool_start": {
        setExecution((prev) => ({
          ...prev,
          toolActivity: [
            ...prev.toolActivity,
            {
              toolName: data.toolName as string,
              success: false,
              latencyMs: undefined,
              summary: "En progreso...",
            },
          ],
        }));
        break;
      }

      case "tool_result": {
        const toolName = data.toolName as string;
        const success = data.success as boolean;
        const summary = data.summary as string;
        const latencyMs = data.latencyMs as number;

        setExecution((prev) => ({
          ...prev,
          toolActivity: prev.toolActivity.map((a) =>
            a.toolName === toolName && a.summary === "En progreso..."
              ? { ...a, success, summary, latencyMs }
              : a,
          ),
        }));
        break;
      }

      case "approval_required": {
        setExecution((prev) => ({
          ...prev,
          state: "PENDING_APPROVAL",
          pendingApproval: {
            approvalId: data.approvalId as string,
            toolName: data.toolName as string,
            reason: data.reason as string,
          },
        }));
        // Append system message about approval
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content: `⏸️ Se requiere tu aprobación para ejecutar "${data.toolName}": ${data.reason}`,
          },
        ]);
        break;
      }

      case "final": {
        setStatus("done");
        setExecution((prev) => ({
          ...prev,
          state: "EXECUTED",
          summary: (data.answer as string) ?? null,
          warnings: (data.warnings as string[]) ?? [],
          latencyMs: (data.latencyMs as number) ?? null,
        }));
        break;
      }

      case "error": {
        setStatus("error");
        setError(data.message as string);
        setExecution((prev) => ({
          ...prev,
          state: "FAILED",
          warnings: [...prev.warnings, data.message as string],
        }));
        break;
      }
    }
  }

  return {
    status,
    messages,
    execution,
    error,
    connect,
    disconnect,
  } as const;
}
