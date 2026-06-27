"use client";

import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAppTheme } from "@/components/layout/app-theme-provider";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { APP_SETTINGS_UPDATED_EVENT } from "@/lib/settings/events";
import { persistAppTheme } from "@/lib/theme/app-theme";
import type { UserSettingsRecord } from "@/types/settings";

export function AppThemeToggle() {
  const { setTheme, theme } = useAppTheme();
  const settings = useFormattingSettings();
  const [pending, setPending] = useState(false);
  const isDark = theme === "dark";

  async function handleToggle() {
    if (pending) return;

    setPending(true);
    const nextTheme = isDark ? "light" : "dark";

    try {
      const response = await fetch("/api/settings");
      if (!response.ok) {
        throw new Error("No se pudo leer la configuracion actual.");
      }

      const currentSettings = (await response.json()) as UserSettingsRecord;
      const saveResponse = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...currentSettings,
          appTheme: nextTheme,
        }),
      });

      if (!saveResponse.ok) {
        throw new Error("No se pudo guardar el tema.");
      }

      const savedSettings = (await saveResponse.json()) as UserSettingsRecord;
      setTheme(savedSettings.appTheme ?? nextTheme);
      persistAppTheme(savedSettings.appTheme ?? nextTheme);
      window.dispatchEvent(new CustomEvent(APP_SETTINGS_UPDATED_EVENT, { detail: savedSettings }));
    } catch {
      setTheme(settings.appTheme ?? theme);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-9 w-9 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-0 text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text-strong)]"
      disabled={pending}
      onClick={() => void handleToggle()}
      aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      title={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
