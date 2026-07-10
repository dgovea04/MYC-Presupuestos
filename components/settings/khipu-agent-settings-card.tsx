"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Loader2, Save, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AGENT_MODELS, DEFAULT_AGENT_MODEL, getAgentModelLabel, getAgentModelCostEmoji, getAgentModelShortLabel } from "@/lib/ai/agent/models";
import { cn } from "@/lib/utils";

const COST_BADGE_CLASS: Record<string, string> = {
  free: "bg-emerald-100 text-emerald-700",
  paid: "bg-amber-100 text-amber-800",
};

export function KhipuAgentSettingsCard() {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedModel, setSelectedModel] = useState(DEFAULT_AGENT_MODEL);
  const [configured, setConfigured] = useState(false);
  const [aiProviderPreference, setAiProviderPreference] = useState("auto");
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/settings/ai-provider");
      if (!response.ok) return;

      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object") return;

      const data = payload as Record<string, unknown>;
      const model = typeof data.openrouterModel === "string" && data.openrouterModel.trim().length > 0
        ? data.openrouterModel
        : DEFAULT_AGENT_MODEL;
      setSelectedModel(model);
      setConfigured(data.openrouterConfigured === true);
      if (typeof data.aiProviderPreference === "string") {
        setAiProviderPreference(data.aiProviderPreference);
      }
    } catch {
      // Silently keep defaults
    } finally {
      setLoading(false);
    }
  }, []);

  // Load settings on mount
  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadSettings();
    }, 0);
    return () => clearTimeout(timeout);
  }, [loadSettings]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    setSuccessMessage("");

    try {
      // Guardar el modelo usando el endpoint de ai-provider
      const response = await fetch("/api/settings/ai-provider", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openrouterModel: selectedModel,
          aiProviderPreference,
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

      setSuccessMessage("Modelo guardado correctamente.");
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error al guardar la configuración.");
    } finally {
      setSaving(false);
    }
  };

  const selectedModelMeta = AGENT_MODELS.find((m) => m.id === selectedModel);
  const costBadgeClass = selectedModelMeta ? COST_BADGE_CLASS[selectedModelMeta.cost] : COST_BADGE_CLASS.free;

  return (
    <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
      <CardHeader className="rounded-2xl bg-[var(--app-surface-elevated)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-[var(--app-primary-muted)] p-2 text-[var(--app-text-strong)]">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Khipu Agente</CardTitle>
              <CardDescription>
                Configura el modelo de IA que usa el Khipu Agente para crear presupuestos, revisar APU, generar cronogramas y más.
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || loading}
              className="gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--app-text-subtle)]" />
          </div>
        ) : (
          <>
            {/* Estado de API key */}
            <div className={cn(
              "flex items-start gap-3 rounded-2xl border px-4 py-3",
              configured
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50",
            )}>
              {configured ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              )}
              <div>
                <p className={cn(
                  "text-sm font-semibold",
                  configured ? "text-emerald-800" : "text-amber-800",
                )}>
                  {configured ? "API key de OpenRouter configurada" : "API key de OpenRouter no configurada"}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--app-text-muted)]">
                  {configured
                    ? "El Khipu Agente usará tu API key de OpenRouter para ejecutar tareas."
                    : "Ve a Proveedores Cloud IA para agregar tu API key de OpenRouter. El Khipu Agente usa OpenRouter como backend de modelos."
                  }
                </p>
              </div>
            </div>

            {/* Selector de modelo */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[var(--app-text-strong)]">
                Modelo por defecto
              </label>
              <p className="text-xs text-[var(--app-text-muted)]">
                Elige qué modelo usará el Khipu Agente para sus tareas. Los modelos gratuitos ({`🆓`}) no tienen costo, los de pago ({`💲`}) consumen créditos de tu API key.
              </p>

              <div className="mt-3 grid gap-2">
                {AGENT_MODELS.map((model) => {
                  const isSelected = selectedModel === model.id;
                  const costEmoji = getAgentModelCostEmoji(model.id);

                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => setSelectedModel(model.id)}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all",
                        isSelected
                          ? "border-blue-300 bg-blue-50 ring-2 ring-blue-200/50 ring-offset-1"
                          : "border-[var(--app-border)] bg-[var(--app-surface)] hover:border-slate-300 hover:shadow-sm",
                      )}
                    >
                      <div className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm",
                        isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500",
                      )}>
                        {costEmoji || "🤖"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className={cn(
                            "text-sm font-semibold",
                            isSelected ? "text-blue-800" : "text-slate-800",
                          )}>
                            {model.label}
                          </p>
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            COST_BADGE_CLASS[model.cost],
                          )}>
                            {model.cost === "free" ? "Gratis" : "Pago"}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs leading-5 text-slate-500">
                          {model.description}
                        </p>
                        <p className="mt-0.5 text-[11px] font-mono text-slate-400">
                          {getAgentModelShortLabel(model.id)}
                        </p>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Información adicional */}
            <div className="flex items-start gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3">
              <Bot className="mt-0.5 h-4 w-4 shrink-0 text-[var(--app-text-muted)]" />
              <div>
                <p className="text-sm font-medium text-[var(--app-text-strong)]">
                  ¿Cómo funciona?
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--app-text-muted)]">
                  El Khipu Agente usa herramientas especializadas para interactuar con tus presupuestos, APU, partidas e insumos.
                  Ejecuta tareas como crear presupuestos, calcular APU, generar cronogramas y exportar reportes.
                  El modelo seleccionado se usa como motor de razonamiento para planificar y ejecutar estas tareas.
                </p>
              </div>
            </div>

            {/* Mensajes de estado */}
            {saveError ? (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-px" />
                <p className="text-sm text-rose-800">{saveError}</p>
              </div>
            ) : null}
            {successMessage ? (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {successMessage}
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
