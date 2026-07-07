"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { MessageSquare, Clock, Save, History, Users, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CollaborationPresenceRecord } from "@/types/collaboration";

interface BudgetCollaborationBarProps {
  budgetId: string;
  projectId: string;
  connected: boolean;
  presence: CollaborationPresenceRecord[];
  activeCommentCount: number;
  onOpenComments: () => void;
  onOpenHistory: () => void;
  onOpenVersions: () => void;
  onSaveVersion: () => void;
}

export const BudgetCollaborationBar = memo(function BudgetCollaborationBar({
  budgetId,
  projectId,
  connected,
  presence,
  activeCommentCount,
  onOpenComments,
  onOpenHistory,
  onOpenVersions,
  onSaveVersion,
}: BudgetCollaborationBarProps) {
  const [collapsed, setCollapsed] = useState(true);

  // Auto-expand on first mount if there are other users
  useEffect(() => {
    if (presence.length > 1) {
      setCollapsed(false);
    }
  }, [presence.length]);

  const actionButtons = (
    <div className="flex items-center gap-0.5">
      <BarButton
        onClick={onOpenComments}
        label="Comentarios"
        badge={activeCommentCount > 0 ? activeCommentCount : undefined}
      >
        <MessageSquare className="h-3.5 w-3.5" />
      </BarButton>
      <BarButton onClick={onOpenHistory} label="Historial">
        <Clock className="h-3.5 w-3.5" />
      </BarButton>
      <BarButton onClick={onOpenVersions} label="Versiones">
        <History className="h-3.5 w-3.5" />
      </BarButton>
      <BarButton onClick={onSaveVersion} label="Guardar version">
        <Save className="h-3.5 w-3.5" />
      </BarButton>
    </div>
  );

  if (collapsed) {
    return (
      <div className="flex items-center gap-1 px-3 py-1.5">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1 text-xs font-medium text-[var(--app-text-muted)] transition hover:border-[var(--app-border-strong)] hover:text-[var(--app-text-strong)]"
          title="Abrir barra de colaboracion"
          aria-label="Abrir barra de colaboracion"
        >
          <Users className="h-3.5 w-3.5" />
          Colaboracion
        </button>
        {actionButtons}
        {presence.length > 1 ? (
          <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">
            {presence.length}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 shadow-sm">
      {/* Connection status */}
      <span
        className={cn(
          "inline-flex h-2 w-2 rounded-full",
          connected ? "bg-emerald-500" : "bg-slate-300",
        )}
        title={connected ? "Conectado" : "Desconectado"}
      />

      {/* Presence avatars */}
      <div className="flex -space-x-2">
        {presence.slice(0, 4).map((p) => (
          <div
            key={p.userId}
            className={cn(
              "inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--app-surface)] text-[10px] font-semibold",
              p.status === "ACTIVE"
                ? "bg-sky-600 text-white"
                : "bg-amber-100 text-amber-700",
            )}
            title={`${p.userName}${p.status === "IDLE" ? " (ausente)" : ""} — ${p.module}`}
          >
            {getInitials(p.userName)}
          </div>
        ))}
        {presence.length > 4 ? (
          <div className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--app-surface)] bg-slate-200 text-[10px] font-semibold text-slate-600">
            +{presence.length - 4}
          </div>
        ) : null}
      </div>

      {/* Action buttons */}
      {actionButtons}

      {/* Collapse button */}
      <button
        type="button"
        onClick={() => setCollapsed(true)}
        className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded text-[var(--app-text-muted)] hover:text-[var(--app-text-strong)]"
        title="Colapsar barra"
        aria-label="Colapsar barra de colaboracion"
      >
        ×
      </button>
    </div>
  );
});

function BarButton({
  onClick,
  label,
  badge,
  children,
}: {
  onClick: () => void;
  label: string;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-strong)]"
      title={label}
      aria-label={label}
    >
      {children}
      {badge !== undefined ? (
        <span className="absolute -right-0.5 -top-0.5 inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-sky-600 px-1 text-[9px] font-bold text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </button>
  );
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
}
