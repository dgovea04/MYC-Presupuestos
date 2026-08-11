"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, Loader2, Save, AlertTriangle, CheckCircle2, Wifi, RefreshCw, Terminal, XCircle, Cloud, Sparkles, Server, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SkeletonForm } from "@/components/ui/loading";
import { AGENT_MODELS, DEFAULT_AGENT_MODEL, getAgentModelShortLabel, PROVIDER_BADGE, type AgentModelProvider } from "@/lib/ai/agent/models";
import { cn } from "@/lib/utils";

const COST_BADGE_CLASS: Record<string, string> = {
  free: "bg-[var(--app-success)]/10 text-[var(--app-success)]",
  paid: "bg-[var(--app-warning)]/10 text-[var(--app-warning)]",
  local: "bg-[var(--app-success)]/10 text-[var(--app-success)]",
};

const PROVIDER_ICON: Record<
  AgentModelProvider,
  { icon: React.ElementType; label: string }
> = {
  openrouter: { icon: Cloud, label: "Cloud" },
  google: { icon: Sparkles, label: "Google" },
  ollama: { icon: Server, label: "Local" },
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
      <div className="theme-status-info flex items-start gap-3 rounded-2xl border px-4 py-3">
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
        <div>
          <p className="theme-status-info-strong text-sm font-semibold">
            Verificando Ollama...
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--app-text-muted)]">
            Conectando con Ollama y verificando disponibilidad del modelo <code className="rounded bg-[var(--app-bg-strong)] px-1 py-0.5 text-[11px] font-mono">{modelLabel}</code>.
          </p>
        </div>
      </div>
    );
  }

  // Estado: no verificado aún (idle)
  if (reachable === null) {
    return (
      <div className="theme-status-info flex items-start gap-3 rounded-2xl border px-4 py-3">
        <Terminal className="mt-0.5 h-4 w-4 shrink-0 text-[var(--app-text-muted)]" />
        <div className="flex-1">
          <p className="theme-status-info-strong text-sm font-semibold">
            Ollama Local — verificar estado
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--app-text-muted)]">
            Presiona <strong>Verificar</strong> para comprobar que Ollama está corriendo y el modelo <code className="rounded bg-[var(--app-bg-strong)] px-1 py-0.5 text-[11px] font-mono">{modelLabel}</code> está instalado.
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
        <div className="theme-status-success flex items-start gap-3 rounded-2xl border px-4 py-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <p className="theme-status-success-strong text-sm font-semibold">
              Ollama conectado — modelo disponible
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--app-text-muted)]">
              El modelo <code className="rounded bg-[var(--app-bg-strong)] px-1 py-0.5 text-[11px] font-mono">{modelLabel}</code> está instalado y listo para usar con el Khipu Agente.
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium underline-offset-2 transition-colors hover:opacity-80"
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
        <div className="theme-status-warning flex items-start gap-3 rounded-2xl border px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <p className="theme-status-warning-strong text-sm font-semibold">
              Ollama conectado — modelo NO instalado
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--app-text-muted)]">
              El modelo <code className="rounded bg-[var(--app-bg-strong)] px-1 py-0.5 text-[11px] font-mono">{modelLabel}</code> no se encontró en tu instalación de Ollama. Ejecuta <code className="rounded bg-[var(--app-bg-strong)] px-1 py-0.5 text-[11px] font-mono">ollama pull {modelLabel}</code> en tu terminal para descargarlo.
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium underline-offset-2 transition-colors hover:opacity-80"
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
    <div className="theme-status-error flex items-start gap-3 rounded-2xl border px-4 py-3">
      <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">
        <p className="theme-status-error-strong text-sm font-semibold">
          Ollama no disponible
        </p>
        <p className="mt-1 text-xs leading-5 text-[var(--app-text-muted)]">
          {error || "No se pudo conectar con Ollama. Asegúrate de que esté corriendo en http://localhost:11434."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-2 gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reintentar
        </Button>
      </div>
    </div>
  );
}

function ProviderStatusBadge({
  provider,
  configured,
}: {
  provider: "openrouter" | "google";
  configured: boolean;
}) {
  const isGoogle = provider === "google";
  const label = isGoogle ? "Google Gemini API" : "OpenRouter";

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-3",
        configured ? "theme-status-success" : "theme-status-warning",
      )}
    >
      {configured ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <div>
        <p className={cn("text-sm font-semibold", configured ? "theme-status-success-strong" : "theme-status-warning-strong")}>
          {configured
            ? `API key de ${label} configurada`
            : `API key de ${label} no configurada`}
        </p>
        <p className="mt-1 text-xs leading-5 text-[var(--app-text-muted)]">
          {configured
            ? `El Khipu Agente usará tu API key de ${label} para ejecutar tareas.`
            : `Ve a Proveedores Cloud IA para agregar tu API key de ${label}. El Khipu Agente usa ${label} como backend de modelos.`}
        </p>
      </div>
    </div>
  );
}

