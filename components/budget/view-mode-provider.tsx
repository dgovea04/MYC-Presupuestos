"use client";

import type { ReactNode } from "react";
import { EnsureAppViewModeProvider, useOptionalAppViewMode, type AppViewModeContextValue } from "@/components/view-mode/app-view-mode-provider";

export type BudgetViewModeContextValue = AppViewModeContextValue;

export function BudgetViewModeProvider({ children }: { children: ReactNode }) {
  return <EnsureAppViewModeProvider>{children}</EnsureAppViewModeProvider>;
}

export function useBudgetViewMode(): BudgetViewModeContextValue {
  const context = useOptionalAppViewMode();

  if (!context) {
    throw new Error("useBudgetViewMode must be used within BudgetViewModeProvider");
  }

  return context;
}
