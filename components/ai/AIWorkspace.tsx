"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  BotMessageSquare,
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
import {
  onMYCBridgeResponse,
  onMYCBridgeState,
  sendToMYCChatGPTBridge,
  type MYCBridgeResponse,
  type MYCBridgeState,
} from "@/lib/ai/myc-bridge-client";
import type { AiApuStructuredData, AiContext, AiEndpointResult, AiReviewStructuredData } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

type AiAction = "chat" | "apu" | "review" | "autocomplete";
type AiProvider = "ollama" | "chatgpt-bridge";

type AiResult = AiEndpointResult;

type AiResultWithHistory = AiResult & {
  historyEntry?: AiHistoryEntry;
};

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

type StreamEvent =
  | { event: "delta"; data: { text: string } }
  | { event: "final"; data: AiResultWithHistory }
  | { event: "error"; data: { error: string } };

type HistoryScope =
  | {
      mode: "project";
      projectId: string;
    }
  | {
      mode: "session";
    };

type ScopedRequestState = {
  request: RequestState;
  historyScope: HistoryScope;
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
    description: "Resolver dudas tecnicas con contexto de obra.",
    icon: BotMessageSquare,
  },
  {
    id: "apu",
    label: "Generar APU",
    description: "Crear una propuesta revisable de recursos y rendimiento.",
    icon: Sparkles,
  },
  {
    id: "review",
    label: "Revisar presupuesto",
    description: "Detectar unidades, duplicados y costos sospechosos.",
    icon: FileSearch,
  },
  {
    id: "autocomplete",
    label: "Autocompletar",
    description: "Completar descripciones y especificaciones tecnicas.",
    icon: WandSparkles,
  },
] as const;

const ACTION_HELPERS: Record<AiAction, string> = {
  chat: "Consulta criterios tecnicos con el contexto activo.",
  apu: "Genera una propuesta editable de recursos y rendimiento.",
  review: "Revisa unidades, duplicados y costos sospechosos.",
  autocomplete: "Completa descripciones tecnicas sin perder el contexto.",
};

type AIWorkspaceProps = {
  projectId?: string;
  initialAction?: AiAction;
  initialContext?: AiContext;
  initialChatMessage?: string;
  initialApuDescription?: string;
  initialApuUnit?: string;
  initialReviewSummary?: string;
  initialAutocompleteInput?: string;
};

export function AIWorkspace(props: AIWorkspaceProps) {
  return <AIWorkspaceContent key={props.projectId ? `project:${props.projectId}` : "session"} {...props} />;
}

