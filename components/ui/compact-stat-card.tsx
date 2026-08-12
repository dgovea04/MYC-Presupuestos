"use client";

import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { cn } from "@/lib/utils";

export function CompactStatCard({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "sky" | "slate" | "violet" | "rose" | "amber" | "emerald";
}) {
  const { isExcelMode } = useAppViewMode();
  const tones = {
    sky: "border-[var(--app-border-soft)] bg-[var(--app-surface)] text-sky-700",
    slate: "border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)]",
    violet: "border-violet-100 bg-[var(--app-surface)] text-violet-700",
    rose: "border-rose-100 bg-[var(--app-surface)] text-rose-700",
    amber: "border-amber-100 bg-[var(--app-surface)] text-amber-700",
    emerald: "border-emerald-100 bg-[var(--app-surface)] text-emerald-700",
  } as const;

  return (
    <div
      className={cn(
        "compact-stat-card border px-4 py-3",
        `compact-stat-card-${tone}`,
        isExcelMode ? "rounded-md border-slate-300 shadow-none" : "rounded-2xl shadow-sm",
        tones[tone],
      )}
    >
      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--app-text-subtle)]">{label}</p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}
