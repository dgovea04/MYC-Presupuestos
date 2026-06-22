"use client";

import { useState } from "react";
import { MonitorSmartphone, Save, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, type SelectValueChangeEvent } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  AI_PROVIDER_OPTIONS,
  FLOATING_KHIPU_FONT_SIZES,
  FLOATING_KHIPU_POSITIONS,
  FLOATING_KHIPU_THEMES,
  type AiProviderPreference,
  type FloatingKhipuFontSize,
  type FloatingKhipuPosition,
  type FloatingKhipuTheme,
} from "@/types/settings";

const PROVIDER_LABELS: Record<AiProviderPreference, string> = {
  auto: "Automático",
  ollama: "Ollama (local)",
  chatgpt_bridge: "ChatGPT Bridge",
  openai: "OpenAI",
  gemini: "Gemini",
  openrouter: "OpenRouter",
};

const POSITION_LABELS: Record<FloatingKhipuPosition, string> = {
  "bottom-right": "Inferior derecha",
  "bottom-left": "Inferior izquierda",
  "top-right": "Superior derecha",
  "top-left": "Superior izquierda",
};

const FONT_SIZE_LABELS: Record<FloatingKhipuFontSize, string> = {
  compact: "Compacto",
  normal: "Normal",
  large: "Grande",
};

const THEME_LABELS: Record<FloatingKhipuTheme, string> = {
  light: "Claro",
  dark: "Oscuro",
};

const MIN_W = 320;
const MAX_W = 800;
const MIN_H = 280;
const MAX_H = 700;

type FloatingKhipuCardProps = {
  settings: {
    floatingKhipuProvider: AiProviderPreference;
    floatingKhipuWidth: number;
    floatingKhipuHeight: number;
    floatingKhipuFontSize: FloatingKhipuFontSize;
    floatingKhipuPosition: FloatingKhipuPosition;
    floatingKhipuTheme: FloatingKhipuTheme;
    defaultCurrency: string;
    currencyDecimals: number;
    dateFormat: string;
    appTheme?: "light" | "dark";
    defaultViewMode: string;
    excelShowFieldBorders: boolean;
    excelRowHeight: number;
    defaultIgvRate: number;
    defaultGeneralExpensesRate: number;
    defaultUtilityRate: number;
    defaultSubBudgetNames: string[];
    aiProviderPreference: AiProviderPreference;
  };
  onSaved: (khipuSettings: {
    floatingKhipuProvider: AiProviderPreference;
    floatingKhipuWidth: number;
    floatingKhipuHeight: number;
    floatingKhipuFontSize: FloatingKhipuFontSize;
    floatingKhipuPosition: FloatingKhipuPosition;
    floatingKhipuTheme: FloatingKhipuTheme;
  }) => void;
};

