"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { MessageSquare, Clock, Save, History, Users, Wifi, WifiOff, Lock, Sparkles } from "lucide-react";
import Link from "next/link";
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
  canUseCollaboration?: boolean;
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
  canUseCollaboration = true,
}: BudgetCollaborationBarProps) {
  const [collapsed, setCollapsed] = useState(true);

  // Auto-expand on first mount if there are other users
  useEffect(() => {
    if (presence.length > 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(false);
    }
  }, [presence.length]);

  const lockedUpgrade = (
    <div className="flex items-center gap-1.5">
      <Link
        href="/account"
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-900 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
      >
        <Sparkles className="h-3 w-3" aria-hidden="true" />
        Actualizar a Pro
      </Link>
    </div>
  );

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
          onClick={() => canUseCollaboration && setCollapsed(false)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition",
            canUseCollaboration
              ? "border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:border-[var(--app-border-strong)] hover:text-[var(--app-text-strong)]"
              : "border-amber-200 bg-amber-50 text-amber-800",
          )}
          title={canUseCollaboration ? "Abrir barra de colaboracion" : "Colaboracion simultanea disponible en Pro"}
          aria-label={canUseCollaboration ? "Abrir barra de colaboracion" : "Colaboracion simultanea disponible en Pro"}
        >
          {canUseCollaboration ? <Users className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" aria-hidden="true" />}
          Colaboracion
        </button>
        {canUseCollaboration ? actionButtons : lockedUpgrade}
        {canUseCollaboration && presence.length > 1 ? (
          <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">
            {presence.length}
          </span>
        ) : null}
      </div>
    );
  }

  if (!canUseCollaboration) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 shadow-sm">
        <Lock className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
        <span className="text-xs font-semibold text-amber-900">Colaboracion simultanea disponible en Pro</span>
        {lockedUpgrade}
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
