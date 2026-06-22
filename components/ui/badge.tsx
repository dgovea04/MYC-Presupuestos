"use client";

import type { ComponentPropsWithoutRef } from "react";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { cn } from "@/lib/utils";

export function Badge({ className, children, ...props }: ComponentPropsWithoutRef<"span">) {
  const { isExcelMode } = useAppViewMode();

  return (
    <span
      className={cn(
        "ui-badge inline-flex bg-[var(--app-surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--app-text-muted)]",
        isExcelMode ? "rounded-sm" : "rounded-full",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
