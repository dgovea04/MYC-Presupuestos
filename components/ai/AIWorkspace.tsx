"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BotMessageSquare,
  CheckCircle2,
  FileSearch,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { AIMessage } from "@/components/ai/AIMessage";
import { ContextSidebar } from "@/components/ai/ContextSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AiApuStructuredData, AiContext, AiEndpointResult, AiReviewStructuredData } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

type AiAction = "chat" | "apu" | "review" | "autocomplete";

type AiResult = AiEndpointResult;

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

type RequestState = {
  action: AiAction;
  payload: Record<string, unknown>;
};

type AiHistoryEntry = {
  id: string;
  action: AiAction;
  summary: string;
  context: AiContext;
  result: AiResult;
  timestamp: string;
};

const AI_HISTORY_STORAGE_KEY = "myc-ai-session-history";

const ACTIONS = [
  {
    id: "chat",
    label: "Chat tecnico",
    description: "Consultas de obra, costos, metrados y formula polinomica.",
    icon: BotMessageSquare,
  },
  {
    id: "apu",
    label: "Generar APU",
    description: "Propuesta inicial con recursos, cuadrilla y rendimiento.",
    icon: Sparkles,
  },
  {
    id: "review",
    label: "Revisar presupuesto",
    description: "Deteccion de duplicados, unidades y costos sospechosos.",
    icon: FileSearch,
  },
  {
    id: "autocomplete",
    label: "Autocompletar",
    description: "Nombres, observaciones y especificaciones tecnicas.",
    icon: WandSparkles,
  },
 ] as const;

