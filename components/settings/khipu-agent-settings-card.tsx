"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Loader2, Save, AlertTriangle, CheckCircle2, Wifi, RefreshCw, Terminal, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AGENT_MODELS, DEFAULT_AGENT_MODEL, getAgentModelLabel, getAgentModelCostEmoji, getAgentModelShortLabel, PROVIDER_BADGE } from "@/lib/ai/agent/models";
import { cn } from "@/lib/utils";

const COST_BADGE_CLASS: Record<string, string> = {
  free: "bg-emerald-100 text-emerald-700",
  paid: "bg-amber-100 text-amber-800",
  local: "bg-emerald-100 text-emerald-700",
};

const COST_LABEL: Record<string, string> = {
  free: "Gratis",
  paid: "Pago",
  local: "Local",
};

// ─── Ollama Status Banner ────────────────────────────────────────────────────

type OllamaStatusBannerProps = {
  checking: boolean;
  reachable: boolean | null;
  modelAvailable: boolean | null;
  installedModels: string[];
  modelLabel: string;
  error: string;
  onRetry: () => void;
};

function OllamaStatusBanner({
  checking,
  reachable,
  modelAvailable,
  installedModels,
  modelLabel,
  error,
  onRetry,
}: OllamaStatusBannerProps) {
  // Estado: verificando
  if (checking) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-slate-500" />
        <div>
          <p className="text-sm font-semibold text-slate-700">
            Verificando Ollama...
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--app-text-muted)]">
            Conectando con Ollama y verificando disponibilidad del modelo <code className="rounded bg-slate-200 px-1 py-0.5 text-[11px] font-mono">{modelLabel}</code>.
          </p>
        </div>
      </div>
    );
  }

  // Estado: no verificado aún (idle)
  if (reachable === null) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <Terminal className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-700">
            Ollama Local — verificar estado
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--app-text-muted)]">
            Presiona <strong>Verificar</strong> para comprobar que Ollama está corriendo y el modelo <code className="rounded bg-slate-200 px-1 py-0.5 text-[11px] font-mono">{modelLabel}</code> está instalado.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="mt-2 gap-1.5"
          >
            <Wifi className="h-3.5 w-3.5" />
            Verificar
          </Button>
        </div>
      </div>
    );
  }

  // Estado: reachable y modelo disponible
  if (reachable && modelAvailable) {
    return (
      <div className="space-y-2.5">
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-800">
              Ollama conectado — modelo disponible
            </p>
            <p className="mt-1 text-xs leading-5 text-emerald-700">
              El modelo <code className="rounded bg-emerald-100 px-1 py-0.5 text-[11px] font-mono">{modelLabel}</code> está instalado y listo para usar con el Khipu Agente.
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Volver a verificar
            </button>
          </div>
        </div>
        {installedModels.length > 0 && (
          <InstalledModelsList models={installedModels} />
        )}
      </div>
    );
  }

  // Estado: reachable pero modelo no instalado
  if (reachable && modelAvailable === false) {
    return (
      <div className="space-y-2.5">
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              Ollama conectado — modelo NO instalado
            </p>
            <p className="mt-1 text-xs leading-5 text-amber-700">
              El modelo <code className="rounded bg-amber-100 px-1 py-0.5 text-[11px] font-mono">{modelLabel}</code> no se encontró en tu instalación de Ollama. Ejecuta <code className="rounded bg-amber-100 px-1 py-0.5 text-[11px] font-mono">ollama pull {modelLabel}</code> en tu terminal para descargarlo.
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-900 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Verificar de nuevo
            </button>
          </div>
        </div>
        {installedModels.length > 0 && (
          <InstalledModelsList models={installedModels} />
        )}
      </div>
    );
  }

  // Estado: no reachable
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-rose-800">
          Ollama no disponible
        </p>
        <p className="mt-1 text-xs leading-5 text-rose-700">
          {error || "No se pudo conectar con Ollama. Asegúrate de que esté corriendo en http://localhost:11434."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-2 gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-100"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reintentar
        </Button>
      </div>
    </div>
  );
}

