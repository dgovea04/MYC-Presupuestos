"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { EditableLine } from "./types";

export function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--app-text-muted)]">
        {label}
      </span>
      <span className="text-sm font-semibold text-[var(--app-text)]">{value}</span>
    </div>
  );
}

export function ViewButton({
  active,
  icon,
  onClick,
  children,
}: {
  active: boolean;
  icon: ReactNode;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition",
        active
          ? "bg-sky-600 text-white shadow-sm"
          : "bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-strong)] border border-[var(--app-border)]",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function ExportPreferenceButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-medium transition",
        active
          ? "bg-sky-600 text-white"
          : "border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)]",
      )}
    >
      {children}
    </button>
  );
}

export function WorkScheduleExportMenuButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center rounded-lg px-3 py-2 text-xs font-medium text-[var(--app-text)] transition hover:bg-[var(--app-surface-hover-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
    >
      {label}
    </button>
  );
}

export function Field({
  label,
  children,
  tooltip,
}: {
  label: string;
  children: ReactNode;
  tooltip?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--app-text-muted)]"
        title={tooltip}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

export function areEditableLinesEqual(previousLine: EditableLine | null, nextLine: EditableLine | null) {
  if (previousLine === nextLine) {
    return true;
  }

  if (!previousLine || !nextLine) {
    return false;
  }

  return (
    previousLine.budgetItemId === nextLine.budgetItemId &&
    previousLine.startDate === nextLine.startDate &&
    previousLine.endDate === nextLine.endDate &&
    previousLine.durationDays === nextLine.durationDays &&
    previousLine.predecessor === nextLine.predecessor &&
    previousLine.crew === nextLine.crew &&
    previousLine.isMilestone === nextLine.isMilestone &&
    areMonthlyDistributionsEqual(previousLine.monthlyDistributions, nextLine.monthlyDistributions)
  );
}

export function areMonthlyDistributionsEqual(
  previous: EditableLine["monthlyDistributions"],
  next: EditableLine["monthlyDistributions"],
) {
  if (previous.length !== next.length) {
    return false;
  }

  return previous.every(
    (dist, i) =>
      dist.year === next[i].year &&
      dist.month === next[i].month &&
      dist.percentage === next[i].percentage,
  );
}
