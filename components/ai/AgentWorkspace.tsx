"use client";

import { useState, useCallback } from "react";
import {
  Bot,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Send,
  Loader2,
  ShieldCheck,
  Wrench,
  Activity,
  Lightbulb,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { KhipuSymbol } from "@/components/khipu/KhipuSymbol";
import { useAgentStream } from "@/hooks/use-agent-stream";
import type {
  AgentExecutionState,
  AgentToolRisk,
} from "@/lib/ai/agent/types";
import { allTools } from "@/lib/ai/agent/tools";

// ─── Types ──────────────────────────────────────────────────────────────────

type AgentWorkspaceProps = {
  projectId?: string;
  className?: string;
  initialObjective?: string;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function stateBadge(state: AgentExecutionState) {
  const map: Record<string, { label: string; className: string }> = {
    READ: { label: "Leyendo", className: "bg-slate-100 text-slate-700" },
    PLAN: { label: "Planificando", className: "bg-blue-100 text-blue-700" },
    PROPOSE: { label: "Propuesta", className: "bg-purple-100 text-purple-700" },
    SIMULATE: { label: "Simulando", className: "bg-indigo-100 text-indigo-700" },
    PENDING_APPROVAL: { label: "Esperando aprobación", className: "bg-amber-100 text-amber-700" },
    EXECUTING: { label: "Ejecutando", className: "bg-blue-100 text-blue-700" },
    EXECUTED: { label: "Completado", className: "bg-emerald-100 text-emerald-700" },
    FAILED: { label: "Falló", className: "bg-rose-100 text-rose-700" },
    ROLLED_BACK: { label: "Revertido", className: "bg-slate-100 text-slate-700" },
  };
  const entry = map[state] ?? { label: state, className: "bg-slate-100 text-slate-600" };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", entry.className)}>
      {entry.label}
    </span>
  );
}

function riskBadge(risk: AgentToolRisk | string) {
  const map: Record<string, string> = {
    read: "bg-emerald-50 text-emerald-700 border-emerald-200",
    write: "bg-amber-50 text-amber-700 border-amber-200",
    financial: "bg-rose-50 text-rose-700 border-rose-200",
    export: "bg-purple-50 text-purple-700 border-purple-200",
  };
  return (
    <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase", map[risk] ?? "bg-slate-50 text-slate-600")}>
      {risk}
    </span>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function AgentChatPanel({
  objective,
  setObjective,
  onObjectiveSubmit,
  messages,
  streaming,
  loading,
}: {
  objective: string;
  setObjective: (v: string) => void;
  onObjectiveSubmit: (objective: string) => void;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  streaming: boolean;
  loading: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--app-border)] px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--app-text-strong)]">Khipu Agente</p>
          <p className="text-[11px] text-[var(--app-text-muted)]">Asistente técnico de obra</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <KhipuSymbol className="mb-4 h-12 w-12 opacity-20" />
            <p className="text-sm font-semibold text-[var(--app-text-strong)]">¿Qué necesitas hacer?</p>
            <p className="mt-1 max-w-xs text-xs text-[var(--app-text-muted)]">
              Describe un objetivo: crear presupuesto, revisar APU, generar cronograma, exportar reporte...
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {[
                "Crear presupuesto para hospital",
                "Revisar APU de concreto armado",
                "Generar cronograma del proyecto",
                "Comparar presupuestos activos",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-blue-300 hover:text-blue-700"
                  onClick={() => onObjectiveSubmit(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-3",
                msg.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              {msg.role !== "user" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)]",
                  msg.role === "system" && "border-amber-200 bg-amber-50 text-amber-800 text-xs",
                )}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}
        {streaming && (
          <div className="flex items-center gap-2 text-xs text-[var(--app-text-muted)]">
            <Loader2 className="h-3 w-3 animate-spin" />
            Khipu está trabajando...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-[var(--app-border)] p-4">
        <div className="relative">
          <Textarea
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="Describe tu objetivo: 'Crea un presupuesto para un hospital de 4 pisos'..."
            className="min-h-0 pr-12"
            rows={3}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (objective.trim()) onObjectiveSubmit(objective.trim());
              }
            }}
          />
          <button
            type="button"
            aria-label="Enviar objetivo"
            disabled={loading || !objective.trim()}
            className={cn(
              "absolute bottom-3 right-2.5 flex h-9 w-9 items-center justify-center rounded-full transition-all",
              loading || !objective.trim()
                ? "cursor-not-allowed bg-slate-200 text-slate-400"
                : "bg-blue-600 text-white shadow-sm hover:bg-blue-700 hover:shadow-md",
            )}
            onClick={() => {
              if (objective.trim()) onObjectiveSubmit(objective.trim());
            }}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mt-2 text-[10px] text-[var(--app-text-muted)]">
          Enter para enviar · Shift+Enter para nueva línea
        </p>
      </div>
    </div>
  );
}