function InstalledModelsList({ models }: { models: string[] }) {
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3.5 py-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--app-text-muted)]">
        <Terminal className="h-3 w-3" />
        Modelos instalados en Ollama
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {models.map((m) => (
          <span
            key={m}
            className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-600"
          >
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main Card ───────────────────────────────────────────────────────────────

export function KhipuAgentSettingsCard() {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedModel, setSelectedModel] = useState(DEFAULT_AGENT_MODEL);
  const [configured, setConfigured] = useState(false);
  const [aiProviderPreference, setAiProviderPreference] = useState("auto");
  const [loading, setLoading] = useState(true);

  // ── Ollama health check state ───────────────────────────────────────────
  const [ollamaChecking, setOllamaChecking] = useState(false);
  const [ollamaReachable, setOllamaReachable] = useState<boolean | null>(null);
  const [ollamaInstalledModels, setOllamaInstalledModels] = useState<string[]>([]);
  const [ollamaModelAvailable, setOllamaModelAvailable] = useState<boolean | null>(null);
  const [ollamaCheckError, setOllamaCheckError] = useState("");

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

  // ── Ollama health check ────────────────────────────────────────────────
  const checkOllamaStatus = useCallback(async (modelId: string) => {
    setOllamaChecking(true);
    setOllamaCheckError("");
    setOllamaReachable(null);
    setOllamaModelAvailable(null);
    setOllamaInstalledModels([]);

    try {
      // Extraer nombre del modelo: "ollama/qwen2.5:14b" → "qwen2.5:14b"
      const modelName = modelId.split("/").slice(1).join("/");

      const response = await fetch(
        `/api/ai/ollama-check?model=${encodeURIComponent(modelName)}`,
      );

      if (!response.ok) {
        setOllamaReachable(false);
        setOllamaCheckError("Error al verificar Ollama. Intenta de nuevo.");
        return;
      }

      const data: {
        reachable: boolean;
        installedModels: string[];
        modelAvailable: boolean;
        checkedModel: string | null;
        error: string | null;
      } = await response.json();

      setOllamaReachable(data.reachable);
      setOllamaInstalledModels(data.installedModels);
      setOllamaModelAvailable(data.modelAvailable);
      if (data.error) {
        setOllamaCheckError(data.error);
      }
    } catch {
      setOllamaReachable(false);
      setOllamaCheckError("No se pudo conectar con el servidor. Verifica tu conexión.");
    } finally {
      setOllamaChecking(false);
    }
  }, []);

  // Auto-check Ollama when switching to an Ollama model
  const selectedModelMeta = AGENT_MODELS.find((m) => m.id === selectedModel);
  const isOllamaModel = selectedModelMeta?.provider === "ollama";

  useEffect(() => {
    if (isOllamaModel) {
      void checkOllamaStatus(selectedModel);
    } else {
      // Reset Ollama state when switching to non-Ollama model
      setOllamaReachable(null);
      setOllamaModelAvailable(null);
      setOllamaInstalledModels([]);
      setOllamaCheckError("");
    }
  }, [selectedModel, isOllamaModel, checkOllamaStatus]);

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
            {/* Estado del proveedor */}
            {isOllamaModel ? (
              <OllamaStatusBanner
                checking={ollamaChecking}
                reachable={ollamaReachable}
                modelAvailable={ollamaModelAvailable}
                installedModels={ollamaInstalledModels}
                modelLabel={getAgentModelShortLabel(selectedModel)}
                error={ollamaCheckError}
                onRetry={() => void checkOllamaStatus(selectedModel)}
              />
            ) : (
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
            )}

            {/* Selector de modelo */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[var(--app-text-strong)]">
                Modelo por defecto
              </label>
              <p className="text-xs text-[var(--app-text-muted)]">
                Elige qué modelo usará el Khipu Agente. Los modelos Cloud ({`☁️`}) usan OpenRouter (requiere API key). Los modelos Local ({`🏠`}) usan Ollama en tu máquina, sin costo ni límites.
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
                            {COST_LABEL[model.cost] ?? model.cost}
                          </span>
                          {model.provider && (
                            <span className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              PROVIDER_BADGE[model.provider].className,
                            )}>
                              {PROVIDER_BADGE[model.provider].label}
                            </span>
                          )}
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
