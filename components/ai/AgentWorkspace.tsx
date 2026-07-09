"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Bot,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Send,
  Loader2,
  ChevronRight,
  ShieldCheck,
  Wrench,
  Activity,
  Lightbulb,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { KhipuSymbol } from "@/components/khipu/KhipuSymbol";
import type {
  AgentExecutionState,
  AgentToolRisk,
  AgentOrchestratorOutput,
} from "@/lib/ai/agent/types";
import { allTools } from "@/lib/ai/agent/tools";

// ─── Types ──────────────────────────────────────────────────────────────────

type AgentWorkspaceProps = {
  projectId?: string;
  className?: string;
  initialObjective?: string;
};

type AgentExecutionView = AgentOrchestratorOutput & {
  goal: string;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function stepStatusIcon(status: string) {
  switch (status) {
    case "completed": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "running": return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    case "awaiting_approval": return <ShieldCheck className="h-4 w-4 text-amber-500" />;
    case "failed": return <XCircle className="h-4 w-4 text-rose-500" />;
    case "pending": return <Circle className="h-4 w-4 text-slate-300" />;
    case "skipped": return <ChevronRight className="h-4 w-4 text-slate-400" />;
    default: return <Clock className="h-4 w-4 text-slate-400" />;
  }
}

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
  execution,
}: {
  execution: AgentExecutionView | null;
}) {
  if (!execution) {
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

  const steps = execution.plan;
  const completedIds = useMemo(
    () => new Set(execution.completedSteps.map((s) => s.id)),
    [execution.completedSteps],
  );
  const failedIds = useMemo(
    () => new Set(execution.failedSteps.map((s) => s.id)),
    [execution.failedSteps],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--app-border)] px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-[var(--app-text-strong)]">Plan de Ejecución</p>
          <p className="text-[11px] text-[var(--app-text-muted)]">
            {steps.length} paso{steps.length !== 1 ? "s" : ""}
            {" · "}
            {stateBadge(execution.state)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-[var(--app-text-muted)]">
            {execution.completedSteps.length}/{steps.length} completados
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="relative space-y-0">
          {steps.map((step, index) => {
            const isCompleted = completedIds.has(step.id);
            const isFailed = failedIds.has(step.id);
            const isPending = !isCompleted && !isFailed;
            let stepStatus: string;
            if (isCompleted) stepStatus = "completed";
            else if (isFailed) stepStatus = "failed";
            else if (execution.pendingApproval?.stepId === step.id) stepStatus = "awaiting_approval";
            else if (execution.state === "EXECUTING" && isPending && index === execution.completedSteps.length) stepStatus = "running";
            else stepStatus = "pending";

            return (
              <div key={step.id} className="flex gap-3 pb-4">
                {/* Timeline connector */}
                <div className="flex flex-col items-center">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 bg-white shadow-sm"
                    style={{
                      borderColor: isCompleted ? "#10b981" : isFailed ? "#ef4444" : index === execution.completedSteps.length && execution.state === "EXECUTING" ? "#3b82f6" : "#e2e8f0",
                    }}
                  >
                    {stepStatusIcon(stepStatus)}
                  </div>
                  {index < steps.length - 1 && (
                    <div aria-hidden="true" className={cn("my-0.5 w-0.5 flex-1", isCompleted ? "bg-emerald-200" : "bg-slate-200")} />
                  )}
                </div>

                {/* Step content */}
                <div className={cn(
                  "flex-1 rounded-xl border p-3 transition",
                  isCompleted ? "border-emerald-200 bg-emerald-50/30" :
                  isFailed ? "border-rose-200 bg-rose-50/30" :
                  stepStatus === "running" ? "border-blue-200 bg-blue-50/30" :
                  "border-slate-200 bg-white",
                )}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-slate-400">{index + 1}</span>
                        <p className="text-sm font-semibold text-[var(--app-text-strong)]">{step.title}</p>
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">{step.objective}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {step.toolName && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">
                          {step.toolName}
                        </span>
                      )}
                      {step.approvalBoundary && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          Requiere aprobación
                        </span>
                      )}
                    </div>
                  </div>
                  {step.dependsOn.length > 0 && (
                    <p className="mt-1.5 text-[10px] text-slate-400">
                      Depende de: {step.dependsOn.join(", ")}
                    </p>
                  )}
                  {stepStatus === "running" && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-blue-600">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      En progreso...
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary footer */}
      {execution.summary && (
        <div className="border-t border-[var(--app-border)] px-5 py-3">
          <p className="text-xs text-[var(--app-text-muted)]">{execution.summary}</p>
        </div>
      )}
    </div>
  );
}

function AgentRightPanel({
  execution,
  allTools,
  onApprove,
  onReject,
  approving,
}: {
  execution: AgentExecutionView | null;
  allTools: Array<{ name: string; description: string; risk: AgentToolRisk }>;
  onApprove: (approvalId: string) => void;
  onReject: (approvalId: string) => void;
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
      {execution?.pendingApproval ? (
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
                {execution.pendingApproval.reason}
              </p>
              {execution.pendingApproval.impactSummary && (
                <div className="rounded-lg border border-amber-100 bg-amber-50/70 px-2.5 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-600 mb-0.5">
                    Impacto esperado
                  </p>
                  <p className="text-xs text-amber-800">
                    {execution.pendingApproval.impactSummary}
                  </p>
                </div>
              )}
              <p className="text-[11px] text-slate-400">
                ID: {execution.pendingApproval.approvalId}
              </p>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                className="flex-1 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={approving}
                onClick={() => onApprove(execution.pendingApproval!.approvalId)}
              >
                {approving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Aprobar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50"
                disabled={approving}
                onClick={() => onReject(execution.pendingApproval!.approvalId)}
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
          {execution?.toolActivity && execution.toolActivity.length > 0 ? (
            <div className="space-y-2">
              {execution.toolActivity.map((activity, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-2"
                >
                  {activity.success ? (
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
      {execution?.warnings && execution.warnings.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 shadow-sm">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">
                Advertencias
              </p>
            </div>
            <ul className="space-y-1">
              {execution.warnings.map((w, i) => (
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
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant" | "system"; content: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [execution, setExecution] = useState<AgentExecutionView | null>(null);
  const [approving, setApproving] = useState(false);

  const handleObjectiveSubmit = useCallback(async (obj: string) => {
    if (!obj.trim()) return;
    setObjective("");
    setMessages((prev) => [...prev, { role: "user", content: obj }]);
    setLoading(true);
    setStreaming(false);

    try {
      const response = await fetch("/api/ai/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: obj,
          projectId: projectId ?? undefined,
          mode: "goal",
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Error de conexión" }));
        throw new Error(typeof err.error === "string" ? err.error : "Error del agente");
      }

      const data: AgentExecutionView = await response.json();

      setExecution(data);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.summary || `Ejecución iniciada: estado ${data.state}`,
        },
      ]);

      if (data.pendingApproval) {
        const approval = data.pendingApproval;
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content: `⏸️ Se requiere tu aprobación para continuar: ${approval.reason}`,
          },
        ]);
      }
    } catch (error) {
      console.error("[AgentWorkspace] Error submitting objective:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: `❌ ${error instanceof Error ? error.message : "Error inesperado del agente."}`,
        },
      ]);
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  }, [projectId]);

  const handleApprove = useCallback(async (approvalId: string) => {
    setApproving(true);
    try {
      const response = await fetch("/api/ai/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalId, decision: "approve" }),
      });

      if (!response.ok) throw new Error("Error al aprobar");

      const result = await response.json();
      setMessages((prev) => [...prev, {
        role: "system",
        content: "✅ Aprobado. Continuando ejecución...",
      }]);
      setExecution((prev) => prev ? {
        ...prev,
        state: result.newState,
        pendingApproval: undefined,
      } : null);
    } catch {
      console.error("[AgentWorkspace] Error processing approval");
      setMessages((prev) => [...prev, {
        role: "system",
        content: "❌ Error al procesar la aprobación.",
      }]);
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

      const result = await response.json();
      setMessages((prev) => [...prev, {
        role: "system",
        content: "✕ Ejecución rechazada.",
      }]);
      setExecution((prev) => prev ? {
        ...prev,
        state: result.newState,
        pendingApproval: undefined,
      } : null);
    } catch {
      console.error("[AgentWorkspace] Error processing rejection");
      setMessages((prev) => [...prev, {
        role: "system",
        content: "❌ Error al procesar el rechazo.",
      }]);
    } finally {
      setApproving(false);
    }
  }, []);

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
        <ExecutionPlanPanel execution={execution} />
      </div>

      {/* Right: Tools + Approvals + Activity */}
      <AgentRightPanel
        execution={execution}
        allTools={getAvailableTools()}
        onApprove={handleApprove}
        onReject={handleReject}
        approving={approving}
      />
    </div>
  );
}
