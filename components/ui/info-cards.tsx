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
      ? "border-sky-200 bg-sky-50"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50"
        : tone === "emerald"
          ? "border-emerald-200 bg-emerald-50"
          : "border-slate-200 bg-slate-50";

  return (
    <div
      className={cn(
        "border px-4 py-3 transition-colors",
        isExcelMode ? "rounded-md shadow-none" : "rounded-2xl shadow-[0_10px_24px_-22px_rgba(15,23,42,0.38)]",
        toneClass,
        layout === "inline" ? "flex items-center justify-between gap-3" : "space-y-1",
      )}
    >
      <p className="text-sm text-slate-500">{label}</p>
      <p className={cn("font-semibold tracking-tight text-slate-900", layout === "inline" ? "text-sm" : "text-lg")}>{value}</p>
      {layout === "stacked" && previewLabel && previewValue ? (
        <>
          <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-400">{previewLabel}</p>
          <div className={cn("mt-1 bg-slate-100 px-3 py-2", isExcelMode ? "rounded-sm" : "rounded-xl")}>
            <p className="text-sm font-medium text-slate-700">{previewValue}</p>
          </div>
        </>
      ) : null}
    </div>
  );
}
