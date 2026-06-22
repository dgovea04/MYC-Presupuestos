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
        "border border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-4 py-6 text-sm text-[var(--app-text-muted)]",
        isExcelMode ? "rounded-md" : "rounded-2xl",
        className,
      )}
    >
      {children ?? message}
    </div>
  );
}
