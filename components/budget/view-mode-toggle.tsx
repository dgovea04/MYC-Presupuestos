"use client";

import { useBudgetViewMode } from "@/components/budget/view-mode-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ViewModeToggle() {
  const { viewMode, setViewMode } = useBudgetViewMode();

  return (
    <div
      aria-label="Selector de modo de vista"
      className="view-mode-toggle inline-flex items-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-1 h-9"
      role="group"
    >
      <Button
        aria-pressed={viewMode === "modern"}
        className={cn(
          "min-w-24 rounded-lg px-3 py-1 text-xs",
          viewMode === "modern" ? "shadow-none" : "text-[var(--app-text-muted)]",
        )}
        onClick={() => setViewMode("modern")}
        size="sm"
        type="button"
        variant={viewMode === "modern" ? "secondary" : "ghost"}
      >
        Moderna
      </Button>
      <Button
        aria-pressed={viewMode === "excel"}
        className={cn(
          "min-w-24 rounded-lg px-3 py-1 text-xs",
          viewMode === "excel" ? "shadow-none" : "text-[var(--app-text-muted)]",
        )}
        onClick={() => setViewMode("excel")}
        size="sm"
        type="button"
        variant={viewMode === "excel" ? "secondary" : "ghost"}
      >
        Tipo Excel
      </Button>
    </div>
  );
}
