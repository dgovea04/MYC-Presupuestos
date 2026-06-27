"use client";

import type { ReactNode } from "react";
import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { getExcelViewCssVariables } from "@/lib/budget/excel-view-css";
import {
  APP_VIEW_MODE_SETTINGS_UPDATED_EVENT,
  applyViewModeToDocument,
  coerceViewMode,
  hasStoredViewMode,
  readStoredViewMode,
  writeStoredViewMode,
  type ViewMode,
} from "@/lib/budget/view-mode";

export type AppViewModeContextValue = {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isExcelMode: boolean;
};

const AppViewModeContext = createContext<AppViewModeContextValue | null>(null);
const DEFAULT_APP_VIEW_MODE_CONTEXT: AppViewModeContextValue = {
  viewMode: "modern",
  setViewMode: () => undefined,
  isExcelMode: false,
};

function getLocalStorageSafely(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function resolveInitialViewMode(defaultViewMode: ViewMode, initialViewMode?: ViewMode): ViewMode {
  return coerceViewMode(initialViewMode ?? defaultViewMode);
}

export function AppViewModeProvider({
  children,
  initialViewMode,
}: {
  children: ReactNode;
  initialViewMode?: ViewMode;
}) {
  const {
    defaultViewMode,
    excelRowHeight,
    excelShowFieldBorders,
  } = useFormattingSettings();
  const [viewMode, setViewModeState] = useState<ViewMode>(() => resolveInitialViewMode(defaultViewMode, initialViewMode));
  const [excelSettingsOverride, setExcelSettingsOverride] = useState<{
    defaultViewMode: ViewMode;
    excelShowFieldBorders: boolean;
    excelRowHeight: number;
  } | null>(null);

  const excelSettings = excelSettingsOverride ?? {
    defaultViewMode,
    excelShowFieldBorders,
    excelRowHeight,
  };

  useEffect(() => {
    const storage = getLocalStorageSafely();
    const storedModeExists = hasStoredViewMode(storage);
    const fallbackMode = coerceViewMode(initialViewMode ?? defaultViewMode);
    const nextMode = storedModeExists ? readStoredViewMode(storage) : fallbackMode;

    if (viewMode !== nextMode) {
      startTransition(() => {
        setViewModeState(nextMode);
      });
    }

    if (storedModeExists) {
      writeStoredViewMode(storage, nextMode);
      return;
    }

    applyViewModeToDocument(fallbackMode);
  }, [defaultViewMode, initialViewMode, viewMode]);

  useEffect(() => {
    const handleSettingsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{
        defaultViewMode: ViewMode;
        excelShowFieldBorders: boolean;
        excelRowHeight: number;
      }>).detail;

      if (!detail) {
        return;
      }

      setExcelSettingsOverride(detail);
      const storage = getLocalStorageSafely();
      const nextMode = hasStoredViewMode(storage) ? readStoredViewMode(storage) : coerceViewMode(detail.defaultViewMode);
      setViewModeState(nextMode);
    };

    window.addEventListener(APP_VIEW_MODE_SETTINGS_UPDATED_EVENT, handleSettingsUpdated);

    return () => {
      window.removeEventListener(APP_VIEW_MODE_SETTINGS_UPDATED_EVENT, handleSettingsUpdated);
    };
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
  const cssVariables = useMemo(
    () => getExcelViewCssVariables(excelSettings.excelShowFieldBorders, excelSettings.excelRowHeight),
    [excelSettings.excelRowHeight, excelSettings.excelShowFieldBorders],
  );

  return (
    <AppViewModeContext.Provider value={value}>
      <div data-view-mode={viewMode} style={cssVariables}>
        {children}
      </div>
    </AppViewModeContext.Provider>
  );
}

export function EnsureAppViewModeProvider({ children }: { children: ReactNode }) {
  const parentContext = useContext(AppViewModeContext);

  if (parentContext) {
    return <>{children}</>;
  }

  return <AppViewModeProvider>{children}</AppViewModeProvider>;
}

export function useOptionalAppViewMode(): AppViewModeContextValue | null {
  return useContext(AppViewModeContext);
}

export function useAppViewMode(): AppViewModeContextValue {
  return useOptionalAppViewMode() ?? DEFAULT_APP_VIEW_MODE_CONTEXT;
}
