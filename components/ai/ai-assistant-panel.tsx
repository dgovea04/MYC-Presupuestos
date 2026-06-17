"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
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
import { PreviewDebugPanel } from "@/components/ai/debug-panel";
import type {
  AiFeedbackType,
  AiHealth,
  AiHistoryEntry,
  AiResult,
  AssistantAction,
  AssistantProvider,
} from "@/components/ai/use-ai-assistant-controller";
import { useAiAssistantController } from "@/components/ai/use-ai-assistant-controller";
import { hasApuStructuredShape, hasReviewStructuredShape } from "@/components/ai/use-ai-assistant-controller";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AiApuStructuredData, AiReviewStructuredData } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

type AiAssistantPanelLayout = "page" | "floating";

type AiAssistantPanelProps = {
  controller: ReturnType<typeof useAiAssistantController>;
  initialAutocompleteInput?: string;
  initialApuDescription?: string;
  initialApuUnit?: string;
  initialChatMessage?: string;
  initialReviewSummary?: string;
  layout: AiAssistantPanelLayout;
  projectId?: string;
};

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

const ACTION_HELPERS: Record<AssistantAction, string> = {
  chat: "Consulta criterios tecnicos con el contexto activo.",
  apu: "Genera una propuesta editable de recursos y rendimiento.",
  review: "Revisa unidades, duplicados y costos sospechosos.",
  autocomplete: "Completa descripciones tecnicas sin perder el contexto.",
};