export function FloatingKhipuSettingsCard({
  settings,
  onSaved,
}: FloatingKhipuCardProps) {
  const [provider, setProvider] = useState(settings.floatingKhipuProvider);
  const [width, setWidth] = useState(settings.floatingKhipuWidth);
  const [height, setHeight] = useState(settings.floatingKhipuHeight);
  const [fontSize, setFontSize] = useState(settings.floatingKhipuFontSize);
  const [position, setPosition] = useState(settings.floatingKhipuPosition);
  const [theme, setTheme] = useState(settings.floatingKhipuTheme);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const hasChanges =
    provider !== settings.floatingKhipuProvider ||
    width !== settings.floatingKhipuWidth ||
    height !== settings.floatingKhipuHeight ||
    fontSize !== settings.floatingKhipuFontSize ||
    position !== settings.floatingKhipuPosition ||
    theme !== settings.floatingKhipuTheme;

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Include actual user settings to avoid overwriting them
          defaultCurrency: settings.defaultCurrency,
          currencyDecimals: settings.currencyDecimals,
          dateFormat: settings.dateFormat,
          appTheme: settings.appTheme ?? "light",
          defaultViewMode: settings.defaultViewMode,
          excelShowFieldBorders: settings.excelShowFieldBorders,
          excelRowHeight: settings.excelRowHeight,
          defaultIgvRate: settings.defaultIgvRate,
          defaultGeneralExpensesRate: settings.defaultGeneralExpensesRate,
          defaultUtilityRate: settings.defaultUtilityRate,
          defaultSubBudgetNames: settings.defaultSubBudgetNames,
          aiProviderPreference: settings.aiProviderPreference,
          // Floating Khipu fields
          floatingKhipuProvider: provider,
          floatingKhipuWidth: width,
          floatingKhipuHeight: height,
          floatingKhipuFontSize: fontSize,
          floatingKhipuPosition: position,
          floatingKhipuTheme: theme,
        }),
      });

      if (!response.ok) {
        const body: unknown = await response.json().catch(() => undefined);
        const message =
          typeof body === "object" && body !== null && "error" in body
            ? String((body as { error: string }).error)
            : "No se pudo guardar la configuración.";
        throw new Error(message);
      }

      onSaved({
        floatingKhipuProvider: provider,
        floatingKhipuWidth: width,
        floatingKhipuHeight: height,
        floatingKhipuFontSize: fontSize,
        floatingKhipuPosition: position,
        floatingKhipuTheme: theme,
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error al guardar la configuración.");
    } finally {
      setSaving(false);
    }
  };

  function handleProviderChange(event: SelectValueChangeEvent) {
    setProvider(event.target.value as AiProviderPreference);
  }

  function handleFontSizeChange(event: SelectValueChangeEvent) {
    setFontSize(event.target.value as FloatingKhipuFontSize);
  }

  function handlePositionChange(event: SelectValueChangeEvent) {
    setPosition(event.target.value as FloatingKhipuPosition);
  }

  function handleThemeChange(event: SelectValueChangeEvent) {
    setTheme(event.target.value as FloatingKhipuTheme);
  }

  return (
    <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
      <CardHeader className="rounded-2xl bg-[var(--app-surface-elevated)]">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-[var(--app-primary-muted)] p-2 text-[var(--app-text-strong)]">
            <MonitorSmartphone className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Panel flotante Khipu</CardTitle>
            <CardDescription>
              Configura el proveedor de IA, tamaño, posición y estilo del asistente flotante.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        {/* Provider */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-[var(--app-text-strong)]">Proveedor de IA</label>
          <p className="text-xs text-[var(--app-text-muted)]">Elige qué motor de IA usará el panel flotante Khipu por defecto.</p>
          <Select value={provider} onChange={handleProviderChange}>
            {AI_PROVIDER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {PROVIDER_LABELS[option]}
              </option>
            ))}
          </Select>
        </div>

        {/* Panel size */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-[var(--app-text-strong)]">Tamaño del panel</label>
          <p className="text-xs text-[var(--app-text-muted)]">Define el ancho y alto por defecto del panel flotante (en píxeles).</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--app-text-subtle)]">Ancho ({MIN_W}-{MAX_W}px)</label>
              <input
                type="number"
                className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                value={width}
                min={MIN_W}
                max={MAX_W}
                onChange={(e) => setWidth(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--app-text-subtle)]">Alto ({MIN_H}-{MAX_H}px)</label>
              <input
                type="number"
                className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
                value={height}
                min={MIN_H}
                max={MAX_H}
                onChange={(e) => setHeight(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Font size */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-[var(--app-text-strong)]">Tamaño de fuente</label>
          <p className="text-xs text-[var(--app-text-muted)]">Controla la densidad del texto dentro del panel flotante.</p>
          <Select value={fontSize} onChange={handleFontSizeChange}>
            {FLOATING_KHIPU_FONT_SIZES.map((option) => (
              <option key={option} value={option}>
                {FONT_SIZE_LABELS[option]}
              </option>
            ))}
          </Select>
        </div>

        {/* Position */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-[var(--app-text-strong)]">Posición en pantalla</label>
          <p className="text-xs text-[var(--app-text-muted)]">Elige en qué esquina aparecerá el botón y panel flotante.</p>
          <Select value={position} onChange={handlePositionChange}>
            {FLOATING_KHIPU_POSITIONS.map((option) => (
              <option key={option} value={option}>
                {POSITION_LABELS[option]}
              </option>
            ))}
          </Select>
        </div>

        {/* Theme */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-[var(--app-text-strong)]">Tema</label>
          <p className="text-xs text-[var(--app-text-muted)]">Elige entre tema claro u oscuro para el panel flotante.</p>
          <Select value={theme} onChange={handleThemeChange}>
            {FLOATING_KHIPU_THEMES.map((option) => (
              <option key={option} value={option}>
                {THEME_LABELS[option]}
              </option>
            ))}
          </Select>
        </div>

        {/* Error message */}
        {saveError ? (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-px" />
            <p className="text-sm text-rose-800">{saveError}</p>
          </div>
        ) : null}

        {/* Save button */}
        <Button
          className={cn("w-full gap-2", !hasChanges && "opacity-50")}
          disabled={!hasChanges || saving}
          onClick={() => void handleSave()}
        >
          <Save className="h-4 w-4" />
          {saving ? "Guardando..." : "Guardar configuración"}
        </Button>
      </CardContent>
    </Card>
  );
}

