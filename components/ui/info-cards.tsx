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
      ? "theme-info-card-sky"
      : tone === "amber"
        ? "theme-info-card-amber"
        : tone === "emerald"
          ? "theme-info-card-emerald"
          : "theme-info-card-slate";

  return (
    <div
      className={cn(
        "theme-info-card px-4 py-3 transition-colors",
        isExcelMode ? "rounded-md shadow-none" : "rounded-2xl shadow-[0_10px_24px_-22px_rgba(15,23,42,0.38)]",
        toneClass,
        layout === "inline" ? "flex items-center justify-between gap-3" : "space-y-1",
      )}
    >
      <p className="theme-info-card-label text-sm">{label}</p>
      <p className={cn("theme-info-card-value font-semibold tracking-tight", layout === "inline" ? "text-sm" : "text-lg")}>{value}</p>
      {layout === "stacked" && previewLabel && previewValue ? (
        <>
          <p className="theme-info-card-preview-label mt-3 text-xs uppercase tracking-[0.16em]">{previewLabel}</p>
          <div
            className={cn(
              "theme-info-card-preview-box mt-1 px-3 py-2",
              isExcelMode ? "rounded-sm" : "rounded-xl",
            )}
          >
            <p className="theme-info-card-preview-value text-sm font-medium">{previewValue}</p>
          </div>
        </>
      ) : null}
    </div>
  );
}