function AIWorkspaceContent({
  projectId,
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
}: AIWorkspaceProps) {
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
  const [streaming, setStreaming] = useState(false);
  const [lastRequest, setLastRequest] = useState<RequestState | null>(null);
  const [health, setHealth] = useState<AiHealth | null>(null);
  const [provider, setProvider] = useState<AiProvider>("ollama");
  const [bridgeState, setBridgeState] = useState<MYCBridgeState | null>(null);
  const [history, setHistory] = useState<AiHistoryEntry[]>(() => (projectId ? [] : readStoredHistory()));
  const latestHistoryScope = useRef<HistoryScope>(readHistoryScope(projectId));
  const pendingBridgeRequestId = useRef<string | null>(null);
  const pendingBridgeTimeoutId = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const latestBridgeRequest = useRef<ScopedRequestState | null>(null);
  const latestContext = useRef(context);

  useEffect(() => {
    void loadHealth();
  }, []);

  useEffect(() => {
    if (projectId) {
      return;
    }

    window.localStorage.setItem(AI_HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 8)));
  }, [history, projectId]);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    let active = true;

    void loadProjectHistory(projectId).then((entries) => {
      if (active) {
        setHistory(entries);
      }
    });

    return () => {
      active = false;
    };
  }, [projectId]);

  useEffect(() => {
    latestContext.current = context;
  }, [context]);

  useEffect(() => {
    const unsubscribeResponse = onMYCBridgeResponse((response) => {
      if (response.requestId && pendingBridgeRequestId.current && response.requestId !== pendingBridgeRequestId.current) {
        return;
      }

      clearPendingBridgeTimeout();
      pendingBridgeRequestId.current = null;
      setLoading(false);

      if (response.error) {
        setError(response.error);
        latestBridgeRequest.current = null;
        return;
      }

      const nextResult = readBridgeAiResult(response);
      setResult(nextResult);

      const scopedRequest = latestBridgeRequest.current;
      latestBridgeRequest.current = null;

      if (scopedRequest && isSameHistoryScope(scopedRequest.historyScope, latestHistoryScope.current)) {
        const request = scopedRequest.request;
        setHistory((current) => [
          {
            id: `${Date.now()}-${request.action}-chatgpt-bridge`,
            action: request.action,
            summary: summarizeRequest(request),
            context: latestContext.current,
            result: nextResult,
            timestamp: new Date().toISOString(),
          },
          ...current,
        ]);
      }
    });
    const unsubscribeState = onMYCBridgeState(setBridgeState);

    return () => {
      unsubscribeResponse();
      unsubscribeState();
      clearPendingBridgeTimeout();
    };
  }, []);

  const activeConfig = ACTIONS.find((action) => action.id === activeAction) ?? ACTIONS[0];
  const ActiveIcon = activeConfig.icon;
  const activeHealth = useMemo(() => (health ? health.actions[activeAction] : null), [activeAction, health]);
  const providerStatus = readProviderStatus(provider, health?.status, bridgeState);
  const switchAction = (action: AiAction) => {
    setActiveAction(action);
    setResult(null);
    setError("");
    setStreaming(false);
  };
  const contextRows = [
    { label: "Proyecto", value: context.project },
    { label: "Modulo", value: context.module },
    { label: "Partida seleccionada", value: context.selectedItem },
    { label: "Unidad", value: context.unit },
    { label: "Costo actual", value: typeof context.currentCost === "number" ? String(context.currentCost) : undefined },
    { label: "Tabla activa", value: context.activeTable },
  ].filter((row): row is { label: string; value: string } => typeof row.value === "string" && row.value.trim().length > 0);
  const nextActionShortcuts = [
    {
      label: "Explicar contexto",
      description: "Abre el chat tecnico con los datos visibles.",
      onSelect: () => switchAction("chat"),
    },
    {
      label: "Generar APU",
      description: "Prepara una propuesta editable de recursos.",
      onSelect: () => switchAction("apu"),
    },
    {
      label: "Revisar presupuesto",
      description: "Busca unidades, duplicados y costos sospechosos.",
      onSelect: () => switchAction("review"),
    },
    {
      label: "Autocompletar texto",
      description: "Completa una descripcion tecnica breve.",
      onSelect: () => switchAction("autocomplete"),
    },
  ];

  const submitRequest = async (request: RequestState) => {
    setLoading(true);
    setStreaming(false);
    setError("");
    setResult(null);
    setLastRequest(request);
    const requestHistoryScope = readHistoryScope(projectId);

    if (provider === "chatgpt-bridge") {
      latestBridgeRequest.current = { request, historyScope: requestHistoryScope };
      submitBridgeRequest(request);
      return;
    }

    try {
      if (request.action === "chat") {
        const streamed = await submitStreamingChatRequest(request, requestHistoryScope);
        if (streamed) {
          void loadHealth();
          return;
        }
      }

      const response = await fetch(`/api/ai/${request.action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          requestHistoryScope.mode === "project"
            ? { ...request.payload, projectId: requestHistoryScope.projectId }
            : request.payload,
        ),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(readErrorMessage(payload));
      }

      const nextResult = readAiResult(payload);
      setResult(nextResult);
      const nextHistoryEntry =
        nextResult.historyEntry ??
        (requestHistoryScope.mode === "session"
          ? {
              id: `${Date.now()}-${request.action}`,
              action: request.action,
              summary: summarizeRequest(request),
              context,
              result: nextResult,
              timestamp: new Date().toISOString(),
            }
          : null);

      if (nextHistoryEntry && isSameHistoryScope(requestHistoryScope, latestHistoryScope.current)) {
        setHistory((current) => [nextHistoryEntry, ...current]);
      }
      void loadHealth();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No se pudo completar la solicitud de IA.");
      void loadHealth();
    } finally {
      setStreaming(false);
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
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl space-y-3">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                  <BotMessageSquare className="h-3.5 w-3.5" />
                  Khipu
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Asistente tecnico de obra</p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                    Criterio tecnico para presupuestos de obra.
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
                    Revisa APU, genera partidas y responde con contexto del presupuesto activo.
                  </p>
                </div>
              </div>
              <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-slate-900">Proveedor activo</span>
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", providerStatus.className)}>
                    {providerStatus.label}
                  </span>
                </div>
                <p>{provider === "ollama" ? "Ollama local" : "ChatGPT Bridge"}</p>
                <Button variant="outline" size="sm" className="w-fit gap-2" onClick={() => void loadHealth()}>
                  <RefreshCw className="h-4 w-4" />
                  Actualizar estado
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Trabajo activo</p>
                <p className="mt-1 text-sm text-slate-500">Contexto visible que Khipu usara en esta sesion.</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                Sesion actual
              </span>
            </div>
            {contextRows.length ? (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {contextRows.map((row) => (
                  <div key={row.label} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{row.label}</p>
                    <p className="mt-1 truncate text-sm font-medium text-slate-900">{row.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">Sin contexto activo</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-slate-50/60">
          <CardContent className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_260px_260px]">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Preparacion</p>
                <p className="mt-1 text-sm text-slate-500">
                  Proveedor, modelos y latencia para ejecutar la accion activa.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {(health?.requiredModels ?? []).map((model) => (
                  <div key={model.model} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <p className="text-xs font-semibold text-slate-900">{model.model}</p>
                    <p className={cn("mt-1 text-[11px] font-medium", model.installed ? "text-emerald-700" : "text-amber-700")}>
                      {model.installed ? "Instalado" : "Pendiente"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">Proveedor</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                    provider === "ollama" ? "border-blue-300 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-600",
                  )}
                  type="button"
                  aria-pressed={provider === "ollama"}
                  onClick={() => {
                    setProvider("ollama");
                    pendingBridgeRequestId.current = null;
                    latestBridgeRequest.current = null;
                    clearPendingBridgeTimeout();
                    setStreaming(false);
                    setLoading(false);
                    setError("");
                    setResult(null);
                  }}
                >
                  Ollama local
                </button>
                <button
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                    provider === "chatgpt-bridge"
                      ? "border-blue-300 bg-blue-50 text-blue-800"
                      : "border-slate-200 bg-white text-slate-600",
                  )}
                  type="button"
                  aria-pressed={provider === "chatgpt-bridge"}
                  onClick={() => {
                    setProvider("chatgpt-bridge");
                    setStreaming(false);
                    setError("");
                    setResult(null);
                  }}
                >
                  ChatGPT Bridge
                </button>
              </div>
              {provider === "chatgpt-bridge" ? (
                <p className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">
                  Estado: {readBridgeStateLabel(bridgeState)}
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">Accion activa</p>
              <p className="mt-1 text-sm text-slate-500">
                Modelo solicitado:{" "}
                <span className="font-medium text-slate-700">
                  {provider === "ollama" ? activeHealth?.requestedModel ?? "Sin datos" : "ChatGPT web"}
                </span>
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Modelo resuelto:{" "}
                <span className="font-medium text-slate-700">
                  {provider === "ollama" ? activeHealth?.model ?? "Sin datos" : "Pestana ChatGPT"}
                </span>
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Ultima latencia:{" "}
                <span className="font-medium text-slate-700">
                  {provider === "ollama" ? formatLatency(health?.metrics[activeAction]?.latencyMs) : "Depende de ChatGPT"}
                </span>
              </p>
              {provider === "ollama" && activeHealth?.fallbackUsed ? (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  Fallback activo para esta accion.
                </p>
              ) : null}
              {provider === "ollama" && health?.metrics[activeAction]?.lastError ? (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  {health.metrics[activeAction].lastError}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            const active = action.id === activeAction;

            return (
              <button
                key={action.id}
                className={cn(
                  "flex min-h-24 items-start gap-3 rounded-2xl border p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                  active ? "border-blue-300 bg-blue-50 text-slate-950 shadow-sm" : "border-slate-200 bg-white text-slate-800",
                )}
                type="button"
                aria-pressed={active}
                onClick={() => switchAction(action.id)}
              >
                <span
                  className={cn(
                    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{action.label}</span>
                    {active ? (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white">Recomendado</span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-sm leading-5 text-slate-500">{action.description}</span>
                </span>
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
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Ejecucion</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">{activeConfig.label}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">{ACTION_HELPERS[activeAction]}</p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {activeAction === "chat" ? (
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Consulta tecnica
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
                  Resumen del presupuesto
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
                  {readSubmitLabel(provider, loading, streaming)}
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
                <h3 className="text-lg font-semibold text-slate-950">Actividad reciente de Khipu</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {projectId
                    ? "Historial del proyecto; las respuestas de ChatGPT Bridge quedan solo en esta sesion."
                    : "Se guarda solo en este navegador para retomar resultados recientes; no es memoria del proyecto."}
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
                    <Button
                      className="mt-3"
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setActiveAction(entry.action);
                        setContext(entry.context);
                        setResult(entry.result);
                        setError("");
                      }}
                    >
                      Ver detalle
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <ContextSidebar context={context} shortcuts={nextActionShortcuts} onChange={setContext} />
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

  function submitBridgeRequest(request: RequestState) {
    try {
      const requestId = sendToMYCChatGPTBridge(buildBridgePrompt(request), {
        source: "myc-presupuestos",
        provider: "chatgpt-bridge",
        action: request.action,
      });

      pendingBridgeRequestId.current = requestId;
      clearPendingBridgeTimeout();
      pendingBridgeTimeoutId.current = window.setTimeout(() => {
        if (pendingBridgeRequestId.current !== requestId) {
          return;
        }

        pendingBridgeRequestId.current = null;
        latestBridgeRequest.current = null;
        setLoading(false);
        setError(
          "ChatGPT Bridge no devolvio respuesta. Verifica que la extension este cargada, que ChatGPT este abierto y que hayas usado el boton de copiar respuesta en ChatGPT.",
        );
      }, 600000);
    } catch (caughtError) {
      latestBridgeRequest.current = null;
      setLoading(false);
      setError(caughtError instanceof Error ? caughtError.message : "No se pudo enviar la solicitud a ChatGPT Bridge.");
    }
  }

  async function submitStreamingChatRequest(request: RequestState, requestHistoryScope: HistoryScope) {
    try {
      const response = await fetch("/api/ai/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          requestHistoryScope.mode === "project"
            ? { ...request.payload, projectId: requestHistoryScope.projectId }
            : request.payload,
        ),
      });

      if (!response.ok || !response.body) {
        return false;
      }

      let receivedFinal = false;
      let streamedAnswer = "";

      await readStreamEvents(response, (event) => {
        if (event.event === "delta") {
          streamedAnswer += event.data.text;
          setStreaming(true);
          setResult({
            answer: streamedAnswer,
            model: "Khipu",
            requestedModel: "Streaming",
            fallbackUsed: false,
            warnings: [],
          });
          return;
        }

        if (event.event === "error") {
          throw new Error(event.data.error);
        }

        receivedFinal = true;
        setStreaming(false);
        setResult(event.data);
        const nextHistoryEntry =
          event.data.historyEntry ??
          (requestHistoryScope.mode === "session"
            ? {
                id: `${Date.now()}-${request.action}`,
                action: request.action,
                summary: summarizeRequest(request),
                context,
                result: event.data,
                timestamp: new Date().toISOString(),
              }
            : null);

        if (nextHistoryEntry && isSameHistoryScope(requestHistoryScope, latestHistoryScope.current)) {
          setHistory((current) => [nextHistoryEntry, ...current]);
        }
      });

      return receivedFinal;
    } catch {
      setStreaming(false);
      return false;
    }
  }

  function clearPendingBridgeTimeout() {
    if (pendingBridgeTimeoutId.current) {
      window.clearTimeout(pendingBridgeTimeoutId.current);
      pendingBridgeTimeoutId.current = null;
    }
  }

}

function readAiResult(payload: unknown): AiResultWithHistory {
  const result = readHistoryResult(payload);

  if (!result || !isRecord(payload)) {
    throw new Error("La respuesta de IA no tiene el formato esperado.");
  }

  const historyEntry = readHistoryEntry(payload.historyEntry);

  return historyEntry ? { ...result, historyEntry } : result;
}

async function readStreamEvents(response: Response, onEvent: (event: StreamEvent) => void) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("La respuesta de IA no tiene un stream legible.");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        const event = readStreamEvent(frame);
        if (event) {
          onEvent(event);
        }
      }
    }

    buffer += decoder.decode();
    const finalEvent = readStreamEvent(buffer);
    if (finalEvent) {
      onEvent(finalEvent);
    }
  } finally {
    reader.releaseLock();
  }
}

function readStreamEvent(frame: string): StreamEvent | null {
  const lines = frame
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const eventLine = lines.find((line) => line.startsWith("event:"));
  const dataLine = lines.find((line) => line.startsWith("data:"));

  if (!eventLine || !dataLine) {
    return null;
  }

  const eventName = eventLine.slice("event:".length).trim();
  const dataText = dataLine.slice("data:".length).trim();
  const parsed: unknown = JSON.parse(dataText);

  if (eventName === "delta" && isRecord(parsed) && typeof parsed.text === "string") {
    return { event: "delta", data: { text: parsed.text } };
  }

  if (eventName === "error" && isRecord(parsed) && typeof parsed.error === "string") {
    return { event: "error", data: { error: parsed.error } };
  }

  if (eventName === "final") {
    return { event: "final", data: readAiResult(parsed) };
  }

  return null;
}

function readBridgeAiResult(response: MYCBridgeResponse): AiResult {
  const structuredData = response.jsonValid ? response.json : undefined;
  const answerFromJson = readAnswerFromBridgeJson(structuredData);
  const answer = answerFromJson ?? response.raw ?? "ChatGPT Bridge devolvio una respuesta sin contenido legible.";
  const warnings = response.jsonValid === false ? ["La respuesta de ChatGPT Bridge no parece JSON valido."] : [];

  return {
    answer,
    model: "ChatGPT Bridge",
    requestedModel: "ChatGPT web",
    fallbackUsed: false,
    warnings,
    structuredData,
  };
}

function readAnswerFromBridgeJson(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  return typeof value.answer === "string" ? value.answer : null;
}

function buildBridgePrompt(request: RequestState) {
  return {
    accion: request.action,
    instrucciones: [
      "Eres un asistente experto en presupuestos de construccion, APU, metrados, costos y formula polinomica en Peru.",
      "Responde de forma tecnica, clara y profesional.",
      "No modifiques presupuestos automaticamente; entrega propuestas para revision humana.",
      "Cuando la accion requiera estructura, devuelve solo JSON valido sin markdown.",
    ],
    payload: request.payload,
    formatoSalida: readBridgeOutputFormat(request.action),
  };
}

function readBridgeOutputFormat(action: AiAction) {
  if (action === "apu") {
    return {
      answer: "resumen corto",
      unit: "unidad tecnica",
      performance: "rendimiento",
      crew: "cuadrilla",
      materials: [{ description: "recurso", unit: "unidad", quantity: "cantidad", notes: "supuesto" }],
      labor: [{ description: "recurso", unit: "unidad", quantity: "cantidad" }],
      equipment: [{ description: "recurso", unit: "unidad", quantity: "cantidad" }],
      observations: ["observacion tecnica"],
      assumptions: ["supuesto para validar"],
    };
  }

  if (action === "review") {
    return {
      answer: "resumen corto",
      findings: [
        {
          severity: "low|medium|high",
          type: "duplicate|unit|cost|quantity|consistency|other",
          description: "hallazgo",
          impact: "impacto",
          recommendedAction: "accion recomendada",
        },
      ],
      assumptions: ["supuesto para validar"],
    };
  }

  if (action === "autocomplete") {
    return "Texto completado sin explicaciones adicionales.";
  }

  return "Respuesta tecnica clara; si incluyes datos estructurados, usa JSON valido.";
}

function readSubmitLabel(provider: AiProvider, loading: boolean, streaming: boolean) {
  if (provider === "chatgpt-bridge") {
    return loading ? "Consultando ChatGPT" : "Enviar a ChatGPT";
  }

  if (streaming) {
    return "Khipu respondiendo";
  }

  return loading ? "Consultando IA local" : "Enviar a Ollama";
}

function readBridgeStateLabel(state: MYCBridgeState | null) {
  if (!state) {
    return "esperando extension";
  }

  if (state.lastError) {
    return state.lastError;
  }

  if (state.status === "waiting_manual_copy") {
    return "prompt insertado; esperando que copies la respuesta en ChatGPT";
  }

  const mode = state.mode ? `modo ${state.mode}` : "modo no reportado";
  const tab = state.hasChatGPTTab === false ? "sin pestana ChatGPT detectada" : "pestana ChatGPT lista";
  const queueLength = typeof state.queueLength === "number" ? state.queueLength : state.queue?.length;
  const queue = typeof queueLength === "number" ? `cola ${queueLength}` : "cola sin datos";

  return `${mode}, ${tab}, ${queue}`;
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

function readHistoryScope(projectId: string | undefined): HistoryScope {
  return projectId ? { mode: "project", projectId } : { mode: "session" };
}

function isSameHistoryScope(left: HistoryScope, right: HistoryScope) {
  if (left.mode !== right.mode) {
    return false;
  }

  if (left.mode === "session") {
    return true;
  }

  return right.mode === "project" && left.projectId === right.projectId;
}

async function loadProjectHistory(projectId: string) {
  try {
    const response = await fetch(`/api/projects/${projectId}/ai-history`);
    if (!response.ok) {
      return [];
    }

    const payload: unknown = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.entries)) {
      return [];
    }

    return payload.entries.map(readHistoryEntry).filter((entry): entry is AiHistoryEntry => entry !== null);
  } catch {
    return [];
  }
}

function readHistoryEntry(value: unknown): AiHistoryEntry | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.action !== "string" ||
    typeof value.summary !== "string" ||
    typeof value.timestamp !== "string" ||
    !isRecord(value.result)
  ) {
    return null;
  }

  const result = readHistoryResult(value.result);
  if (!result) {
    return null;
  }

  return {
    id: value.id,
    action: readHistoryAction(value.action),
    summary: value.summary,
    context: readAiContext(value.context),
    result,
    timestamp: value.timestamp,
  };
}

function readHistoryResult(value: unknown): AiResult | null {
  if (
    !isRecord(value) ||
    typeof value.answer !== "string" ||
    typeof value.model !== "string" ||
    typeof value.requestedModel !== "string" ||
    typeof value.fallbackUsed !== "boolean" ||
    !Array.isArray(value.warnings)
  ) {
    return null;
  }

  return {
    answer: value.answer,
    model: value.model,
    requestedModel: value.requestedModel,
    fallbackUsed: value.fallbackUsed,
    warnings: value.warnings.filter((warning): warning is string => typeof warning === "string"),
    latencyMs: typeof value.latencyMs === "number" ? value.latencyMs : undefined,
    structuredData: value.structuredData,
  };
}

function readHistoryAction(action: string): AiAction {
  if (action === "apu" || action === "review" || action === "autocomplete") {
    return action;
  }

  return "chat";
}

function readAiContext(value: unknown): AiContext {
  if (!isRecord(value)) {
    return {};
  }

  return {
    project: typeof value.project === "string" ? value.project : undefined,
    module: typeof value.module === "string" ? value.module : undefined,
    selectedItem: typeof value.selectedItem === "string" ? value.selectedItem : undefined,
    unit: typeof value.unit === "string" ? value.unit : undefined,
    currentCost: typeof value.currentCost === "number" ? value.currentCost : undefined,
    activeTable: typeof value.activeTable === "string" ? value.activeTable : undefined,
  };
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

function readProviderStatus(provider: AiProvider, status: AiHealth["status"] | undefined, bridgeState: MYCBridgeState | null) {
  if (provider === "ollama") {
    return {
      label: readHealthLabel(status),
      className: readHealthBadgeClass(status),
    };
  }

  if (bridgeState?.lastError) {
    return {
      label: "Bridge con alerta",
      className: "bg-rose-100 text-rose-700",
    };
  }

  if (!bridgeState || bridgeState.status === "waiting_manual_copy" || bridgeState.hasChatGPTTab === false) {
    return {
      label: "Bridge esperando",
      className: "bg-amber-100 text-amber-800",
    };
  }

  return {
    label: "Bridge listo",
    className: "bg-emerald-100 text-emerald-700",
  };
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

  return <GenericStructuredResult data={structuredData} />;
}

function GenericStructuredResult({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([key]) => key !== "answer");

  if (!entries.length) {
    return null;
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">Detalles de la respuesta</h3>
          <p className="mt-1 text-sm text-slate-500">
            Informacion estructurada devuelta por ChatGPT Bridge para revisar el criterio tecnico completo.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {entries.map(([key, value]) => (
            <GenericStructuredField key={key} label={formatStructuredLabel(key)} value={value} />
          ))}
        </div>
        <details className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">Ver respuesta completa</summary>
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-xs leading-5 text-slate-700">
            {JSON.stringify(data, null, 2)}
          </pre>
        </details>
      </CardContent>
    </Card>
  );
}

function GenericStructuredField({ label, value }: { label: string; value: unknown }) {
  if (Array.isArray(value)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {value.map((item, index) => (
            <li key={`${label}-${index}`} className="rounded-xl bg-slate-50/80 px-3 py-2">
              {renderGenericValue(item)}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (isRecord(value)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-2">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {Object.entries(value).map(([nestedKey, nestedValue]) => (
            <GenericStructuredField key={nestedKey} label={formatStructuredLabel(nestedKey)} value={nestedValue} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{renderGenericValue(value)}</p>
    </div>
  );
}

function renderGenericValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "Sin datos";
  return JSON.stringify(value, null, 2);
}

function formatStructuredLabel(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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