export function AIWorkspace({
  initialAction = "chat",
  initialContext = {
    project: "Edificio Multifamiliar",
    module: "APU",
    selectedItem: "Concreto f'c=210",
    unit: "m3",
    currentCost: 420,
    activeTable: "Analisis de precios unitarios",
  },
  initialChatMessage = "Genera recomendaciones para revisar este APU.",
  initialApuDescription = "Concreto armado f'c=210 kg/cm2 para columnas",
  initialApuUnit = "m3",
  initialReviewSummary = "Partida 01.02 Concreto f'c=210 m3 S/ 420. Partida 01.03 Concreto f'c=210 m2 S/ 415.",
  initialAutocompleteInput = "Excavacion manual en",
}: {
  initialAction?: AiAction;
  initialContext?: AiContext;
  initialChatMessage?: string;
  initialApuDescription?: string;
  initialApuUnit?: string;
  initialReviewSummary?: string;
  initialAutocompleteInput?: string;
}) {
  const [activeAction, setActiveAction] = useState<AiAction>(initialAction);
  const [context, setContext] = useState<AiContext>(initialContext);
  const [chatMessage, setChatMessage] = useState(initialChatMessage);
  const [apuDescription, setApuDescription] = useState(initialApuDescription);
  const [apuUnit, setApuUnit] = useState(initialApuUnit);
  const [reviewSummary, setReviewSummary] = useState(initialReviewSummary);
  const [autocompleteInput, setAutocompleteInput] = useState(initialAutocompleteInput);
  const [result, setResult] = useState<AiResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastRequest, setLastRequest] = useState<RequestState | null>(null);
  const [health, setHealth] = useState<AiHealth | null>(null);
  const [history, setHistory] = useState<AiHistoryEntry[]>(() => readStoredHistory());

  useEffect(() => {
    void loadHealth();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(AI_HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 8)));
  }, [history]);

  const activeConfig = ACTIONS.find((action) => action.id === activeAction) ?? ACTIONS[0];
  const ActiveIcon = activeConfig.icon;
  const activeHealth = useMemo(() => (health ? health.actions[activeAction] : null), [activeAction, health]);

  const submitRequest = async (request: RequestState) => {
    setLoading(true);
    setError("");
    setResult(null);
    setLastRequest(request);

    try {
      const response = await fetch(`/api/ai/${request.action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request.payload),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(readErrorMessage(payload));
      }

      const nextResult = readAiResult(payload);
      setResult(nextResult);
      setHistory((current) => [
        {
          id: `${Date.now()}-${request.action}`,
          action: request.action,
          summary: summarizeRequest(request),
          context,
          result: nextResult,
          timestamp: new Date().toISOString(),
        },
        ...current,
      ]);
      void loadHealth();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No se pudo completar la solicitud de IA.");
      void loadHealth();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitRequest(buildRequest(activeAction, context));
  };

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <Card className="overflow-hidden border-sky-100 bg-[linear-gradient(135deg,#ffffff_0%,#f3f9ff_52%,#edf6ff_100%)]">
          <CardContent className="p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl space-y-3">
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                  IA local
                </span>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                    Copiloto tecnico de presupuestos
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-slate-600 md:text-base">
                    Conecta MYC Presupuestos con Ollama local para chat tecnico, APU, revision inteligente y
                    autocompletado sin enviar datos a servicios externos.
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-sm text-slate-600 shadow-sm">
                <p className="font-semibold text-slate-900">Modelos esperados</p>
                <p className="mt-1">llama3.1 · mistral · qwen2.5-coder:7b · deepseek-coder</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="grid gap-4 p-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
                    readHealthBadgeClass(health?.status),
                  )}
                >
                  {health?.status === "ok" ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  )}
                  {readHealthLabel(health?.status)}
                </span>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => void loadHealth()}>
                  <RefreshCw className="h-4 w-4" />
                  Actualizar estado
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {(health?.requiredModels ?? []).map((model) => (
                  <div key={model.model} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                    <p className="text-sm font-semibold text-slate-900">{model.model}</p>
                    <p className={cn("mt-1 text-xs font-medium", model.installed ? "text-emerald-700" : "text-amber-700")}>
                      {model.installed ? "Instalado" : "Pendiente en Ollama"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {model.actions.length ? model.actions.join(" · ") : "Reservado para futuras acciones"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">Accion activa</p>
              <p className="mt-1 text-sm text-slate-500">
                Modelo solicitado:{" "}
                <span className="font-medium text-slate-700">{activeHealth?.requestedModel ?? "Sin datos"}</span>
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Modelo resuelto: <span className="font-medium text-slate-700">{activeHealth?.model ?? "Sin datos"}</span>
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Fallback: <span className="font-medium text-slate-700">{activeHealth?.fallbackUsed ? "Si" : "No"}</span>
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Ultima latencia:{" "}
                <span className="font-medium text-slate-700">{formatLatency(health?.metrics[activeAction]?.latencyMs)}</span>
              </p>
              {health?.metrics[activeAction]?.lastError ? (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  {health.metrics[activeAction].lastError}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            const active = action.id === activeAction;

            return (
              <button
                key={action.id}
                className={cn(
                  "rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
                  active ? "border-sky-300 bg-sky-50 text-slate-950" : "border-slate-200 bg-white text-slate-800",
                )}
                type="button"
                onClick={() => {
                  setActiveAction(action.id);
                  setResult(null);
                  setError("");
                }}
              >
                <span
                  className={cn(
                    "inline-flex h-10 w-10 items-center justify-center rounded-xl",
                    active ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-700",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="mt-3 block font-semibold">{action.label}</span>
                <span className="mt-1 block text-sm leading-5 text-slate-500">{action.description}</span>
              </button>
            );
          })}
        </div>

        <Card>
          <CardContent className="space-y-5 p-6">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <ActiveIcon className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-semibold text-slate-950">{activeConfig.label}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">{activeConfig.description}</p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {activeAction === "chat" ? (
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Consulta
                  <Textarea value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} />
                </label>
              ) : null}

              {activeAction === "apu" ? (
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px]">
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Partida
                    <Input value={apuDescription} onChange={(event) => setApuDescription(event.target.value)} />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Unidad
                    <Input value={apuUnit} onChange={(event) => setApuUnit(event.target.value)} />
                  </label>
                </div>
              ) : null}

              {activeAction === "review" ? (
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Resumen del presupuesto o partidas
                  <Textarea
                    className="min-h-36"
                    value={reviewSummary}
                    onChange={(event) => setReviewSummary(event.target.value)}
                  />
                </label>
              ) : null}

              {activeAction === "autocomplete" ? (
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Texto base
                  <Input value={autocompleteInput} onChange={(event) => setAutocompleteInput(event.target.value)} />
                </label>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <Button className="gap-2" disabled={loading} type="submit">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {loading ? "Consultando IA local" : "Enviar a Ollama"}
                </Button>
                {lastRequest && error ? (
                  <Button
                    className="gap-2"
                    disabled={loading}
                    variant="outline"
                    onClick={() => void submitRequest(lastRequest)}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reintentar
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        {error ? <AIMessage content={error} tone="error" /> : null}
        {result ? (
          <div className="space-y-3">
            <AIMessage content={result.answer} model={result.model} />
            {result.warnings.length ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {result.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            ) : null}
            {renderStructuredResult(result)}
          </div>
        ) : null}

        {history.length ? (
          <Card>
            <CardContent className="space-y-4 p-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">Historial local de sesion</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Se guarda solo en este navegador para retomar contexto y revisar resultados recientes.
                </p>
              </div>
              <div className="space-y-3">
                {history.slice(0, 4).map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{readActionLabel(entry.action)}</p>
                      <p className="text-xs text-slate-500">{new Date(entry.timestamp).toLocaleString()}</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{entry.summary}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      Modelo: {entry.result.model} {entry.result.fallbackUsed ? "· fallback activo" : ""}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <ContextSidebar context={context} onChange={setContext} />
    </section>
  );

  function buildRequest(action: AiAction, currentContext: AiContext): RequestState {
    if (action === "apu") {
      return {
        action,
        payload: {
          description: apuDescription,
          unit: apuUnit || undefined,
          context: currentContext,
        },
      };
    }

    if (action === "review") {
      return {
        action,
        payload: {
          budgetSummary: reviewSummary,
          context: currentContext,
        },
      };
    }

    if (action === "autocomplete") {
      return {
        action,
        payload: {
          input: autocompleteInput,
          context: currentContext,
        },
      };
    }

    return {
      action,
      payload: {
        message: chatMessage,
        context: currentContext,
      },
    };
  }

  async function loadHealth() {
    try {
      const response = await fetch("/api/ai/health");
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(readErrorMessage(payload));
      }

      setHealth(readAiHealth(payload));
    } catch {
      setHealth(null);
    }
  }
}

function readAiResult(payload: unknown): AiResult {
  if (
    !isRecord(payload) ||
    typeof payload.answer !== "string" ||
    typeof payload.model !== "string" ||
    typeof payload.requestedModel !== "string" ||
    typeof payload.fallbackUsed !== "boolean" ||
    !Array.isArray(payload.warnings)
  ) {
    throw new Error("La respuesta de IA no tiene el formato esperado.");
  }

  return {
    answer: payload.answer,
    model: payload.model,
    requestedModel: payload.requestedModel,
    fallbackUsed: payload.fallbackUsed,
    warnings: payload.warnings.filter((warning): warning is string => typeof warning === "string"),
    latencyMs: typeof payload.latencyMs === "number" ? payload.latencyMs : undefined,
    structuredData: payload.structuredData,
  };
}

function readAiHealth(payload: unknown): AiHealth {
  if (!isRecord(payload) || !Array.isArray(payload.requiredModels) || !isRecord(payload.actions) || !isRecord(payload.metrics)) {
    throw new Error("La respuesta de salud de IA no tiene el formato esperado.");
  }

  return payload as AiHealth;
}

function readErrorMessage(payload: unknown) {
  if (isRecord(payload) && typeof payload.error === "string") {
    return payload.error;
  }

  return "No se pudo completar la solicitud de IA.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readHealthBadgeClass(status: AiHealth["status"] | undefined) {
  if (status === "ok") return "bg-emerald-100 text-emerald-700";
  if (status === "degraded") return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-700";
}

function readHealthLabel(status: AiHealth["status"] | undefined) {
  if (status === "ok") return "Ollama listo";
  if (status === "degraded") return "Ollama con fallback";
  return "Ollama no disponible";
}

function formatLatency(latencyMs: number | null | undefined) {
  if (typeof latencyMs !== "number") return "Sin ejecuciones";
  return `${latencyMs} ms`;
}

function summarizeRequest(request: RequestState) {
  if (request.action === "chat") return String(request.payload.message ?? "Consulta tecnica");
  if (request.action === "apu") return String(request.payload.description ?? "Generacion de APU");
  if (request.action === "review") return String(request.payload.budgetSummary ?? "Revision de presupuesto").slice(0, 140);
  return String(request.payload.input ?? "Autocompletado tecnico");
}

function readActionLabel(action: AiAction) {
  const match = ACTIONS.find((entry) => entry.id === action);
  return match?.label ?? action;
}

function readStoredHistory() {
  if (typeof window === "undefined") {
    return [];
  }

  const rawHistory = window.localStorage.getItem(AI_HISTORY_STORAGE_KEY);
  if (!rawHistory) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawHistory) as AiHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function renderStructuredResult(result: AiResult) {
  const structuredData = result.structuredData;

  if (!isRecord(structuredData)) {
    return null;
  }

  if (hasApuStructuredShape(structuredData)) {
    return (
      <Card>
        <CardContent className="grid gap-4 p-6">
          <div className="grid gap-3 md:grid-cols-3">
            <StructuredMetric label="Unidad" value={structuredData.unit} />
            <StructuredMetric label="Rendimiento" value={structuredData.performance} />
            <StructuredMetric label="Cuadrilla" value={structuredData.crew} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <StructuredLineItems title="Materiales" items={structuredData.materials} />
            <StructuredLineItems title="Mano de obra" items={structuredData.labor} />
            <StructuredLineItems title="Equipos" items={structuredData.equipment} />
          </div>
          <StructuredTextList title="Observaciones" items={structuredData.observations} />
          <StructuredTextList title="Supuestos" items={structuredData.assumptions} />
        </CardContent>
      </Card>
    );
  }

  if (hasReviewStructuredShape(structuredData)) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="space-y-3">
            {structuredData.findings.map((finding, index) => (
              <div key={`${finding.description}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
                      readSeverityClass(finding.severity),
                    )}
                  >
                    {finding.severity}
                  </span>
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{finding.type}</span>
                </div>
                <p className="mt-3 text-sm font-medium text-slate-900">{finding.description}</p>
                <p className="mt-2 text-sm text-slate-600">{finding.impact}</p>
                <p className="mt-2 text-sm text-slate-700">Accion recomendada: {finding.recommendedAction}</p>
              </div>
            ))}
          </div>
          <StructuredTextList title="Supuestos" items={structuredData.assumptions} />
        </CardContent>
      </Card>
    );
  }

  return null;
}

function StructuredMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function StructuredLineItems({
  title,
  items,
}: {
  title: string;
  items: AiApuStructuredData["materials"];
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <div className="mt-3 space-y-3">
        {items.map((item, index) => (
          <div key={`${item.description}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <p className="text-sm font-medium text-slate-900">{item.description}</p>
            <p className="mt-1 text-xs text-slate-500">
              {item.quantity} {item.unit}
            </p>
            {item.notes ? <p className="mt-2 text-xs text-slate-600">{item.notes}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function StructuredTextList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <ul className="mt-3 space-y-2 text-sm text-slate-700">
        {items.map((item) => (
          <li key={item} className="rounded-xl bg-slate-50/80 px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function hasApuStructuredShape(value: Record<string, unknown>): value is AiApuStructuredData {
  return (
    typeof value.unit === "string" &&
    Array.isArray(value.materials) &&
    Array.isArray(value.labor) &&
    Array.isArray(value.equipment) &&
    Array.isArray(value.observations) &&
    Array.isArray(value.assumptions)
  );
}

function hasReviewStructuredShape(value: Record<string, unknown>): value is AiReviewStructuredData {
  return Array.isArray(value.findings) && Array.isArray(value.assumptions);
}

function readSeverityClass(severity: AiReviewStructuredData["findings"][number]["severity"]) {
  if (severity === "high") return "bg-rose-100 text-rose-700";
  if (severity === "medium") return "bg-amber-100 text-amber-800";
  return "bg-emerald-100 text-emerald-700";
}
