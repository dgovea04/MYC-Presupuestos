"use client";

import { useBudgetViewMode } from "@/components/budget/view-mode-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ViewModeToggle() {
  const { viewMode, setViewMode } = useBudgetViewMode();

  return (
    <div
      aria-label="Selector de modo de vista"
      className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm transition hover:border-slate-300"
      role="group"
    >
      <Button
        aria-pressed={viewMode === "modern"}
        className={cn("min-w-24 rounded-lg px-3 py-1 text-xs", viewMode === "modern" ? "shadow-none" : "text-slate-500")}
        onClick={() => setViewMode("modern")}
        size="sm"
        type="button"
        variant={viewMode === "modern" ? "secondary" : "ghost"}
      >
        Moderna
      </Button>
      <Button
        aria-pressed={viewMode === "excel"}
        className={cn("min-w-24 rounded-lg px-3 py-1 text-xs", viewMode === "excel" ? "shadow-none" : "text-slate-500")}
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
