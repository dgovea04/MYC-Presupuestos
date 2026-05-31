"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { BotMessageSquare, CheckCircle2, Cpu, RefreshCw, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AiAction = "chat" | "apu" | "review" | "autocomplete" | "json";

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
};

const AI_HISTORY_STORAGE_KEY = "myc-ai-session-history";

const ACTION_LABELS: Record<AiAction, string> = {
  chat: "Chat tecnico",
  apu: "Generar APU",
  review: "Revisar presupuesto",
  autocomplete: "Autocompletar",
  json: "JSON estructurado",
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
    <Card className="border-sky-100 bg-[linear-gradient(135deg,#ffffff_0%,#f4fbff_48%,#eff6ff_100%)]">
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-sky-100 p-2 text-sky-700">
              <BotMessageSquare className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Integracion de IA Local</CardTitle>
              <CardDescription>
                Diagnostico de Ollama, modelos requeridos y reglas de uso seguro para MYC Presupuestos.
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

        <div className="grid gap-3 md:grid-cols-3">
          <AiInfoCard label="Proveedor" value="Ollama local" detail="http://localhost:11434" />
          <AiInfoCard label="Conexion" value={health?.ollamaReachable ? "Conectado" : "Pendiente"} detail={health ? "Ultima verificacion completada" : "Ejecuta una verificacion"} />
          <AiInfoCard label="Modelos detectados" value={String(health?.availableModels.length ?? 0)} detail={health?.availableModels.join(", ") || "Ejecuta una verificacion"} />
        </div>

        <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Panel title="Modelos requeridos" description="Instala los modelos faltantes para evitar degradacion o errores funcionales.">
            <div className="space-y-2">
              {(health?.requiredModels ?? defaultRequiredModels()).map((model) => (
                <div key={model.model} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div>
                    <p className="font-medium text-slate-900">{model.model}</p>
                    <p className="text-xs text-slate-500">{model.actions.length ? model.actions.map(readActionLabel).join(" · ") : "Preparado para parsing/codigo"}</p>
                  </div>
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", model.installed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
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
                  <div key={action} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{ACTION_LABELS[action]}</p>
                        <p className="text-xs text-slate-500">
                          Solicitado: {resolution?.requestedModel ?? "-"} · Usando: {resolution?.model ?? "-"}
                        </p>
                      </div>
                      {resolution?.fallbackUsed ? <StatusPill label="Fallback" tone="amber" /> : <StatusPill label="Directo" tone="emerald" />}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Latencia: {typeof metric?.latencyMs === "number" ? `${metric.latencyMs} ms` : "sin ejecuciones"} · Ultimo error: {metric?.lastError ?? "ninguno"}
                    </p>
                    {resolution?.warnings.length ? <p className="mt-2 text-xs text-amber-700">{resolution.warnings.join(" ")}</p> : null}
                  </div>
                );
              })}
            </div>
          </Panel>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Panel title="Seguridad" description="Reglas fijas de la integracion local.">
            <div className="space-y-2 text-sm text-slate-600">
              <SafetyRow text="La IA nunca modifica presupuestos automaticamente." />
              <SafetyRow text="Toda sugerencia aplicada requiere confirmacion humana." />
              <SafetyRow text="No se envian datos a servicios externos en esta fase." />
            </div>
          </Panel>

          <Panel title="Contexto del copiloto" description="Datos que se comparten para mejorar respuestas.">
            <div className="flex flex-wrap gap-2">
              {CONTEXT_SOURCES.map((source) => (
                <span key={source} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
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
              {historyCleared ? <p className="text-sm text-emerald-700">Historial local eliminado.</p> : null}
            </div>
          </Panel>
        </section>

        <Panel title="Capacidades preparadas" description="Hoja de ruta tecnica para extender IA local sin enviar datos a servicios externos.">
          <div className="flex flex-wrap gap-2">
            {FUTURE_CAPABILITIES.map((capability) => (
              <span key={capability} className="rounded-full border border-sky-100 bg-white px-3 py-1 text-xs font-medium text-sky-700">
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
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
      <p className="mt-1 truncate text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function Panel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
      <div className="mb-3">
        <p className="font-semibold text-slate-950">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {children}
    </div>
  );
}

function SafetyRow({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      <span>{text}</span>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "slate" | "emerald" | "amber" | "rose" }) {
  const toneClassName =
    tone === "emerald"
      ? "bg-emerald-100 text-emerald-700"
      : tone === "amber"
        ? "bg-amber-100 text-amber-700"
        : tone === "rose"
          ? "bg-rose-100 text-rose-700"
          : "bg-slate-100 text-slate-600";

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
