"use client";

import { cn } from "@/lib/utils";

export function HistoryCountBadge({ className, count }: { className?: string; count: number }) {
  return (
    <span className={cn("rounded-full bg-[var(--app-surface-muted)] py-px font-semibold tabular-nums text-[var(--app-text-muted)]", className)}>
      {count}
    </span>
  );
}
