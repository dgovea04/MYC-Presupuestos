"use client";

import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { cn } from "@/lib/utils";

export function InfoCard({
  label,
  value,
  tone = "slate",
  layout = "stacked",
  previewLabel,
  previewValue,
}: {
  label: string;
  value: string;
  tone?: "slate" | "sky" | "amber" | "emerald";
  layout?: "stacked" | "inline";
  previewLabel?: string;
  previewValue?: string;
}) {
  const { isExcelMode } = useAppViewMode();
  const toneClass =
    tone === "sky"
      ? "border-[color:rgba(37,99,235,0.24)] bg-[color:rgba(37,99,235,0.10)] text-sky-700"
      : tone === "amber"
        ? "border-[color:rgba(245,158,11,0.24)] bg-[color:rgba(245,158,11,0.10)] text-amber-700"
        : tone === "emerald"
          ? "border-[color:rgba(16,185,129,0.24)] bg-[color:rgba(16,185,129,0.10)] text-emerald-700"
          : "border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)]";

  return (
    <div
      className={cn(
        "border px-4 py-3 transition-colors",
        isExcelMode ? "rounded-md shadow-none" : "rounded-2xl shadow-[0_10px_24px_-22px_rgba(15,23,42,0.38)]",
        toneClass,
        layout === "inline" ? "flex items-center justify-between gap-3" : "space-y-1",
      )}
    >
      <p className="text-sm text-[var(--app-text-muted)]">{label}</p>
      <p className={cn("font-semibold tracking-tight text-[var(--app-text-strong)]", layout === "inline" ? "text-sm" : "text-lg")}>{value}</p>
      {layout === "stacked" && previewLabel && previewValue ? (
        <>
          <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[var(--app-text-subtle)]">{previewLabel}</p>
          <div
            className={cn(
              "mt-1 border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2",
              isExcelMode ? "rounded-sm" : "rounded-xl",
            )}
          >
            <p className="text-sm font-medium text-[var(--app-text-strong)]">{previewValue}</p>
          </div>
        </>
      ) : null}
    </div>
  );
}
