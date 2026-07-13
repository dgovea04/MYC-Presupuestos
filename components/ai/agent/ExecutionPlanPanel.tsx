"use client";

import {
  CheckCircle2,
  XCircle,
  Loader2,
  Activity,
  Lightbulb,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentExecutionState } from "@/lib/ai/agent/types";

// ─── Helpers ────────────────────────────────────────────────────────────────

export function stateBadge(state: AgentExecutionState) {
  const map: Record<string, { label: string; className: string }> = {
    READ: { label: "Leyendo", className: "bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]" },
    PLAN: { label: "Planificando", className: "bg-blue-50 text-blue-700" },
    PROPOSE: { label: "Propuesta", className: "bg-purple-50 text-purple-700" },
    SIMULATE: { label: "Simulando", className: "bg-indigo-50 text-indigo-700" },
    PENDING_APPROVAL: { label: "Esperando aprobación", className: "bg-amber-50 text-amber-700" },
    EXECUTING: { label: "Ejecutando", className: "bg-blue-50 text-blue-700" },
    EXECUTED: { label: "Completado", className: "bg-emerald-50 text-emerald-700" },
    FAILED: { label: "Falló", className: "bg-rose-50 text-rose-700" },
    ROLLED_BACK: { label: "Revertido", className: "bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]" },
  };
  const entry = map[state] ?? { label: state, className: "bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]" };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", entry.className)}>
      {entry.label}
    </span>
  );
}

export function CardSectionHeader({
  icon: Icon,
  label,
  className,
}: {
  icon: typeof Zap;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-center gap-2.5", className)}>
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--app-bg-strong)]">
        <Icon className="h-3.5 w-3.5 text-[var(--app-text-muted)]" />
      </div>
      <p className="text-xs font-display font-bold text-[var(--app-text-strong)]">
        {label}
      </p>
    </div>
  );
}

// ─── ExecutionPlanPanel ──────────────────────────────────────────────────────

type ExecutionPlanPanelProps = {
  streaming: boolean;
  streamExecution: {
    state: AgentExecutionState | null;
    toolActivity: Array<{
      toolName: string;
      success: boolean;
      latencyMs?: number;
      summary: string;
    }>;
    summary: string | null;
  };
  fallbackStatus?: "idle" | "executing" | "done" | "failed";
  fallbackActivity?: {
    toolName: string;
    success: boolean;
    latencyMs?: number;
    summary: string;
  } | null;
};

