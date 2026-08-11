"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentExecutionState, AgentToolActivitySummary } from "@/lib/ai/agent/types";
import type { AgentIntent, AgentPendingAction } from "@/lib/ai/agent/intent-router";

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
  intent: AgentIntent | null;
  pendingAction: AgentPendingAction | null;
};

export type AgentStreamInput = {
  message: string;
  messages?: AgentStreamMessage[];
  projectId?: string;
  workspaceId?: string;
  mode?: "chat" | "goal" | "workflow";
  workflowId?: string;
  skipMessageAdd?: boolean;
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

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function useAgentStream() {
  const [status, setStatus] = useState<AgentStreamStatus>("idle");
  const [messages, setMessages] = useState<AgentStreamMessage[]>([]);
  const [execution, setExecution] = useState<AgentStreamExecution>(EMPTY_EXECUTION);
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState<AgentIntent | null>(null);
  const [pendingAction, setPendingAction] = useState<AgentPendingAction | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const handleEvent = useCallback((type: string, data: Record<string, unknown>) => {
    switch (type) {
      case "delta": {
        const text = readString(data.text);
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant") {
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
              toolName: readString(data.toolName, "tool"),
              success: false,
              latencyMs: undefined,
              summary: "En progreso...",
            },
          ],
        }));
        break;
      }

      case "tool_result": {
        const toolName = readString(data.toolName);
        const success = data.success === true;
        const summary = readString(data.summary);
        const latencyMs = typeof data.latencyMs === "number" ? data.latencyMs : undefined;
        setExecution((prev) => ({
          ...prev,
          toolActivity: prev.toolActivity.map((activity) =>
            activity.toolName === toolName && activity.summary === "En progreso..."
              ? { ...activity, success, summary, latencyMs }
              : activity,
          ),
        }));
        break;
      }

      case "approval_required": {
        const toolName = readString(data.toolName, "tool");
        const reason = readString(data.reason);
        setExecution((prev) => ({
          ...prev,
          state: "PENDING_APPROVAL",
          pendingApproval: {
            approvalId: readString(data.approvalId),
            toolName,
            reason,
          },
        }));
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content: `Se requiere tu aprobacion para ejecutar "${toolName}": ${reason}`,
          },
        ]);
        break;
      }

      case "final": {
        setStatus("done");
        setExecution((prev) => ({
          ...prev,
          state: "EXECUTED",
          summary: typeof data.answer === "string" ? data.answer : null,
          warnings: readStringArray(data.warnings),
          latencyMs: typeof data.latencyMs === "number" ? data.latencyMs : null,
        }));
        break;
      }

      case "intent": {
        setIntent(data as unknown as AgentIntent);
        break;
      }

      case "pending_action": {
        setPendingAction(data ? (data as unknown as AgentPendingAction) : null);
        break;
      }

      case "error": {
        const message = readString(data.message, "Error de conexion.");
        setStatus("error");
        setError(message);
        setExecution((prev) => ({
          ...prev,
          state: "FAILED",
          warnings: [...prev.warnings, message],
        }));
        break;
      }
    }
  }, []);

  const connect = useCallback(async (input: AgentStreamInput) => {
    setStatus("connecting");
    setError(null);
    setIntent(null);
    setPendingAction(null);

    if (!input.skipMessageAdd) {
      setMessages((prev) => [...prev, { role: "user", content: input.message }]);
    } else if (input.displayMessage) {
      setMessages((prev) => [...prev, { role: "user", content: input.displayMessage ?? "" }]);
    }

    setExecution((prev) => ({
      ...EMPTY_EXECUTION,
      toolActivity: prev.toolActivity,
    }));

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const requestMessages = input.messages ?? [{ role: "user" as const, content: input.message }];
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
        const body: unknown = await response.json().catch(() => ({ error: "Error de conexion" }));
        const message =
          typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
            ? body.error
            : `HTTP ${response.status}`;
        throw new Error(message);
      }

      if (!response.body) {
        throw new Error("El servidor no devolvio un stream.");
      }

      setStatus("streaming");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          if (!frame.trim() || frame.startsWith(":")) continue;

          const eventMatch = frame.match(/^event:\s*(.+)$/m);
          const dataMatch = frame.match(/^data:\s*(.+)$/m);
          if (!eventMatch || !dataMatch) continue;

          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(dataMatch[1]) as Record<string, unknown>;
          } catch {
            continue;
          }

          handleEvent(eventMatch[1].trim(), parsed);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Error de conexion.";
      setError(message);
      setStatus("error");
      setMessages((prev) => [...prev, { role: "system", content: message }]);
    }
  }, [handleEvent]);

  const disconnect = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  return {
    status,
    messages,
    execution,
    error,
    intent,
    pendingAction,
    connect,
    disconnect,
  } as const;
}
