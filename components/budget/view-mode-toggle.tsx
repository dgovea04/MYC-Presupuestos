"use client";

import { useBudgetViewMode } from "@/components/budget/view-mode-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ViewModeToggle() {
  const { viewMode, setViewMode } = useBudgetViewMode();

  return (
    <div
      aria-label="Selector de modo de vista"
      className="inline-flex items-center rounded-lg border border-slate-300 bg-white p-1"
      role="group"
    >
      <Button
        aria-pressed={viewMode === "modern"}
        className={cn("min-w-24", viewMode === "modern" ? "shadow-none" : "")}
        onClick={() => setViewMode("modern")}
        size="sm"
        type="button"
        variant={viewMode === "modern" ? "secondary" : "ghost"}
      >
        Moderna
      </Button>
      <Button
        aria-pressed={viewMode === "excel"}
        className={cn("min-w-24", viewMode === "excel" ? "shadow-none" : "")}
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