function ExecutionPlanPanel({
  streaming,
  streamExecution,
}: {
  streaming: boolean;
  streamExecution: ReturnType<typeof useAgentStream>["execution"];
}) {
  const isIdle = !streamExecution.state && !streaming;

  if (isIdle) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <Lightbulb className="mb-3 h-10 w-10 text-slate-300" />
        <p className="text-sm font-semibold text-[var(--app-text-strong)]">Sin plan de ejecución</p>
        <p className="mt-1 max-w-xs text-xs text-[var(--app-text-muted)]">
          Envía un objetivo en el panel de chat para que Khipu planifique los pasos necesarios.
        </p>
      </div>
    );
  }

  const toolCount = streamExecution.toolActivity.length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--app-border)] px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-[var(--app-text-strong)]">Plan de Ejecución</p>
          <p className="text-[11px] text-[var(--app-text-muted)]">
            {streamExecution.state
              ? stateBadge(streamExecution.state)
              : streaming
                ? "Ejecutando..."
                : "Sin estado"}
          </p>
        </div>
        {streaming && (
          <div className="flex items-center gap-1.5 text-[11px] text-blue-600">
            <Loader2 className="h-3 w-3 animate-spin" />
            En vivo
          </div>
        )}
      </div>

      {/* Streaming live view */}
      <div className="flex-1 overflow-y-auto p-4">
        {streaming && (
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/40 p-3">
            <div className="flex items-center gap-2 text-xs text-blue-700">
              <Zap className="h-3.5 w-3.5" />
              <span className="font-semibold">Ejecución en tiempo real</span>
            </div>
            <p className="mt-1 text-[11px] text-blue-600">
              Khipu está procesando tu solicitud. Las herramientas ejecutadas aparecerán en el panel de actividad.
            </p>
          </div>
        )}

        {toolCount > 0 && (
          <div className="space-y-0">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Herramientas ejecutadas ({toolCount})
            </p>
            {streamExecution.toolActivity.map((activity, i) => (
              <div key={i} className="flex gap-3 pb-3">
                <div className="flex flex-col items-center">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full border-2 bg-white"
                    style={{
                      borderColor: activity.success
                        ? "#10b981"
                        : activity.latencyMs === undefined
                          ? "#3b82f6"
                          : "#ef4444",
                    }}
                  >
                    {activity.latencyMs === undefined ? (
                      <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                    ) : activity.success ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <XCircle className="h-3 w-3 text-rose-500" />
                    )}
                  </div>
                  {i < toolCount - 1 && (
                    <div
                      aria-hidden="true"
                      className={cn(
                        "my-0.5 w-0.5 flex-1",
                        activity.success ? "bg-emerald-200" : "bg-slate-200",
                      )}
                    />
                  )}
                </div>
                <div
                  className={cn(
                    "flex-1 rounded-lg border px-2.5 py-2",
                    activity.success
                      ? "border-emerald-200 bg-emerald-50/30"
                      : activity.latencyMs === undefined
                        ? "border-blue-200 bg-blue-50/30"
                        : "border-rose-200 bg-rose-50/30",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] font-semibold text-slate-400">{i + 1}</span>
                      <span className="ml-1.5 text-xs font-semibold text-slate-700">
                        {activity.toolName}
                      </span>
                    </div>
                    {activity.latencyMs !== undefined && (
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {activity.latencyMs}ms
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">{activity.summary}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {!streaming && toolCount === 0 && streamExecution.state && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="mb-2 h-8 w-8 text-slate-300" />
            <p className="text-xs text-slate-400">
              {streamExecution.state === "FAILED"
                ? "La ejecución falló."
                : streamExecution.state === "EXECUTED"
                  ? "Ejecución completada."
                  : `Estado: ${streamExecution.state}`}
            </p>
          </div>
        )}
      </div>

      {/* Summary footer */}
      {streamExecution.summary && (
        <div className="border-t border-[var(--app-border)] px-5 py-3">
          <p className="text-xs text-[var(--app-text-muted)]">{streamExecution.summary}</p>
        </div>
      )}
    </div>
  );
}

function AgentRightPanel({
  streamExecution,
  streaming,
  allTools,
  onApprove,
  onReject,
  approving,
}: {
  streamExecution: ReturnType<typeof useAgentStream>["execution"];
  streaming: boolean;
  allTools: Array<{ name: string; description: string; risk: AgentToolRisk }>;
  onApprove: (toolName: string) => void;
  onReject: (toolName: string) => void;
  approving: boolean;
}) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      {/* Available Tools */}
      <Card className="border-[var(--app-border)] bg-[var(--app-surface)] shadow-sm">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Wrench className="h-4 w-4 text-[var(--app-text-muted)]" />
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--app-text-muted)]">
              Herramientas ({allTools.length})
            </p>
          </div>
          <div className="max-h-48 space-y-1.5 overflow-y-auto">
            {allTools.map((tool) => (
              <div
                key={tool.name}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-2.5 py-1.5"
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-700">{tool.name}</p>
                  <p className="truncate text-[10px] text-slate-400">{tool.description}</p>
                </div>
                {riskBadge(tool.risk)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pending Approvals */}
      {streamExecution.pendingApproval ? (
        <Card className="border-amber-200 bg-amber-50/50 shadow-sm">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-600" />
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">
                Aprobación pendiente
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-white p-3 space-y-2">
              <p className="text-sm font-semibold text-slate-800">
                {streamExecution.pendingApproval.reason}
              </p>
              <div className="rounded-lg border border-amber-100 bg-amber-50/70 px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-600 mb-0.5">
                  Herramienta
                </p>
                <p className="text-xs text-amber-800 font-mono">
                  {streamExecution.pendingApproval.toolName}
                </p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                className="flex-1 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={approving}
                onClick={() => onApprove(streamExecution.pendingApproval!.toolName)}
              >
                {approving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Aprobar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50"
                disabled={approving}
                onClick={() => onReject(streamExecution.pendingApproval!.toolName)}
              >
                <XCircle className="h-3.5 w-3.5" />
                Rechazar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-[var(--app-border)] bg-[var(--app-surface)] shadow-sm">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[var(--app-text-muted)]" />
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--app-text-muted)]">
                Aprobaciones
              </p>
            </div>
            <p className="text-xs text-slate-400">Sin aprobaciones pendientes.</p>
          </CardContent>
        </Card>
      )}

      {/* Activity Timeline */}
      <Card className="border-[var(--app-border)] bg-[var(--app-surface)] shadow-sm">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[var(--app-text-muted)]" />
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--app-text-muted)]">
              Actividad
            </p>
          </div>
          {streamExecution.toolActivity.length > 0 ? (
            <div className="space-y-2">
              {streamExecution.toolActivity.map((activity, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2.5 py-2 transition",
                    activity.latencyMs === undefined
                      ? "border-blue-200 bg-blue-50/30"
                      : "border-slate-100",
                  )}
                >
                  {activity.latencyMs === undefined ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-500" />
                  ) : activity.success ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-slate-700">{activity.toolName}</p>
                    <p className="truncate text-[10px] text-slate-400">{activity.summary}</p>
                  </div>
                  {activity.latencyMs && (
                    <span className="shrink-0 text-[10px] text-slate-400">{activity.latencyMs}ms</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Sin actividad registrada.</p>
          )}
        </CardContent>
      </Card>

      {/* Warnings */}
      {streamExecution.warnings.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 shadow-sm">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">
                Advertencias
              </p>
            </div>
            <ul className="space-y-1">
              {streamExecution.warnings.map((w, i) => (
                <li key={i} className="text-[11px] text-amber-700">· {w}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

function getAvailableTools() {
  return allTools.map((t) => ({
    name: t.name,
    description: t.description,
    risk: t.risk,
  }));
}

export function AgentWorkspace({
  projectId,
  className,
  initialObjective = "",
}: AgentWorkspaceProps) {
  const [objective, setObjective] = useState(initialObjective);
  const [approving, setApproving] = useState(false);

  const {
    status,
    messages,
    execution: streamExec,
    connect,
    disconnect,
  } = useAgentStream();

  const loading = status === "connecting";
  const streaming = status === "streaming";

  const handleObjectiveSubmit = useCallback((obj: string) => {
    if (!obj.trim() || loading || streaming) return;
    setObjective("");
    connect({ message: obj.trim(), projectId, mode: "goal" });
  }, [projectId, loading, streaming, connect]);

  const handleApprove = useCallback(async (approvalId: string) => {
    setApproving(true);
    try {
      const response = await fetch("/api/ai/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalId, decision: "approve" }),
      });

      if (!response.ok) throw new Error("Error al aprobar");
      await response.json();
    } catch {
      console.error("[AgentWorkspace] Error processing approval");
    } finally {
      setApproving(false);
    }
  }, []);

  const handleReject = useCallback(async (approvalId: string) => {
    setApproving(true);
    try {
      const response = await fetch("/api/ai/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalId, decision: "reject", reason: "Rechazado por el usuario." }),
      });

      if (!response.ok) throw new Error("Error al rechazar");
      await response.json();
      disconnect();
    } catch {
      console.error("[AgentWorkspace] Error processing rejection");
    } finally {
      setApproving(false);
    }
  }, [disconnect]);

  return (
    <div className={cn(
      "grid h-[calc(100vh-4rem)] gap-0 overflow-hidden border border-[var(--app-border)] rounded-2xl bg-[var(--app-surface)] shadow-sm md:grid-cols-[320px_1fr_300px]",
      className,
    )}>
      {/* Left: Chat + Objective */}
      <div className="border-r border-[var(--app-border)]">
        <AgentChatPanel
          objective={objective}
          setObjective={setObjective}
          onObjectiveSubmit={handleObjectiveSubmit}
          messages={messages}
          streaming={streaming}
          loading={loading}
        />
      </div>

      {/* Center: Execution Plan */}
      <div className="border-r border-[var(--app-border)]">
        <ExecutionPlanPanel streaming={streaming} streamExecution={streamExec} />
      </div>

      {/* Right: Tools + Approvals + Activity */}
      <AgentRightPanel
        streamExecution={streamExec}
        streaming={streaming}
        allTools={getAvailableTools()}
        onApprove={handleApprove}
        onReject={handleReject}
        approving={approving}
      />
    </div>
  );
}