export function ExecutionPlanPanel({
  streaming,
  streamExecution,
  fallbackStatus,
  fallbackActivity,
}: ExecutionPlanPanelProps) {
  const isIdle = !streamExecution.state && !streaming;

  if (isIdle) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--app-bg-strong)]">
          <Lightbulb className="h-6 w-6 text-[var(--app-text-muted)]" />
        </div>
        <h3 className="text-base font-display font-bold text-[var(--app-text-strong)]">Sin plan de ejecución</h3>
        <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-[var(--app-text-muted)]">
          Envía un objetivo en el panel de chat para que Khipu planifique los pasos necesarios.
        </p>
      </div>
    );
  }

  const toolCount = streamExecution.toolActivity.length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--app-border)] px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-display font-bold text-[var(--app-text-strong)]">Plan de Ejecución</h2>
            <p className="text-xs text-[var(--app-text-muted)]">
              {streamExecution.state
                ? stateBadge(streamExecution.state)
                : streaming
                  ? "Ejecutando..."
                  : "Sin estado"}
            </p>
          </div>
        </div>
        {streaming && (
          <div className="flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700" aria-live="polite">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
            </span>
            En vivo
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {streaming && (
          <div className="mb-5 rounded-2xl border border-[var(--app-primary-muted)] bg-[var(--app-primary-muted)]/50 p-4">
            <div className="flex items-center gap-2.5 text-sm font-semibold text-[var(--app-primary)]">
              <Zap className="h-4 w-4" />
              <span>Ejecución en tiempo real</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--app-text-muted)]">
              Khipu está procesando tu solicitud. Las herramientas ejecutadas aparecerán a continuación.
            </p>
          </div>
        )}

        {/* Fallback activity */}
        {fallbackActivity && (
          <div className="mb-4 space-y-0">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-amber-600">
              ⚠️ Fallback — Generación directa
            </p>
            <div className="group flex gap-3 pb-4 last:pb-0">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border-2 bg-[var(--app-surface)] transition-colors",
                    fallbackStatus === "executing"
                      ? "border-amber-400"
                      : fallbackActivity.success
                        ? "border-emerald-400"
                        : "border-rose-400",
                  )}
                >
                  {fallbackStatus === "executing" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                  ) : fallbackActivity.success ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-rose-500" />
                  )}
                </div>
              </div>
              <div
                className={cn(
                  "flex-1 rounded-xl border px-3.5 py-2.5 transition-colors",
                  fallbackStatus === "executing"
                    ? "border-amber-100 bg-amber-50/20"
                    : fallbackActivity.success
                      ? "border-emerald-100 bg-emerald-50/20"
                      : "border-rose-100 bg-rose-50/20",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="truncate text-xs font-semibold text-[var(--app-text-strong)]">
                      {fallbackActivity.toolName}
                    </span>
                  </div>
                  {fallbackActivity.latencyMs && (
                    <span className="shrink-0 text-[10px] font-medium tabular-nums text-[var(--app-text-muted)]">
                      {fallbackActivity.latencyMs}ms
                    </span>
                  )}
                </div>
                {fallbackActivity.summary && (
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--app-text-muted)] whitespace-pre-wrap">
                    {fallbackActivity.summary}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {toolCount > 0 && (
          <div className="space-y-0">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--app-text-muted)]">
              Herramientas ejecutadas ({toolCount})
            </p>
            {streamExecution.toolActivity.map((activity, i) => (
              <div key={i} className="group flex gap-3 pb-4 last:pb-0">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full border-2 bg-[var(--app-surface)] transition-colors",
                      activity.success
                        ? "border-emerald-400"
                        : activity.latencyMs === undefined
                          ? "border-blue-400"
                          : "border-rose-400",
                    )}
                  >
                    {activity.latencyMs === undefined ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                    ) : activity.success ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-rose-500" />
                    )}
                  </div>
                  {i < toolCount - 1 && (
                    <div
                      aria-hidden="true"
                      className={cn(
                        "my-1 w-0.5 flex-1 rounded-full",
                        activity.success ? "bg-emerald-200" : "bg-[var(--app-border-soft)]",
                      )}
                    />
                  )}
                </div>
                <div
                  className={cn(
                    "flex-1 rounded-xl border px-3.5 py-2.5 transition-colors",
                    activity.success
                      ? "border-emerald-100 bg-emerald-50/20"
                      : activity.latencyMs === undefined
                        ? "border-blue-100 bg-blue-50/20"
                        : "border-rose-100 bg-rose-50/20",
                    !activity.success && activity.latencyMs !== undefined && "group-hover:border-rose-200",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-[var(--app-text-muted)]">{String(i + 1).padStart(2, "0")}</span>
                      <span className="truncate text-xs font-semibold text-[var(--app-text-strong)]">
                        {activity.toolName}
                      </span>
                    </div>
                    {activity.latencyMs !== undefined && (
                      <span className="shrink-0 text-[10px] font-medium tabular-nums text-[var(--app-text-muted)]">
                        {activity.latencyMs}ms
                      </span>
                    )}
                  </div>
                  {activity.summary && (
                    <p className={cn(
                      "mt-1 text-[11px] leading-relaxed text-[var(--app-text-muted)]",
                      activity.summary.includes("\n") ? "whitespace-pre-wrap" : "truncate",
                    )}>{activity.summary}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!streaming && toolCount === 0 && streamExecution.state && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--app-bg-strong)]">
              {streamExecution.state === "FAILED" ? (
                <XCircle className="h-6 w-6 text-[var(--app-danger)]" />
              ) : (
                <CheckCircle2 className="h-6 w-6 text-[var(--app-success)]" />
              )}
            </div>
            <p className="text-sm font-semibold text-[var(--app-text-strong)]">
              {streamExecution.state === "FAILED"
                ? "La ejecución falló"
                : streamExecution.state === "EXECUTED"
                  ? "Ejecución completada"
                  : `Estado: ${streamExecution.state}`}
            </p>
            <p className="mt-1 max-w-xs text-xs text-[var(--app-text-muted)]">
              {streamExecution.state === "FAILED"
                ? "Ocurrió un error durante la ejecución. Revisa las advertencias para más detalles."
                : streamExecution.state === "EXECUTED"
                  ? "Todas las herramientas se ejecutaron correctamente."
                  : "La ejecución está en progreso."}
            </p>
          </div>
        )}
      </div>

      {/* Summary footer */}
      {streamExecution.summary && (
        <div className="border-t border-[var(--app-border-soft)] px-6 py-4">
          <p className="text-xs leading-relaxed text-[var(--app-text-muted)]">{streamExecution.summary}</p>
        </div>
      )}
    </div>
  );
}
