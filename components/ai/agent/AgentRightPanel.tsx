"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CardSectionHeader } from "./ExecutionPlanPanel";
import type { AgentToolRisk } from "@/lib/ai/agent/types";
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ShieldCheck,
  Wrench,
  Activity,
  BrainCircuit,
  FolderKanban,
  Hash,
  Clock,
} from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────────

export function riskBadge(risk: AgentToolRisk | string) {
  const map: Record<string, string> = {
    read: "bg-emerald-50 text-emerald-700 border-emerald-200",
    write: "bg-amber-50 text-amber-700 border-amber-200",
    financial: "bg-rose-50 text-rose-700 border-rose-200",
    export: "bg-purple-50 text-purple-700 border-purple-200",
  };
  return (
    <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase", map[risk] ?? "bg-[var(--app-surface-muted)] text-[var(--app-text-muted)] border-[var(--app-border)]")}>
      {risk}
    </span>
  );
}

// ─── AgentRightPanel ─────────────────────────────────────────────────────────

type AgentRightPanelProps = {
  streamExecution: {
    state: string | null;
    summary: string | null;
    pendingApproval: {
      approvalId: string;
      toolName: string;
      reason: string;
    } | null;
    toolActivity: Array<{
      toolName: string;
      success: boolean;
      latencyMs?: number;
      summary: string;
    }>;
    warnings: string[];
    latencyMs: number | null;
  };
  streaming: boolean;
  projectId?: string;
  workspaceId?: string;
  workspaceName?: string;
  allTools: Array<{ name: string; description: string; risk: AgentToolRisk }>;
  onApprove: (approvalId: string) => void;
  onReject: (approvalId: string) => void;
  approving: boolean;
  intent: { type: string; confidence: string; reason?: string } | null;
  pendingAction: { type: string } | null;
};

export function AgentRightPanel({
  streamExecution,
  streaming,
  projectId,
  workspaceId,
  workspaceName,
  allTools,
  onApprove,
  onReject,
  approving,
  intent,
  pendingAction,
}: AgentRightPanelProps) {
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
            {intent && intent.type !== "general_chat" && (
              <div className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50/50 px-3.5 py-2.5">
                <BrainCircuit className="h-4 w-4 shrink-0 text-blue-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-[0.05em]">Intención</p>
                  <p className="mt-0.5 text-xs text-blue-700">
                    {intent.type}
                    <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                      {intent.confidence}
                    </span>
                  </p>
                  {intent.reason && (
                    <p className="mt-0.5 text-[10px] text-blue-500 truncate">{intent.reason}</p>
                  )}
                </div>
              </div>
            )}
            {pendingAction && (
              <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/50 px-3.5 py-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-[0.05em]">Acción pendiente</p>
                  <p className="mt-0.5 text-xs text-amber-700">{pendingAction.type}</p>
                </div>
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
            <div className="rounded-xl border border-amber-200 bg-[var(--app-surface)] p-4">
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
                    <p className={cn(
                      "mt-0.5 text-[11px] leading-relaxed text-[var(--app-text-muted)]",
                      activity.summary.includes("\n") ? "whitespace-pre-wrap" : "truncate",
                    )}>{activity.summary}</p>
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
        <Card className="rounded-2xl border-amber-200 bg-amber-50/50 shadow-sm" role="alert">
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
