"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { BotMessageSquare, CheckCircle2, Cpu, RefreshCw, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AiAction = "chat" | "apu" | "review" | "autocomplete" | "json";
type AiProviderId = "ollama" | "openai" | "gemini" | "chatgpt_bridge" | "openrouter";
type KhipuAiTask =
  | "review_apu"
  | "generate_apu"
  | "suggest_insumos"
  | "review_budget"
  | "generate_partida"
  | "review_formula_polinomica"
  | "review_quantity_takeoff"
  | "montecarlo_risk_analysis"
  | "chat"
  | "autocomplete";

type AiHealth = {
  status: "ok" | "degraded" | "down";
  ollamaReachable: boolean;
  availableModels: string[];
  requiredModels: Array<{
    model: string;
    installed: boolean;
    actions: AiAction[];
  }>;
  actions: Record<
    AiAction,
    {
      model: string;
      requestedModel: string;
      fallbackUsed: boolean;
      warnings: string[];
    }
  >;
  metrics: Record<
    AiAction,
    {
      latencyMs: number | null;
      lastError: string | null;
    }
  >;
  providers: Record<
    AiProviderId,
    {
      configured: boolean;
      reachable: boolean | null;
    }
  >;
  routing: Record<KhipuAiTask, AiProviderId[]>;
};

const AI_HISTORY_STORAGE_KEY = "myc-ai-session-history";

const ACTION_LABELS: Record<AiAction, string> = {
  chat: "Chat tecnico",
  apu: "Generar APU",
  review: "Revisar presupuesto",
  autocomplete: "Autocompletar",
  json: "JSON estructurado",
};

const PROVIDER_LABELS: Record<AiProviderId, string> = {
  ollama: "Ollama",
  openai: "OpenAI",
  gemini: "Gemini",
  chatgpt_bridge: "ChatGPT Bridge",
  openrouter: "OpenRouter",
};

const TASK_LABELS: Record<KhipuAiTask, string> = {
  review_apu: "Revision APU",
  generate_apu: "Generacion APU",
  suggest_insumos: "Sugerencia de insumos",
  review_budget: "Revision de presupuesto",
  generate_partida: "Generacion de partida",
  review_formula_polinomica: "Formula polinomica",
  review_quantity_takeoff: "Revision de metrados",
  montecarlo_risk_analysis: "Riesgo Monte Carlo",
  chat: "Chat tecnico",
  autocomplete: "Autocompletar",
};

const CONTEXT_SOURCES = ["Proyecto actual", "Módulo abierto", "Partida seleccionada", "Unidad", "Costo actual", "Tabla activa"] as const;

const FUTURE_CAPABILITIES = ["Streaming de respuestas", "RAG con normativa peruana", "Catalogos S10", "Memoria por proyecto", "DeepSeek para parsing avanzado"] as const;

