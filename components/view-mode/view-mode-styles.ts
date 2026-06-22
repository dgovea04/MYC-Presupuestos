import { cn } from "@/lib/utils";

export function getTableFrameClassName(isExcelMode: boolean, className?: string) {
  return cn(
    "overflow-hidden border bg-[var(--app-surface)]",
    isExcelMode
      ? "border-transparent rounded-none shadow-none"
      : "rounded-2xl border-[var(--app-border-soft)] shadow-none",
    className,
  );
}

export function getTableViewportClassName(isExcelMode: boolean, className?: string) {
  return cn("overflow-auto", isExcelMode ? "bg-[var(--app-surface)]" : "", className);
}

export function getOperationalPanelClassName(isExcelMode: boolean, className?: string) {
  return cn(
    isExcelMode
      ? "rounded-md border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-3 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.14)]"
      : "rounded-2xl border-[var(--app-border-soft)] bg-[var(--app-surface)] p-4 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.32)]",
    className,
  );
}

export function getOperationalMetricBadgeClassName(isExcelMode: boolean, tone: "neutral" | "accent") {
  return cn(
    "inline-flex items-center px-3 py-1 text-xs font-medium shadow-[0_8px_18px_-16px_rgba(15,23,42,0.4)]",
    isExcelMode ? "rounded-sm" : "rounded-full",
    tone === "accent"
      ? "border border-[var(--app-primary)]/20 bg-[var(--app-surface-elevated)] text-[var(--app-primary)]"
      : "border border-[var(--app-border-soft)] bg-[var(--app-surface-elevated)] text-[var(--app-text-muted)]",
  );
}

export function getOperationalFilterSummaryClassName(isExcelMode: boolean, className?: string) {
  return cn(
    "border bg-[var(--app-surface)] text-sm text-[var(--app-text-muted)]",
    isExcelMode ? "rounded-md border-[var(--app-border)] px-3 py-2" : "rounded-2xl border-[var(--app-border-soft)] px-4 py-3",
    className,
  );
}

export function getFormSectionPanelClassName(isExcelMode: boolean, className?: string) {
  return cn(
    "space-y-4 border transition-colors",
    isExcelMode
      ? "rounded-md border-[var(--app-border)] bg-[var(--app-surface)] p-3 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.14)]"
      : "rounded-2xl border-[var(--app-border-soft)] bg-[var(--app-surface)] p-4 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.28)]",
    className,
  );
}

export function getFormActionBarClassName(isExcelMode: boolean, className?: string) {
  return cn(
    "flex items-center justify-end border bg-[var(--app-surface)]",
    isExcelMode
      ? "rounded-md border-[var(--app-border)] px-3 py-2 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.14)]"
      : "rounded-2xl border-[var(--app-border-soft)] px-4 py-3 shadow-[0_10px_25px_-22px_rgba(15,23,42,0.35)]",
    className,
  );
}
