import { cn } from "@/lib/utils";

export function getTableFrameClassName(isExcelMode: boolean, className?: string) {
  return cn(
    "overflow-hidden border bg-white",
    isExcelMode
      ? "border-transparent rounded-none shadow-none"
      : "rounded-2xl border-slate-200 shadow-none",
    className,
  );
}

export function getTableViewportClassName(isExcelMode: boolean, className?: string) {
  return cn("overflow-auto", isExcelMode ? "bg-white" : "", className);
}

export function getOperationalPanelClassName(isExcelMode: boolean, className?: string) {
  return cn(
    isExcelMode
      ? "rounded-md border-slate-300 bg-white px-3 py-3 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.14)]"
      : "rounded-2xl border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(248,250,252,0.95)_100%)] p-4 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.32)]",
    className,
  );
}

export function getOperationalMetricBadgeClassName(isExcelMode: boolean, tone: "neutral" | "accent") {
  return cn(
    "inline-flex items-center px-3 py-1 text-xs font-medium shadow-[0_8px_18px_-16px_rgba(15,23,42,0.4)]",
    isExcelMode ? "rounded-sm" : "rounded-full",
    tone === "accent"
      ? "border border-sky-200 bg-sky-100 text-sky-700"
      : "border border-slate-200 bg-slate-100 text-slate-700",
  );
}

export function getOperationalFilterSummaryClassName(isExcelMode: boolean, className?: string) {
  return cn(
    "border bg-white/90 text-sm text-slate-500",
    isExcelMode ? "rounded-md border-slate-300 px-3 py-2" : "rounded-2xl border-slate-200 px-4 py-3",
    className,
  );
}

export function getFormSectionPanelClassName(isExcelMode: boolean, className?: string) {
  return cn(
    "space-y-4 border transition-colors",
    isExcelMode
      ? "rounded-md border-slate-300 bg-white p-3 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.14)]"
      : "rounded-2xl border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(248,250,252,0.92)_100%)] p-4 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.28)]",
    className,
  );
}

export function getFormActionBarClassName(isExcelMode: boolean, className?: string) {
  return cn(
    "flex items-center justify-end border bg-white/95",
    isExcelMode
      ? "rounded-md border-slate-300 px-3 py-2 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.14)]"
      : "rounded-2xl border-slate-200/90 px-4 py-3 shadow-[0_10px_25px_-22px_rgba(15,23,42,0.35)]",
    className,
  );
}