export function LocalAiSettingsCard() {
  const [health, setHealth] = useState<AiHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [historyCleared, setHistoryCleared] = useState(false);

  useEffect(() => {
    void loadHealth();
  }, []);

  const statusCopy = useMemo(() => {
    if (!health) return { label: "Sin verificar", tone: "slate" as const };
    if (health.status === "ok") return { label: "Operativo", tone: "emerald" as const };
    if (health.status === "degraded") return { label: "Con fallback", tone: "amber" as const };
    return { label: "Ollama no disponible", tone: "rose" as const };
  }, [health]);

  async function loadHealth() {
    setLoading(true);
    setError("");
    setHistoryCleared(false);

    try {
      const response = await fetch("/api/ai/health");
      const payload = await readResponsePayload(response);

      if (!response.ok) {
        throw new Error(readErrorMessage(payload));
      }

      setHealth(readAiHealth(payload));
    } catch (caughtError) {
      setHealth(null);
      setError(caughtError instanceof Error ? caughtError.message : "No se pudo consultar el estado de IA local.");
    } finally {
      setLoading(false);
    }
  }

  function clearLocalAiHistory() {
    window.localStorage.removeItem(AI_HISTORY_STORAGE_KEY);
    setHistoryCleared(true);
  }

  return (
    <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-[var(--app-primary-muted)] p-2 text-[var(--app-text-strong)]">
              <BotMessageSquare className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Integracion de IA Local</CardTitle>
              <CardDescription>
                Diagnostico de Ollama, modelos requeridos y reglas de uso seguro para MC Presupuestos.
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label={statusCopy.label} tone={statusCopy.tone} />
            <Button type="button" variant="outline" onClick={() => void loadHealth()} disabled={loading} className="gap-2">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Verificar conexion
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
        {historyCleared ? <p className="theme-status-success theme-status-success-strong rounded-2xl border px-4 py-3 text-sm">Historial local eliminado.</p> : null}

        <div className="grid gap-3 md:grid-cols-3">
          <AiInfoCard label="Proveedor" value="Ollama local" detail="http://localhost:11434" />
          <AiInfoCard label="Conexion" value={health?.ollamaReachable ? "Conectado" : "Pendiente"} detail={health ? "Ultima verificacion completada" : "Ejecuta una verificacion"} />
          <AiInfoCard label="Modelos detectados" value={String(health?.availableModels.length ?? 0)} detail={health?.availableModels.join(", ") || "Ejecuta una verificacion"} />
        </div>

        <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Panel title="Modelos requeridos" description="Instala los modelos faltantes para evitar degradacion o errores funcionales.">
            <div className="space-y-2">
              {(health?.requiredModels ?? defaultRequiredModels()).map((model) => (
                <div key={model.model} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
                  <div>
                    <p className="font-medium text-[var(--app-text-strong)]">{model.model}</p>
                    <p className="text-xs text-[var(--app-text-muted)]">{model.actions.length ? model.actions.map(readActionLabel).join(" · ") : "Preparado para parsing/codigo"}</p>
                  </div>
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", model.installed ? "theme-status-success theme-status-success-strong" : "theme-status-warning theme-status-warning-strong")}>
                    {model.installed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {model.installed ? "Instalado" : `ollama pull ${model.model}`}
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Ruteo y fallback" description="Modelo configurado por accion y ultimo estado operativo local.">
            <div className="grid gap-2">
              {(Object.keys(ACTION_LABELS) as AiAction[]).map((action) => {
                const resolution = health?.actions[action];
                const metric = health?.metrics[action];

                return (
                  <div key={action} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-[var(--app-text-strong)]">{ACTION_LABELS[action]}</p>
                        <p className="text-xs text-[var(--app-text-muted)]">
                          Solicitado: {resolution?.requestedModel ?? "-"} · Usando: {resolution?.model ?? "-"}
                        </p>
                      </div>
                      {resolution?.fallbackUsed ? <StatusPill label="Fallback" tone="amber" /> : <StatusPill label="Directo" tone="emerald" />}
                    </div>
                    <p className="mt-2 text-xs text-[var(--app-text-muted)]">
                      Latencia: {typeof metric?.latencyMs === "number" ? `${metric.latencyMs} ms` : "sin ejecuciones"} · Ultimo error: {metric?.lastError ?? "ninguno"}
                    </p>
                    {resolution?.warnings.length ? <p className="theme-status-warning-strong mt-2 text-xs">{resolution.warnings.join(" ")}</p> : null}
                  </div>
                );
              })}
            </div>
          </Panel>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Panel title="Proveedores V2" description="Estado de configuracion para cada motor disponible.">
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(PROVIDER_LABELS) as AiProviderId[]).map((provider) => {
                const providerHealth = health?.providers[provider];
                const status =
                  providerHealth?.reachable === true
                    ? "Alcanzable"
                    : providerHealth?.configured
                      ? "Configurado"
                      : "Pendiente";

                return (
                  <div key={provider} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
                    <p className="font-medium text-[var(--app-text-strong)]">{PROVIDER_LABELS[provider]}</p>
                    <p className="mt-1 text-xs text-[var(--app-text-muted)]">{status}</p>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Rutas Khipu V2" description="Cadena de fallback usada cuando el proveedor esta en automatico.">
            <div className="grid gap-2 md:grid-cols-2">
              {(Object.keys(TASK_LABELS) as KhipuAiTask[]).map((task) => (
                <div key={task} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
                  <p className="font-medium text-[var(--app-text-strong)]">{TASK_LABELS[task]}</p>
                  <p className="mt-1 text-xs text-[var(--app-text-muted)]">{(health?.routing[task] ?? []).join(" -> ") || "Sin ruta"}</p>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Panel title="Seguridad" description="Reglas fijas de la integracion local.">
            <div className="space-y-2 text-sm text-[var(--app-text-muted)]">
              <SafetyRow text="La IA nunca modifica presupuestos automaticamente." />
              <SafetyRow text="Toda sugerencia aplicada requiere confirmacion humana." />
              <SafetyRow text="No se envian datos a servicios externos en esta fase." />
            </div>
          </Panel>

          <Panel title="Contexto de Khipu" description="Datos que se comparten para mejorar respuestas.">
            <div className="flex flex-wrap gap-2">
              {CONTEXT_SOURCES.map((source) => (
                <span key={source} className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-1 text-xs font-medium text-[var(--app-text-muted)]">
                  {source}
                </span>
              ))}
            </div>
          </Panel>

          <Panel title="Historial local" description="Solo se guarda en este navegador para continuidad y depuracion.">
            <div className="space-y-3">
              <Button type="button" variant="outline" className="w-full gap-2" onClick={clearLocalAiHistory}>
                <Trash2 className="h-4 w-4" />
                Limpiar historial IA
              </Button>
            </div>
          </Panel>
        </section>

        <Panel title="Capacidades preparadas" description="Hoja de ruta tecnica para extender IA local sin enviar datos a servicios externos.">
          <div className="flex flex-wrap gap-2">
            {FUTURE_CAPABILITIES.map((capability) => (
              <span key={capability} className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-1 text-xs font-medium text-[var(--app-text-strong)]">
                {capability}
              </span>
            ))}
          </div>
        </Panel>
      </CardContent>
    </Card>
  );
}

function AiInfoCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-text-subtle)]">{label}</p>
      <p className="mt-2 text-lg font-semibold text-[var(--app-text-strong)]">{value}</p>
      <p className="mt-1 truncate text-xs text-[var(--app-text-muted)]">{detail}</p>
    </div>
  );
}

function Panel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4">
      <div className="mb-3">
        <p className="font-semibold text-[var(--app-text-strong)]">{title}</p>
        <p className="mt-1 text-sm text-[var(--app-text-muted)]">{description}</p>
      </div>
      {children}
    </div>
  );
}

function SafetyRow({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
      <span>{text}</span>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "slate" | "emerald" | "amber" | "rose" }) {
  const toneClassName =
    tone === "emerald"
      ? "theme-status-success theme-status-success-strong"
      : tone === "amber"
        ? "theme-status-warning theme-status-warning-strong"
        : tone === "rose"
          ? "bg-rose-100 text-rose-700"
          : "theme-muted-panel theme-muted-text";

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold", toneClassName)}>
      <Cpu className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function readActionLabel(action: AiAction) {
  return ACTION_LABELS[action];
}

function defaultRequiredModels() {
  return [
    { model: "llama3.1", installed: false, actions: ["chat", "review", "apu", "autocomplete"] as AiAction[] },
    { model: "mistral", installed: false, actions: ["apu", "autocomplete"] as AiAction[] },
    { model: "qwen2.5-coder:7b", installed: false, actions: ["json"] as AiAction[] },
    { model: "deepseek-coder", installed: false, actions: ["json"] as AiAction[] },
  ];
}

function readAiHealth(payload: unknown): AiHealth {
  if (!isRecord(payload) || !Array.isArray(payload.availableModels) || !Array.isArray(payload.requiredModels) || !isRecord(payload.actions) || !isRecord(payload.metrics)) {
    throw new Error("La respuesta de salud IA no tiene el formato esperado.");
  }

  return {
    status: payload.status === "ok" || payload.status === "degraded" || payload.status === "down" ? payload.status : "down",
    ollamaReachable: payload.ollamaReachable === true,
    availableModels: payload.availableModels.filter((model): model is string => typeof model === "string"),
    requiredModels: payload.requiredModels.filter(isRequiredModel),
    actions: {
      chat: readActionResolution(payload.actions.chat),
      apu: readActionResolution(payload.actions.apu),
      review: readActionResolution(payload.actions.review),
      autocomplete: readActionResolution(payload.actions.autocomplete),
      json: readActionResolution(payload.actions.json),
    },
    metrics: {
      chat: readMetric(payload.metrics.chat),
      apu: readMetric(payload.metrics.apu),
      review: readMetric(payload.metrics.review),
      autocomplete: readMetric(payload.metrics.autocomplete),
      json: readMetric(payload.metrics.json),
    },
    providers: readProviders(payload.providers),
    routing: readRouting(payload.routing),
  };
}

function readActionResolution(value: unknown) {
  if (!isRecord(value)) return { model: "", requestedModel: "", fallbackUsed: false, warnings: [] };

  return {
    model: typeof value.model === "string" ? value.model : "",
    requestedModel: typeof value.requestedModel === "string" ? value.requestedModel : "",
    fallbackUsed: value.fallbackUsed === true,
    warnings: Array.isArray(value.warnings) ? value.warnings.filter((warning): warning is string => typeof warning === "string") : [],
  };
}

function readMetric(value: unknown) {
  if (!isRecord(value)) return { latencyMs: null, lastError: null };

  return {
    latencyMs: typeof value.latencyMs === "number" ? value.latencyMs : null,
    lastError: typeof value.lastError === "string" ? value.lastError : null,
  };
}

function readProviders(value: unknown): AiHealth["providers"] {
  const providers = isRecord(value) ? value : {};

  return {
    ollama: readProviderHealth(providers.ollama, true, null),
    openai: readProviderHealth(providers.openai, false, null),
    gemini: readProviderHealth(providers.gemini, false, null),
    chatgpt_bridge: readProviderHealth(providers.chatgpt_bridge, true, null),
    openrouter: readProviderHealth(providers.openrouter, false, null),
  };
}

function readProviderHealth(value: unknown, configuredFallback: boolean, reachableFallback: boolean | null) {
  if (!isRecord(value)) {
    return { configured: configuredFallback, reachable: reachableFallback };
  }

  return {
    configured: value.configured === true,
    reachable: typeof value.reachable === "boolean" ? value.reachable : null,
  };
}

function readRouting(value: unknown): AiHealth["routing"] {
  const routing = isRecord(value) ? value : {};

  return {
    review_apu: readProviderChain(routing.review_apu),
    generate_apu: readProviderChain(routing.generate_apu),
    suggest_insumos: readProviderChain(routing.suggest_insumos),
    review_budget: readProviderChain(routing.review_budget),
    generate_partida: readProviderChain(routing.generate_partida),
    review_formula_polinomica: readProviderChain(routing.review_formula_polinomica),
    review_quantity_takeoff: readProviderChain(routing.review_quantity_takeoff),
    montecarlo_risk_analysis: readProviderChain(routing.montecarlo_risk_analysis),
    chat: readProviderChain(routing.chat),
    autocomplete: readProviderChain(routing.autocomplete),
  };
}

function readProviderChain(value: unknown): AiProviderId[] {
  return Array.isArray(value) ? value.filter(isAiProviderId) : [];
}

function isRequiredModel(value: unknown): value is AiHealth["requiredModels"][number] {
  return (
    isRecord(value) &&
    typeof value.model === "string" &&
    typeof value.installed === "boolean" &&
    Array.isArray(value.actions) &&
    value.actions.every(isAiAction)
  );
}

function isAiAction(value: unknown): value is AiAction {
  return value === "chat" || value === "apu" || value === "review" || value === "autocomplete" || value === "json";
}

function isAiProviderId(value: unknown): value is AiProviderId {
  return value === "ollama" || value === "openai" || value === "gemini" || value === "chatgpt_bridge" || value === "openrouter";
}

function readErrorMessage(payload: unknown) {
  if (!isRecord(payload)) return "No se pudo consultar el estado de IA local.";
  if (typeof payload.error === "string") return payload.error;
  if (typeof payload.message === "string") return payload.message;
  return "No se pudo consultar el estado de IA local.";
}

async function readResponsePayload(response: Response): Promise<unknown> {
  try {
    if (typeof response.text !== "function") {
      return await response.json();
    }

    const text = await response.text();

    if (!text.trim()) {
      return {};
    }

    if (text.trimStart().startsWith("<")) {
      if (response.status === 404) {
        return {
          error: "No se encontro /api/ai/health en el servidor activo. Reinicia npm.cmd run dev para cargar las rutas de IA local.",
        };
      }

      return { error: "No se pudo consultar el estado de IA local. Respuesta no valida del servidor." };
    }

    return JSON.parse(text) as unknown;
  } catch {
    return { error: "No se pudo consultar el estado de IA local. Respuesta no valida del servidor." };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