export function AiAssistantPanel({
  controller,
  initialAutocompleteInput = "Excavacion manual en",
  initialApuDescription = "Concreto armado f'c=210 kg/cm2 para columnas",
  initialApuUnit = "m3",
  initialChatMessage = "Genera recomendaciones para revisar este APU.",
  initialReviewSummary = "Partida 01.02 Concreto f'c=210 m3 S/ 420. Partida 01.03 Concreto f'c=210 m2 S/ 415.",
  layout,
  projectId,
}: AiAssistantPanelProps) {
  const [chatMessage, setChatMessage] = useState(initialChatMessage);
  const [apuDescription, setApuDescription] = useState(initialApuDescription);
  const [apuUnit, setApuUnit] = useState(initialApuUnit);
  const [reviewSummary, setReviewSummary] = useState(initialReviewSummary);
  const [autocompleteInput, setAutocompleteInput] = useState(initialAutocompleteInput);

  const activeConfig = ACTIONS.find((action) => action.id === controller.activeAction) ?? ACTIONS[0];
  const ActiveIcon = activeConfig.icon;
  const activeHealth = useMemo(
    () => (controller.health ? controller.health.actions[controller.activeAction] : null),
    [controller.activeAction, controller.health],
  );
  const providerStatus = readProviderStatus(
    controller.provider,
    controller.health?.status,
    controller.bridgeState,
    controller.cloudConfigured,
  );
  const contextRows = [
    { label: "Proyecto", value: controller.context.project },
    { label: "Modulo", value: controller.context.module },
    { label: "Partida seleccionada", value: controller.context.selectedItem },
    { label: "Unidad", value: controller.context.unit },
    {
      label: "Costo actual",
      value: typeof controller.context.currentCost === "number" ? String(controller.context.currentCost) : undefined,
    },
    { label: "Tabla activa", value: controller.context.activeTable },
  ].filter((row): row is { label: string; value: string } => typeof row.value === "string" && row.value.trim().length > 0);
  const nextActionShortcuts = [
    { label: "Explicar contexto", description: "Abre el chat tecnico con los datos visibles.", onSelect: () => controller.setActiveAction("chat") },
    { label: "Generar APU", description: "Prepara una propuesta editable de recursos.", onSelect: () => controller.setActiveAction("apu") },
    { label: "Revisar presupuesto", description: "Busca unidades, duplicados y costos sospechosos.", onSelect: () => controller.setActiveAction("review") },
    { label: "Autocompletar texto", description: "Completa una descripcion tecnica breve.", onSelect: () => controller.setActiveAction("autocomplete") },
  ];

  function buildRequest() {
    if (controller.activeAction === "apu") {
      return {
        action: controller.activeAction,
        payload: {
          description: apuDescription,
          unit: apuUnit || undefined,
          context: controller.context,
        },
      } satisfies Parameters<typeof controller.submit>[0];
    }

    if (controller.activeAction === "review") {
      return {
        action: controller.activeAction,
        payload: {
          budgetSummary: reviewSummary,
          context: controller.context,
        },
      } satisfies Parameters<typeof controller.submit>[0];
    }

    if (controller.activeAction === "autocomplete") {
      return {
        action: controller.activeAction,
        payload: {
          input: autocompleteInput,
          context: controller.context,
        },
      } satisfies Parameters<typeof controller.submit>[0];
    }

    return {
      action: controller.activeAction,
      payload: {
        message: chatMessage,
        context: controller.context,
      },
    } satisfies Parameters<typeof controller.submit>[0];
  }

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    await controller.submit(buildRequest());
  }

  if (layout === "floating") {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Chat tecnico</p>
          <p className="text-sm text-slate-600">{ACTION_HELPERS[controller.activeAction]}</p>
        </div>
        {contextRows.length ? (
          <div className="grid gap-2">
            {contextRows.slice(0, 3).map((row) => (
              <div key={row.label} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{row.label}</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{row.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">Sin contexto activo</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {ACTIONS.map((action) => (
            <button
              key={action.id}
              type="button"
              className={cn(
                "rounded-xl border px-3 py-2 text-left text-sm font-semibold transition",
                controller.activeAction === action.id ? "border-blue-300 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-700",
              )}
              onClick={() => controller.setActiveAction(action.id)}
            >
              {action.label}
            </button>
          ))}
        </div>
        <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
          {controller.activeAction === "chat" ? (
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Consulta tecnica
              <Textarea value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} />
            </label>
          ) : null}
          {controller.activeAction === "apu" ? (
            <div className="grid gap-3">
              <Input value={apuDescription} onChange={(event) => setApuDescription(event.target.value)} />
              <Input value={apuUnit} onChange={(event) => setApuUnit(event.target.value)} />
            </div>
          ) : null}
          {controller.activeAction === "review" ? (
            <Textarea className="min-h-28" value={reviewSummary} onChange={(event) => setReviewSummary(event.target.value)} />
          ) : null}
          {controller.activeAction === "autocomplete" ? (
            <Input value={autocompleteInput} onChange={(event) => setAutocompleteInput(event.target.value)} />
          ) : null}
          <Button className="w-full gap-2" disabled={controller.loading} type="submit">
            {controller.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {readSubmitLabel(controller.provider, controller.loading, controller.streaming)}
          </Button>
        </form>
        {controller.error ? <AIMessage content={controller.error} tone="error" /> : null}
        {controller.result ? <AIMessage content={controller.result.answer} model={controller.result.model} /> : null}
      </div>
    );
  }

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
                <p>{readProviderLabel(controller.provider)}</p>
                <Button variant="outline" size="sm" className="w-fit gap-2" onClick={() => void controller.refreshHealth()}>
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
                <p className="mt-1 text-sm text-slate-500">Proveedor, modelos y latencia para ejecutar la accion activa.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {(controller.health?.requiredModels ?? []).map((model) => (
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
                {(["ollama", "chatgpt-bridge", "openai", "gemini", "openrouter"] as AssistantProvider[]).map((provider) => (
                  <button
                    key={provider}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                      controller.provider === provider ? "border-blue-300 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-600",
                      (provider === "openai" || provider === "gemini" || provider === "openrouter") && !controller.cloudConfigured[provider] ? "opacity-60" : "",
                    )}
                    type="button"
                    aria-pressed={controller.provider === provider}
                    onClick={() => controller.setProvider(provider)}
                  >
                    {readProviderButtonLabel(provider)}
                  </button>
                ))}
              </div>
              {controller.provider === "chatgpt-bridge" ? (
                <p className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">
                  Estado: {readBridgeStateLabel(controller.bridgeState)}
                </p>
              ) : null}
              {(controller.provider === "openai" || controller.provider === "gemini" || controller.provider === "openrouter") &&
              !controller.cloudConfigured[controller.provider] ? (
                <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  {readProviderButtonLabel(controller.provider)} no configurado. Agrega tu API key en .env o Configuracion.
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">Accion activa</p>
              <p className="mt-1 text-sm text-slate-500">
                Modelo solicitado: <span className="font-medium text-slate-700">{readActiveModelLabel(controller.provider, activeHealth)}</span>
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Modelo resuelto: <span className="font-medium text-slate-700">{readResolvedModelLabel(controller.provider, activeHealth)}</span>
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Ultima latencia: <span className="font-medium text-slate-700">{readLatencyLabel(controller.provider, controller.health?.metrics[controller.activeAction]?.latencyMs)}</span>
              </p>
              {controller.provider === "ollama" && activeHealth?.fallbackUsed ? (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  Fallback activo para esta accion.
                </p>
              ) : null}
              {controller.provider === "ollama" && controller.health?.metrics[controller.activeAction]?.lastError ? (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  {controller.health.metrics[controller.activeAction].lastError}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            const active = action.id === controller.activeAction;

            return (
              <button
                key={action.id}
                className={cn(
                  "flex min-h-24 items-start gap-3 rounded-2xl border p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                  active ? "border-blue-300 bg-blue-50 text-slate-950 shadow-sm" : "border-slate-200 bg-white text-slate-800",
                )}
                type="button"
                aria-pressed={active}
                onClick={() => controller.setActiveAction(action.id)}
              >
                <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700")}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{action.label}</span>
                    {active ? <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white">Recomendado</span> : null}
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
                <p className="mt-1 text-sm leading-6 text-slate-500">{ACTION_HELPERS[controller.activeAction]}</p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
              {controller.activeAction === "chat" ? (
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Consulta tecnica
                  <Textarea value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} />
                </label>
              ) : null}
              {controller.activeAction === "apu" ? (
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
              {controller.activeAction === "review" ? (
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Resumen del presupuesto
                  <Textarea className="min-h-36" value={reviewSummary} onChange={(event) => setReviewSummary(event.target.value)} />
                </label>
              ) : null}
              {controller.activeAction === "autocomplete" ? (
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Texto base
                  <Input value={autocompleteInput} onChange={(event) => setAutocompleteInput(event.target.value)} />
                </label>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <Button className="gap-2" disabled={controller.loading} type="submit">
                  {controller.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {readSubmitLabel(controller.provider, controller.loading, controller.streaming)}
                </Button>
                {controller.lastRequest && controller.error ? (
                  <Button className="gap-2" disabled={controller.loading} variant="outline" onClick={() => void controller.retryLastRequest()}>
                    <RefreshCw className="h-4 w-4" />
                    Reintentar
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3">
          <QualityMetric label="Aplicadas" value={controller.feedbackSummary.applied} />
          <QualityMetric label="Editadas" value={controller.feedbackSummary.edited} />
          <QualityMetric label="Descartadas" value={controller.feedbackSummary.dismissed} />
        </div>

        {controller.error ? <AIMessage content={controller.error} tone="error" /> : null}
        {controller.feedbackError ? <AIMessage content={controller.feedbackError} tone="error" /> : null}
        {controller.result ? (
          <div className="space-y-3">
            <AIMessage content={controller.result.answer} model={controller.result.model} />
            {controller.activeFeedbackEntry ? (
              <FeedbackControls
                disabled={controller.pendingFeedbackByHistoryId[controller.activeFeedbackEntry.id] === true}
                selected={controller.feedbackByHistoryId[controller.activeFeedbackEntry.id]}
                onSelect={(feedbackType) => {
                  void controller.submitFeedback(controller.activeFeedbackEntry as AiHistoryEntry, feedbackType);
                }}
              />
            ) : null}
            {controller.result.warnings.length ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {controller.result.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            ) : null}
            {renderStructuredResult(controller.result)}
            {controller.result.debug ? <PreviewDebugPanel debug={controller.result.debug} /> : null}
          </div>
        ) : null}

        {controller.history.length ? (
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
                {controller.history.slice(0, 4).map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{readActionLabel(entry.action)}</p>
                      <p className="text-xs text-slate-500">{new Date(entry.timestamp).toLocaleString()}</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{entry.summary}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      Modelo: {entry.result.model} {entry.result.fallbackUsed ? "· fallback activo" : ""}
                    </p>
                    <Button className="mt-3" size="sm" type="button" variant="outline" onClick={() => controller.selectHistoryEntry(entry)}>
                      Ver detalle
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <ContextSidebar context={controller.context} shortcuts={nextActionShortcuts} onChange={controller.setContext} />
    </section>
  );
}

function QualityMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function FeedbackControls({
  disabled = false,
  onSelect,
  selected,
}: {
  disabled?: boolean;
  onSelect: (feedbackType: AiFeedbackType) => void;
  selected?: AiFeedbackType;
}) {
  const options: Array<{ value: AiFeedbackType; label: string }> = [
    { value: "APPLIED", label: "Aplicada" },
    { value: "EDITED", label: "Editada" },
    { value: "DISMISSED", label: "Descartada" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((option) => (
        <Button
          key={option.value}
          size="sm"
          type="button"
          variant={selected === option.value ? "default" : "outline"}
          aria-pressed={selected === option.value}
          disabled={disabled}
          onClick={() => onSelect(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
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
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em]", readSeverityClass(finding.severity))}>
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
  if (!entries.length) return null;

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

function StructuredMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function StructuredLineItems({ items, title }: { items: AiApuStructuredData["materials"]; title: string }) {
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

function StructuredTextList({ items, title }: { items: string[]; title: string }) {
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

function readProviderStatus(
  provider: AssistantProvider,
  status: AiHealth["status"] | undefined,
  bridgeState: ReturnType<typeof useAiAssistantController>["bridgeState"],
  cloudConfigured: ReturnType<typeof useAiAssistantController>["cloudConfigured"],
) {
  if (provider === "ollama") {
    return { label: readHealthLabel(status), className: readHealthBadgeClass(status) };
  }
  if (provider === "chatgpt-bridge") {
    if (bridgeState?.lastError) return { label: "Bridge con alerta", className: "bg-rose-100 text-rose-700" };
    if (!bridgeState || bridgeState.status === "waiting_manual_copy" || bridgeState.hasChatGPTTab === false) {
      return { label: "Bridge esperando", className: "bg-amber-100 text-amber-800" };
    }
    return { label: "Bridge listo", className: "bg-emerald-100 text-emerald-700" };
  }
  if (provider === "openai") return cloudConfigured.openai ? { label: "OpenAI API listo", className: "bg-emerald-100 text-emerald-700" } : { label: "OpenAI sin key", className: "bg-amber-100 text-amber-800" };
  if (provider === "gemini") return cloudConfigured.gemini ? { label: "Gemini API listo", className: "bg-emerald-100 text-emerald-700" } : { label: "Gemini sin key", className: "bg-amber-100 text-amber-800" };
  if (provider === "openrouter") return cloudConfigured.openrouter ? { label: "OpenRouter listo", className: "bg-emerald-100 text-emerald-700" } : { label: "OpenRouter sin key", className: "bg-amber-100 text-amber-800" };
  return { label: "Desconocido", className: "bg-slate-100 text-slate-600" };
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

function readProviderLabel(provider: AssistantProvider) {
  if (provider === "ollama") return "Ollama local";
  if (provider === "chatgpt-bridge") return "ChatGPT Bridge";
  if (provider === "openai") return "ChatGPT API";
  if (provider === "gemini") return "Gemini API";
  if (provider === "openrouter") return "OpenRouter";
  return provider;
}

function readProviderButtonLabel(provider: AssistantProvider) {
  if (provider === "ollama") return "Ollama local";
  if (provider === "chatgpt-bridge") return "Bridge";
  if (provider === "openai") return "ChatGPT";
  if (provider === "gemini") return "Gemini";
  if (provider === "openrouter") return "OpenRouter";
  return provider;
}

function readActiveModelLabel(provider: AssistantProvider, activeHealth: { requestedModel?: string } | null) {
  if (provider === "ollama") return activeHealth?.requestedModel ?? "Sin datos";
  if (provider === "chatgpt-bridge") return "ChatGPT web";
  if (provider === "openai") return "OpenAI API";
  if (provider === "gemini") return "Gemini API";
  if (provider === "openrouter") return "OpenRouter API";
  return "Sin datos";
}

function readResolvedModelLabel(provider: AssistantProvider, activeHealth: { model?: string } | null) {
  if (provider === "ollama") return activeHealth?.model ?? "Sin datos";
  if (provider === "chatgpt-bridge") return "Pestana ChatGPT";
  if (provider === "openai") return "OpenAI API";
  if (provider === "gemini") return "Gemini API";
  if (provider === "openrouter") return "OpenRouter API";
  return "Sin datos";
}

function readLatencyLabel(provider: AssistantProvider, latencyMs: number | null | undefined) {
  if (provider === "ollama") return typeof latencyMs === "number" ? `${latencyMs} ms` : "Sin ejecuciones";
  if (provider === "chatgpt-bridge") return "Depende de ChatGPT";
  if (provider === "openai" || provider === "gemini" || provider === "openrouter") return "Nube";
  return "Sin ejecuciones";
}

function readBridgeStateLabel(state: ReturnType<typeof useAiAssistantController>["bridgeState"]) {
  if (!state) return "esperando extension";
  if (state.lastError) return state.lastError;
  if (state.status === "waiting_manual_copy") return "prompt insertado; esperando que copies la respuesta en ChatGPT";
  const mode = state.mode ? `modo ${state.mode}` : "modo no reportado";
  const tab = state.hasChatGPTTab === false ? "sin pestana ChatGPT detectada" : "pestana ChatGPT lista";
  const queueLength = typeof state.queueLength === "number" ? state.queueLength : state.queue?.length;
  const queue = typeof queueLength === "number" ? `cola ${queueLength}` : "cola sin datos";
  return `${mode}, ${tab}, ${queue}`;
}

function readSubmitLabel(provider: AssistantProvider, loading: boolean, streaming: boolean) {
  if (provider === "chatgpt-bridge") return loading ? "Consultando ChatGPT" : "Enviar a ChatGPT";
  if (provider === "openai") return loading ? "Consultando OpenAI" : "Enviar a OpenAI";
  if (provider === "gemini") return loading ? "Consultando Gemini" : "Enviar a Gemini";
  if (provider === "openrouter") return loading ? "Consultando OpenRouter" : "Enviar a OpenRouter";
  if (streaming) return "Khipu respondiendo";
  return loading ? "Consultando IA local" : "Enviar a Ollama";
}

function readActionLabel(action: AssistantAction) {
  const match = ACTIONS.find((entry) => entry.id === action);
  return match?.label ?? action;
}

function renderGenericValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "Sin datos";
  return JSON.stringify(value, null, 2);
}

function formatStructuredLabel(key: string) {
  return key.replace(/_/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readSeverityClass(severity: AiReviewStructuredData["findings"][number]["severity"]) {
  if (severity === "high") return "bg-rose-100 text-rose-700";
  if (severity === "medium") return "bg-amber-100 text-amber-800";
  return "bg-emerald-100 text-emerald-700";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
