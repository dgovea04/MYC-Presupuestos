"use client";

import type { ReactNode } from "react";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { cn } from "@/lib/utils";

export function EmptyStatePanel({
  message,
  children,
  className,
}: {
  message?: string;
  children?: ReactNode;
  className?: string;
}) {
  const { isExcelMode } = useAppViewMode();
  return (
    <div
      className={cn(
        "border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600",
        isExcelMode ? "rounded-md" : "rounded-2xl",
        className,
      )}
    >
      {children ?? message}
    </div>
  );
}
