"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { APP_SETTINGS_UPDATED_EVENT } from "@/lib/settings/events";
import { applyAppThemeToDocument, persistAppTheme, readStoredAppTheme } from "@/lib/theme/app-theme";
import { DEFAULT_APP_THEME, type AppThemeOption } from "@/types/settings";

const AppThemeContext = createContext<{
  setTheme: (theme: AppThemeOption) => void;
  theme: AppThemeOption;
}>({
  setTheme: () => undefined,
  theme: DEFAULT_APP_THEME,
});

export function AppThemeProvider({
  children,
  initialTheme,
}: {
  children: ReactNode;
  initialTheme: AppThemeOption;
}) {
  const [theme, setTheme] = useState<AppThemeOption>(() => readStoredAppTheme() ?? initialTheme);

  useEffect(() => {
    const shouldTransition =
      typeof document !== "undefined" && document.documentElement.dataset.theme !== theme;

    applyAppThemeToDocument(theme, { transition: shouldTransition });
    persistAppTheme(theme);
  }, [theme]);

  useEffect(() => {
    const handleSettingsUpdated = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail || typeof detail !== "object") return;
      const nextTheme = (detail as { appTheme?: unknown }).appTheme;
      if (nextTheme === "light" || nextTheme === "dark") {
        setTheme(nextTheme);
      }
    };

    window.addEventListener(APP_SETTINGS_UPDATED_EVENT, handleSettingsUpdated);
    return () => window.removeEventListener(APP_SETTINGS_UPDATED_EVENT, handleSettingsUpdated);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return (
    <AppThemeContext.Provider value={value}>
      <div className="theme-app min-h-screen bg-[var(--app-bg)]">
        {children}
      </div>
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(AppThemeContext);
}
