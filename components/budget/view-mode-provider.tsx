"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { coerceViewMode, readStoredViewMode, writeStoredViewMode, type ViewMode } from "@/lib/budget/view-mode";

type BudgetViewModeContextValue = {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isExcelMode: boolean;
};

const BudgetViewModeContext = createContext<BudgetViewModeContextValue | null>(null);

function getLocalStorageSafely(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function BudgetViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>("modern");

  useEffect(() => {
    void Promise.resolve().then(() => {
      const nextMode = readStoredViewMode(getLocalStorageSafely());

      setViewModeState((currentMode) => (currentMode === nextMode ? currentMode : nextMode));
    });
  }, []);

  const setViewMode = useCallback((mode: ViewMode) => {
    const nextMode = coerceViewMode(mode);

    setViewModeState(nextMode);
    writeStoredViewMode(getLocalStorageSafely(), nextMode);
  }, []);

  const value = useMemo(
    () => ({
      viewMode,
      setViewMode,
      isExcelMode: viewMode === "excel",
    }),
    [viewMode, setViewMode],
  );

  return (
    <BudgetViewModeContext.Provider value={value}>
      <div data-view-mode={viewMode}>{children}</div>
    </BudgetViewModeContext.Provider>
  );
}

export function useBudgetViewMode(): BudgetViewModeContextValue {
  const context = useContext(BudgetViewModeContext);

  if (!context) {
    throw new Error("useBudgetViewMode must be used within BudgetViewModeProvider");
  }

  return context;
}
