"use client";

import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { cn } from "@/lib/utils";

export type SaveStateBadgeStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export function SaveStateBadge({
  state,
  lastSavedLabel,
  savedLabel = "Guardado automatico",
  compact = false,
  bordered = false,
  className,
}: {
  state: SaveStateBadgeStatus;
  lastSavedLabel: string | null;
  savedLabel?: string;
  compact?: boolean;
  bordered?: boolean;
  className?: string;
}) {
  const { isExcelMode } = useAppViewMode();
  const styles: Record<SaveStateBadgeStatus, string> = {
    idle: bordered
      ? "border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]"
      : "bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]",
    dirty: bordered
      ? "border-[color:rgba(245,158,11,0.32)] bg-[color:rgba(245,158,11,0.14)] text-[var(--app-warning)]"
      : "bg-[color:rgba(245,158,11,0.16)] text-[var(--app-warning)]",
    saving: bordered
      ? "border-[color:rgba(37,99,235,0.32)] bg-[color:rgba(37,99,235,0.14)] text-[var(--app-primary-soft)]"
      : "bg-[color:rgba(37,99,235,0.16)] text-[var(--app-primary-soft)]",
    saved: bordered
      ? "border-[color:rgba(16,185,129,0.32)] bg-[color:rgba(16,185,129,0.14)] text-[var(--app-success)]"
      : "bg-[color:rgba(16,185,129,0.16)] text-[var(--app-success)]",
    error: bordered
      ? "border-[color:rgba(239,68,68,0.32)] bg-[color:rgba(239,68,68,0.14)] text-[var(--app-danger)]"
      : "bg-[color:rgba(239,68,68,0.16)] text-[var(--app-danger)]",
  };

  const labels: Record<SaveStateBadgeStatus, string> = {
    idle: "Sin cambios",
    dirty: "Cambios pendientes",
    saving: "Guardando...",
    saved: savedLabel,
    error: "Error al guardar",
  };

  return (
    <span
      className={cn(
        "inline-flex flex-col text-xs font-medium transition-colors",
        isExcelMode ? "shadow-none" : "shadow-[0_8px_20px_-18px_rgba(15,23,42,0.45)]",
        bordered ? (isExcelMode ? "rounded-md border" : "rounded-2xl border") : isExcelMode ? "rounded-sm" : "rounded-full",
        compact ? "px-2.5 py-1.5" : "px-3 py-2",
        styles[state],
        className,
      )}
    >
      <span>{labels[state]}</span>
      {lastSavedLabel ? (
        <span className={cn("mt-0.5 font-normal opacity-80", compact ? "text-[9px]" : "text-[11px]")}>
          {lastSavedLabel}
        </span>
      ) : null}
    </span>
  );
}
