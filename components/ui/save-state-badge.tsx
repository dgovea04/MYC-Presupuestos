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
    idle: bordered ? "border-slate-200 bg-slate-100/80 text-slate-600" : "bg-slate-100 text-slate-600",
    dirty: bordered ? "border-amber-200 bg-amber-100/80 text-amber-700" : "bg-amber-100 text-amber-700",
    saving: bordered ? "border-sky-200 bg-sky-100/80 text-sky-700" : "bg-sky-100 text-sky-700",
    saved: bordered ? "border-emerald-200 bg-emerald-100/80 text-emerald-700" : "bg-emerald-100 text-emerald-700",
    error: bordered ? "border-rose-200 bg-rose-100/80 text-rose-700" : "bg-rose-100 text-rose-700",
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
