"use client";

import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { cn } from "@/lib/utils";
import { getProjectStatusLabel, getProjectStatusTone } from "@/lib/project-status";

export function ToneBadge({
  label,
  tone = "sky",
  bordered = false,
  className,
}: {
  label: string;
  tone?: "sky" | "slate" | "emerald" | "amber" | "rose" | "violet";
  bordered?: boolean;
  className?: string;
}) {
  const { isExcelMode } = useAppViewMode();
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 text-xs font-medium transition-colors",
        isExcelMode ? "rounded-sm shadow-none" : "rounded-full shadow-[0_8px_18px_-16px_rgba(15,23,42,0.4)]",
        getToneBadgeClassName(tone, bordered),
        className,
      )}
    >
      {label}
    </span>
  );
}

export function ProjectStatusBadge({ status }: { status: string }) {
  const config = getProjectStatusConfig(status);
  return <ToneBadge label={config.label} tone={config.tone} bordered />;
}

export function ContextBadge({
  label,
  tone = "sky",
}: {
  label: string;
  tone?: "sky" | "slate" | "emerald" | "amber" | "rose" | "violet";
}) {
  return <ToneBadge label={label} tone={tone} bordered />;
}

function getProjectStatusConfig(status: string) {
  return {
    label: getProjectStatusLabel(status),
    tone: getProjectStatusTone(status),
  };
}

function getToneBadgeClassName(
  tone: "sky" | "slate" | "emerald" | "amber" | "rose" | "violet",
  bordered: boolean,
) {
  if (tone === "slate") {
    return bordered ? "border border-slate-200 bg-slate-100 text-slate-700" : "bg-slate-100 text-slate-700";
  }

  if (tone === "emerald") {
    return bordered ? "border border-emerald-200 bg-emerald-100 text-emerald-700" : "bg-emerald-100 text-emerald-700";
  }

  if (tone === "amber") {
    return bordered ? "border border-amber-200 bg-amber-100 text-amber-700" : "bg-amber-100 text-amber-700";
  }

  if (tone === "rose") {
    return bordered ? "border border-rose-200 bg-rose-100 text-rose-700" : "bg-rose-100 text-rose-700";
  }

  if (tone === "violet") {
    return bordered ? "border border-violet-200 bg-violet-100 text-violet-700" : "bg-violet-100 text-violet-700";
  }

  return bordered ? "border border-sky-200 bg-sky-100 text-sky-700" : "bg-sky-100 text-sky-700";
}