function InstalledModelsList({ models }: { models: string[] }) {
  return (
    <div className="theme-muted-panel rounded-xl border px-3.5 py-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--app-text-muted)]">
        <Terminal className="h-3 w-3" />
        Modelos instalados en Ollama
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {models.map((m) => (
          <span
            key={m}
            className="rounded-md bg-[var(--app-bg-strong)] px-2 py-0.5 text-[11px] font-mono text-[var(--app-text-muted)]"
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
  const [openrouterConfigured, setOpenrouterConfigured] = useState(false);
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [aiProviderPreference, setAiProviderPreference] = useState("auto");
  const [loading, setLoading] = useState(true);
  const [isModelListExpanded, setIsModelListExpanded] = useState(false);

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
      const preferredAgentModel = typeof data.agentModel === "string" && data.agentModel.trim().length > 0
        ? data.agentModel
        : null;
      const model = preferredAgentModel ?? DEFAULT_AGENT_MODEL;
      setSelectedModel(model);
      setOpenrouterConfigured(data.openrouterConfigured === true);
      setGeminiConfigured(data.geminiConfigured === true);
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Ollama status is checked reactively when the selected model changes.
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
          agentModel: selectedModel,
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

      setSuccessMessage("Configuracion guardada correctamente.");
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error al guardar la configuración.");
    } finally {
      setSaving(false);
    }
  };

  const selectedProvider = selectedModelMeta?.provider ?? "openrouter";

  const featuredModelIds = useMemo(() => {
    const selectedMeta = AGENT_MODELS.find((model) => model.id === selectedModel);
    const candidates = AGENT_MODELS.filter((model) => model.id !== selectedModel);

    const sameProviderAndCost = candidates.filter(
      (model) => model.provider === selectedMeta?.provider && model.cost === selectedMeta?.cost,
    );
    const sameProvider = candidates.filter(
      (model) => model.provider === selectedMeta?.provider && model.cost !== selectedMeta?.cost,
    );
    const sameCost = candidates.filter(
      (model) => model.cost === selectedMeta?.cost && model.provider !== selectedMeta?.provider,
    );

    const ordered = [...sameProviderAndCost, ...sameProvider, ...sameCost, ...candidates];
    const featured = [selectedModel, ...ordered.map((model) => model.id)].slice(0, 3);

    return new Set(featured);
  }, [selectedModel]);

  const visibleModels = useMemo(() => {
    const list = isModelListExpanded
      ? AGENT_MODELS
      : AGENT_MODELS.filter((model) => featuredModelIds.has(model.id));
    const selectedEntry = list.find((model) => model.id === selectedModel);
    if (!selectedEntry) return list;
    const others = list.filter((model) => model.id !== selectedModel);
    return [selectedEntry, ...others];
  }, [isModelListExpanded, featuredModelIds, selectedModel]);

  const collapsedCount = AGENT_MODELS.length - featuredModelIds.size;

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
        {saveError ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{saveError}</p> : null}
        {successMessage ? <p className="theme-status-success theme-status-success-strong rounded-2xl border px-4 py-3 text-sm">{successMessage}</p> : null}

        {loading ? (
          <SkeletonForm
            aria-label="Cargando configuracion de Khipu Agente"
            fieldsPerSection={2}
            sections={2}
          />
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
              <ProviderStatusBadge
                provider={selectedProvider === "google" ? "google" : "openrouter"}
                configured={selectedProvider === "google" ? geminiConfigured : openrouterConfigured}
              />
            )}

            {/* Selector de modelo */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[var(--app-text-strong)]">
                Modelo por defecto
              </label>
              <p className="text-xs text-[var(--app-text-muted)]">
                Elige qué modelo usará el Khipu Agente. Los modelos Cloud ({`☁️`}) usan OpenRouter o Google Gemini (requieren API key). Los modelos Local ({`🏠`}) usan Ollama en tu máquina, sin costo ni límites.
              </p>

              <div className="mt-3 grid gap-2">
                {visibleModels.map((model) => {
                  const isSelected = selectedModel === model.id;
                  const ProviderIcon = PROVIDER_ICON[model.provider].icon;

                  return (
                    <button
                      key={model.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedModel(model.id)}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all",
                        isSelected
                          ? "border-[var(--app-primary)]/25 bg-[var(--app-primary-muted)] ring-2 ring-[var(--app-primary)]/10 ring-offset-1"
                          : "border-[var(--app-border)] bg-[var(--app-surface)] hover:border-[var(--app-border-strong)] hover:shadow-sm",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                          isSelected
                            ? "bg-[var(--app-primary)] text-[var(--app-primary-foreground)]"
                            : "bg-[var(--app-bg-strong)] text-[var(--app-text-muted)]",
                        )}
                        aria-label={PROVIDER_ICON[model.provider].label}
                      >
                        <ProviderIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className={cn(
                            "text-sm font-semibold",
                            isSelected ? "text-[var(--app-primary)]" : "text-[var(--app-text-strong)]",
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
                        <p className="mt-0.5 text-xs leading-5 text-[var(--app-text-muted)]">
                          {model.description}
                        </p>
                        <p className="mt-0.5 text-[11px] font-mono text-[var(--app-text-subtle)]">
                          {getAgentModelShortLabel(model.id)}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--app-primary)] text-[var(--app-primary-foreground)]">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              {collapsedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setIsModelListExpanded((current) => !current)}
                  className="theme-dashed-panel mt-2 w-full rounded-xl border border-dashed px-4 py-2 text-xs font-medium text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-elevated)] hover:text-[var(--app-text-strong)]"
                >
                  {isModelListExpanded ? "Ver menos modelos" : `Ver ${collapsedCount} modelo${collapsedCount === 1 ? "" : "s"} más`}
                </button>
              )}
            </div>

            {/* Información adicional */}
            <div className="theme-muted-panel flex items-start gap-3 rounded-2xl border px-4 py-3">
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
