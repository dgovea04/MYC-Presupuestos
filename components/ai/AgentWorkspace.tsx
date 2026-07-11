"use client";

import { useState, useCallback } from "react";
import {
  ArrowLeft,
  Bot,
  Building2,
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
  BrainCircuit,
  FolderKanban,
  Hash,
  Clock,
  Sparkles,
  DollarSign,
  BarChart4,
  Calendar,
  Search,
  FileText,
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

// ─── Bundle config ────────────────────────────────────────────────────────────

const BUNDLE_CONFIG = [
  {
    slug: "asistente-general",
    bundleSlug: "khipu-agent",
    name: "Asistente General",
    description: "Acceso completo a todas las herramientas de la plataforma",
    icon: Sparkles,
    color: "from-blue-500 to-blue-600",
    borderColor: "border-blue-200",
    bgLight: "bg-blue-50",
    textColor: "text-blue-700",
  },
  {
    slug: "crear-presupuesto-base",
    bundleSlug: "budget-agent",
    name: "Presupuestos",
    description: "Crear, clonar y gestionar presupuestos de obra",
    icon: DollarSign,
    color: "from-emerald-500 to-emerald-600",
    borderColor: "border-emerald-200",
    bgLight: "bg-emerald-50",
    textColor: "text-emerald-700",
  },
  {
    slug: "optimizar-apu",
    bundleSlug: "apu-agent",
    name: "APU",
    description: "Análisis de precios unitarios y optimización",
    icon: BarChart4,
    color: "from-purple-500 to-purple-600",
    borderColor: "border-purple-200",
    bgLight: "bg-purple-50",
    textColor: "text-purple-700",
  },
  {
    slug: "generar-cronograma",
    bundleSlug: "planning-agent",
    name: "Cronograma",
    description: "Planificación de obra, metrados y ruta crítica",
    icon: Calendar,
    color: "from-amber-500 to-amber-600",
    borderColor: "border-amber-200",
    bgLight: "bg-amber-50",
    textColor: "text-amber-700",
  },
  {
    slug: "revisar-apu-proyecto",
    bundleSlug: "review-agent",
    name: "Revisión",
    description: "Calidad y consistencia de presupuestos y APU",
    icon: Search,
    color: "from-rose-500 to-rose-600",
    borderColor: "border-rose-200",
    bgLight: "bg-rose-50",
    textColor: "text-rose-700",
  },
  {
    slug: "exportar-reportes",
    bundleSlug: "reporting-agent",
    name: "Reportes",
    description: "Exportaciones a PDF, Excel y dashboard",
    icon: FileText,
    color: "from-sky-500 to-sky-600",
    borderColor: "border-sky-200",
    bgLight: "bg-sky-50",
    textColor: "text-sky-700",
  },
] as const;

// ─── Types ──────────────────────────────────────────────────────────────────

type AgentWorkspaceProps = {
  projectId?: string;
  className?: string;
  initialObjective?: string;
  /** Slug del workflow/bundle a usar por defecto */
  defaultBundleSlug?: string;
  /** ID del workspace/empresa activa para pasar al agente como contexto */
  workspaceId?: string;
  /** Nombre del workspace/empresa activa */
  workspaceName?: string;
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

const BUNDLE_SLUG_LABELS: Record<string, string> = {
  "khipu-agent": "General",
  "budget-agent": "Presupuestos",
  "apu-agent": "APU",
  "planning-agent": "Cronograma",
  "review-agent": "Revisión",
  "reporting-agent": "Reportes",
};

function BundleSelector({
  selected,
  onSelect,
}: {
  selected: (typeof BUNDLE_CONFIG)[number]["slug"] | null;
  onSelect: (slug: (typeof BUNDLE_CONFIG)[number]["slug"]) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-8">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
          <Bot className="h-7 w-7 text-white" />
        </div>
        <h2 className="text-lg font-display font-bold text-[var(--app-text-strong)]">
          Khipu Agente
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--app-text-muted)]">
          Elige una especialidad para enfocar al asistente en tu tipo de tarea
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {BUNDLE_CONFIG.map((bundle) => {
          const Icon = bundle.icon;
          const isActive = selected === bundle.slug;

          return (
            <button
              key={bundle.slug}
              type="button"
              onClick={() => onSelect(bundle.slug)}
              className={cn(
                "group relative flex items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-150",
                isActive
                  ? cn(bundle.borderColor, bundle.bgLight, "shadow-sm ring-2 ring-offset-1 ring-blue-200/50")
                  : "border-[var(--app-border-soft)] bg-[var(--app-surface)] hover:border-[var(--app-border)] hover:shadow-sm",
              )}
            >
              <div
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition-transform duration-150 group-hover:scale-105",
                  isActive ? bundle.color : "bg-[var(--app-bg-strong)] text-[var(--app-text-muted)] group-hover:bg-slate-200",
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    isActive ? bundle.textColor : "text-[var(--app-text-strong)]",
                  )}
                >
                  {bundle.name}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--app-text-muted)]">
                  {bundle.description}
                </p>
              </div>
              {isActive && (
                <div className="absolute right-3 top-3">
                  <CheckCircle2 className={cn("h-5 w-5", bundle.textColor)} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AgentChatPanel({
  objective,
  setObjective,
  onObjectiveSubmit,
  messages,
  streaming,
  loading,
  selectedBundle,
  onSelectBundle,
  onClearBundle,
}: {
  objective: string;
  setObjective: (v: string) => void;
  onObjectiveSubmit: (objective: string) => void;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  streaming: boolean;
  loading: boolean;
  selectedBundle: (typeof BUNDLE_CONFIG)[number] | null;
  onSelectBundle: (slug: (typeof BUNDLE_CONFIG)[number]["slug"]) => void;
  onClearBundle: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="relative flex items-center gap-4 border-b border-[var(--app-border)] px-6 py-5">
        <div className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm",
          selectedBundle
            ? `bg-gradient-to-br ${selectedBundle.color}`
            : "bg-gradient-to-br from-blue-500 to-blue-600",
        )}>
          {selectedBundle ? <selectedBundle.icon className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
        </div>
        <div className="flex-1 pr-8">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-display font-bold text-[var(--app-text-strong)]">
              Khipu {selectedBundle ? selectedBundle.name : "Agente"}
            </h2>
            {selectedBundle && (
              <span className={cn(
                "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                selectedBundle.bgLight,
                selectedBundle.textColor,
              )}>
                {BUNDLE_SLUG_LABELS[selectedBundle.bundleSlug] ?? selectedBundle.bundleSlug}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
            {selectedBundle ? selectedBundle.description : "Asistente técnico de obra"}
          </p>
        </div>
        {selectedBundle && (
          <div className="group absolute right-4 top-4">
            <button
              type="button"
              onClick={onClearBundle}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-bg-strong)] hover:text-[var(--app-text-strong)]"
              aria-label="Cambiar especialidad"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-1.5 z-50 whitespace-nowrap rounded-md bg-[var(--app-surface-inverse)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--app-bg-elevated)] opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
              Cambiar especialidad
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 && !selectedBundle ? (
          <BundleSelector
            selected={null}
            onSelect={onSelectBundle}
          />
        ) : messages.length === 0 && selectedBundle ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className={cn(
              "mb-5 flex h-14 w-14 items-center justify-center rounded-2xl",
              selectedBundle.bgLight,
            )}>
              <selectedBundle.icon className={cn("h-7 w-7", selectedBundle.textColor)} />
            </div>
            <h3 className="text-lg font-display font-bold text-[var(--app-text-strong)]">
              ¿Qué necesitas hacer?
            </h3>
            <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-[var(--app-text-muted)]">
              Describe tu objetivo para {selectedBundle.name.toLowerCase()} o elige una sugerencia rápida
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-2.5">
              {[
                "Crear presupuesto para vivienda",
                "Revisar APU de concreto armado",
                "Generar cronograma del proyecto",
                "Comparar presupuestos activos",
              ].map((suggestion) => (
                <Button
                  key={suggestion}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full px-4 py-2 text-xs font-medium"
                  onClick={() => onObjectiveSubmit(suggestion)}
                >
                  {suggestion}
                </Button>
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
            placeholder={selectedBundle
              ? `Describe tu objetivo para ${selectedBundle.name.toLowerCase()}...`
              : "Describe tu objetivo: 'Crea un presupuesto para un hospital de 4 pisos'..."}
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
          <div className="flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
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
                    <p className="mt-1 truncate text-[11px] leading-relaxed text-[var(--app-text-muted)]">{activity.summary}</p>
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

function CardSectionHeader({
  icon: Icon,
  label,
  className,
}: {
  icon: typeof Sparkles;
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

function AgentRightPanel({
  streamExecution,
  streaming,
  projectId,
  workspaceId,
  workspaceName,
  allTools,
  onApprove,
  onReject,
  approving,
}: {
  streamExecution: ReturnType<typeof useAgentStream>["execution"];
  streaming: boolean;
  projectId?: string;
  workspaceId?: string;
  workspaceName?: string;
  allTools: Array<{ name: string; description: string; risk: AgentToolRisk }>;
  onApprove: (toolName: string) => void;
  onReject: (toolName: string) => void;
  approving: boolean;
}) {
  const completedTools = streamExecution.toolActivity.filter((a) => a.success).length;
  const failedTools = streamExecution.toolActivity.filter((a) => !a.success && a.latencyMs !== undefined).length;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-5">
      {/* Context / Memory Panel */}
      <Card className="rounded-2xl border-[var(--app-border-soft)] bg-[var(--app-surface)] shadow-sm">
        <CardContent className="p-5">
          <CardSectionHeader icon={BrainCircuit} label="Contexto" />
          <div className="space-y-2.5">
            {workspaceId && workspaceName && (
              <div className="flex items-center gap-2.5 rounded-xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-3.5 py-2.5">
                <Building2 className="h-4 w-4 shrink-0 text-[var(--app-text-muted)]" />
                <p className="min-w-0 flex-1 text-xs text-[var(--app-text)]">
                  <span className="text-[var(--app-text-muted)]">Empresa</span>{" "}
                  <span className="font-medium text-[var(--app-text-strong)]">{workspaceName}</span>
                </p>
              </div>
            )}
            {projectId && (
              <div className="flex items-center gap-2.5 rounded-xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-3.5 py-2.5">
                <FolderKanban className="h-4 w-4 shrink-0 text-[var(--app-text-muted)]" />
                <p className="min-w-0 flex-1 text-xs text-[var(--app-text)]">
                  <span className="text-[var(--app-text-muted)]">Proyecto</span>{" "}
                  <span className="font-mono font-medium text-[var(--app-text-strong)]">{projectId}</span>
                </p>
              </div>
            )}
            <div className="flex items-center gap-2.5 rounded-xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-3.5 py-2.5">
              <Hash className="h-4 w-4 shrink-0 text-[var(--app-text-muted)]" />
              <p className="min-w-0 flex-1 text-xs text-[var(--app-text)]">
                <span className="text-[var(--app-text-muted)]">Herramientas</span>{" "}
                <span className="font-semibold text-[var(--app-text-strong)]">{completedTools}</span>
                {failedTools > 0 && (
                  <span className="text-[var(--app-danger)]"> / {failedTools} fallos</span>
                )}
              </p>
            </div>
            {streamExecution.latencyMs && (
              <div className="flex items-center gap-2.5 rounded-xl border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-3.5 py-2.5">
                <Clock className="h-4 w-4 shrink-0 text-[var(--app-text-muted)]" />
                <p className="min-w-0 flex-1 text-xs text-[var(--app-text)]">
                  <span className="text-[var(--app-text-muted)]">Latencia</span>{" "}
                  <span className="font-semibold text-[var(--app-text-strong)]">{(streamExecution.latencyMs / 1000).toFixed(1)}s</span>
                </p>
              </div>
            )}
            {streamExecution.warnings.length > 0 && (
              <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/50 px-3.5 py-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                <p className="min-w-0 flex-1 text-xs font-medium text-amber-700">
                  {streamExecution.warnings.length} advertencia{streamExecution.warnings.length !== 1 ? "s" : ""}
                </p>
              </div>
            )}
            {streamExecution.summary && (
              <p className="text-xs leading-relaxed text-[var(--app-text-muted)]">
                {streamExecution.summary.slice(0, 120)}
                {streamExecution.summary.length > 120 ? "…" : ""}
              </p>
            )}
            {!streaming && !streamExecution.state && (
              <p className="text-xs italic text-[var(--app-text-muted)]">Sin contexto activo. Envía un objetivo para comenzar.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Available Tools */}
      <Card className="rounded-2xl border-[var(--app-border-soft)] bg-[var(--app-surface)] shadow-sm">
        <CardContent className="p-5">
          <CardSectionHeader icon={Wrench} label={`Herramientas (${allTools.length})`} />
          <div className="max-h-48 space-y-1.5 overflow-y-auto">
            {allTools.map((tool) => (
              <div
                key={tool.name}
                className="flex items-center justify-between rounded-xl border border-[var(--app-border-soft)] bg-[var(--app-surface-muted)] px-3 py-2 transition-colors hover:border-[var(--app-border)]"
              >
                <div className="min-w-0 flex-1 mr-2">
                  <p className="text-xs font-medium text-[var(--app-text-strong)]">{tool.name}</p>
                  <p className="mt-0.5 truncate text-[11px] text-[var(--app-text-muted)]">{tool.description}</p>
                </div>
                {riskBadge(tool.risk)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pending Approvals */}
      {streamExecution.pendingApproval ? (
        <Card className="rounded-2xl border-amber-200 bg-amber-50/50 shadow-sm">
          <CardContent className="p-5">
            <CardSectionHeader icon={ShieldCheck} label="Aprobación pendiente" className="mb-4" />
            <div className="rounded-xl border border-amber-200 bg-white p-4">
              <p className="text-sm font-semibold text-[var(--app-text-strong)]">
                {streamExecution.pendingApproval.reason}
              </p>
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-600">Herramienta</span>
                <code className="text-xs font-medium text-amber-800">
                  {streamExecution.pendingApproval.toolName}
                </code>
              </div>
            </div>
            <div className="mt-4 flex gap-2.5">
              <Button
                size="sm"
                className="flex-1 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={approving}
                onClick={() => onApprove(streamExecution.pendingApproval!.approvalId)}
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
        <Card className="rounded-2xl border-[var(--app-border-soft)] bg-[var(--app-surface)] shadow-sm">
          <CardContent className="p-5">
            <CardSectionHeader icon={ShieldCheck} label="Aprobaciones" />
            <p className="text-xs text-[var(--app-text-muted)]">Sin aprobaciones pendientes.</p>
          </CardContent>
        </Card>
      )}

      {/* Activity Timeline */}
      <Card className="rounded-2xl border-[var(--app-border-soft)] bg-[var(--app-surface)] shadow-sm">
        <CardContent className="p-5">
          <CardSectionHeader icon={Activity} label="Actividad" />
          {streamExecution.toolActivity.length > 0 ? (
            <div className="space-y-2">
              {streamExecution.toolActivity.map((activity, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 transition-colors",
                    activity.latencyMs === undefined
                      ? "border-blue-200 bg-blue-50/30"
                      : "border-[var(--app-border-soft)]",
                  )}
                >
                  {activity.latencyMs === undefined ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-500" />
                  ) : activity.success ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-rose-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[var(--app-text-strong)]">{activity.toolName}</p>
                    <p className="mt-0.5 truncate text-[11px] text-[var(--app-text-muted)]">{activity.summary}</p>
                  </div>
                  {activity.latencyMs && (
                    <span className="shrink-0 text-[10px] font-medium tabular-nums text-[var(--app-text-muted)]">{activity.latencyMs}ms</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--app-text-muted)]">Sin actividad registrada.</p>
          )}
        </CardContent>
      </Card>

      {/* Warnings */}
      {streamExecution.warnings.length > 0 && (
        <Card className="rounded-2xl border-amber-200 bg-amber-50/50 shadow-sm">
          <CardContent className="p-5">
            <CardSectionHeader icon={AlertTriangle} label="Advertencias" />
            <ul className="space-y-2">
              {streamExecution.warnings.map((w, i) => (
                <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-amber-700">
                  <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                  {w}
                </li>
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
  defaultBundleSlug,
  workspaceId,
  workspaceName,
}: AgentWorkspaceProps) {
  const [objective, setObjective] = useState(initialObjective);
  const [approving, setApproving] = useState(false);
  const [selectedBundleSlug, setSelectedBundleSlug] = useState<string | null>(defaultBundleSlug ?? null);

  const {
    status,
    messages,
    execution: streamExec,
    connect,
    disconnect,
  } = useAgentStream();

  const loading = status === "connecting";
  const streaming = status === "streaming";

  const selectedBundle = selectedBundleSlug
    ? BUNDLE_CONFIG.find((b) => b.slug === selectedBundleSlug) ?? null
    : null;

  const handleObjectiveSubmit = useCallback((obj: string) => {
    if (!obj.trim() || loading || streaming) return;
    setObjective("");
    connect({
      message: obj.trim(),
      // Enviar historial completo para mantener contexto entre turnos
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      projectId,
      workspaceId,
      mode: selectedBundleSlug ? "workflow" : "goal",
      workflowId: selectedBundleSlug ?? undefined,
    });
  }, [projectId, workspaceId, loading, streaming, connect, selectedBundleSlug, messages]);

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
      "grid gap-0 border border-[var(--app-border)] rounded-2xl bg-[var(--app-surface)] shadow-sm md:grid-cols-[320px_1fr_300px]",
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
          selectedBundle={selectedBundle}
          onSelectBundle={(slug) => setSelectedBundleSlug(slug)}
          onClearBundle={() => setSelectedBundleSlug(null)}
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
        projectId={projectId}
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        allTools={getAvailableTools()}
        onApprove={handleApprove}
        onReject={handleReject}
        approving={approving}
      />
    </div>
  );
}
