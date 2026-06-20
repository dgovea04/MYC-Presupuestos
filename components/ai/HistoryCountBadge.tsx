"use client";

import { cn } from "@/lib/utils";

export function HistoryCountBadge({ className, count }: { className?: string; count: number }) {
  return (
    <span className={cn("rounded-full bg-slate-200 py-px font-semibold tabular-nums text-slate-600", className)}>
      {count}
    </span>
  );
}
