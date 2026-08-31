"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BotMessageSquare,
  Download,
  ChevronDown,
  ExternalLink,
  FileSearch,
  FileText,
  GitCompareArrows,
  Lightbulb,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  TrendingUp,
  WandSparkles,
} from "lucide-react";
import { AIMessage } from "@/components/ai/AIMessage";
import { ChatHistory } from "@/components/ai/ChatHistory";
import { ClearHistoryButton } from "@/components/ai/ClearHistoryButton";
import { HistoryCountBadge } from "@/components/ai/HistoryCountBadge";
import { TypingIndicator } from "@/components/ai/TypingIndicator";
import { useDedupedHistory } from "@/components/ai/use-deduped-history";
import { ContextSidebar } from "@/components/ai/ContextSidebar";
import { PreviewDebugPanel } from "@/components/ai/debug-panel";
import { AGENT_MODELS, COST_EMOJI, getAgentModelCostEmoji, getAgentModelShortLabel } from "@/lib/ai/agent/models";
import type {
  AiAssistantControllerViewModel,
  AiFeedbackType,
  AiHealth,
  AiHistoryEntry,
  AiResult,
  AssistantAction,
  AssistantProvider,
} from "@/components/ai/use-ai-assistant-controller";
import { hasApuStructuredShape, hasAutocompleteStructuredShape, hasReviewStructuredShape } from "@/components/ai/use-ai-assistant-controller";
import { KhipuLogo } from "@/components/khipu/KhipuLogo";
import { KhipuQuickActions } from "@/components/khipu/KhipuQuickActions";
import type { KhipuQuickAction } from "@/components/khipu/KhipuQuickActions";
import { KhipuSymbol } from "@/components/khipu/KhipuSymbol";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AiApuStructuredData, AiAutocompleteStructuredData, AiReviewStructuredData } from "@/lib/ai/types";
import { isKhipuActionArray, getActionLabel, getActionDescription } from "@/lib/ai/actions";
import type { KhipuAction } from "@/lib/ai/actions";
import { useKhipuActionDispatcher } from "@/hooks/use-khipu-action-dispatcher";
import { useKhipuActionRegistry } from "@/components/ai/khipu-action-registry";
import { cn } from "@/lib/utils";
import { isLocalClientRuntimeEnabled } from "@/lib/runtime/local-capabilities";
import type { FloatingKhipuTheme } from "@/types/settings";

type AiAssistantPanelLayout = "page" | "floating";

type AiAssistantPanelProps = {

  controller: AiAssistantControllerViewModel;
  initialAutocompleteInput?: string;
  initialApuDescription?: string;
  initialApuUnit?: string;
  initialChatMessage?: string;
  initialReviewSummary?: string;
  layout: AiAssistantPanelLayout;
  projectId?: string;
  reducedMotion?: boolean;
  showHistory?: boolean;
  theme?: FloatingKhipuTheme;
};

const ACTIONS = [
  {
    id: "chat",
    label: "Chat técnico",
    description: "Resuelve dudas técnicas con contexto de obra.",
    icon: BotMessageSquare,
  },
  {
    id: "apu",
    label: "Generar APU",
    description: "Crea una propuesta revisable de recursos y rendimiento.",
    icon: Sparkles,
  },
  {
    id: "review",
    label: "Revisar presupuesto",
    description: "Detecta unidades, duplicados y costos sospechosos.",
    icon: FileSearch,
  },
  {
    id: "autocomplete",
    label: "Autocompletar",
    description: "Completa descripciones y especificaciones técnicas.",
    icon: WandSparkles,
  },
] as const;

const ACTION_HELPERS: Record<AssistantAction, string> = {
  chat: "Consulta criterios técnicos con el contexto activo.",
  apu: "Genera una propuesta editable de recursos y rendimiento.",
  review: "Revisa unidades, duplicados y costos sospechosos.",
  autocomplete: "Completa descripciones técnicas sin perder el contexto.",
};

const ACTION_SUGGESTIONS: Record<AssistantAction, string> = {
  chat: "¿Qué criterio técnico debería revisar en esta partida?",
  apu: "Genera una propuesta de APU para esta partida.",
  review: "Revisa unidades, duplicados y costos atípicos.",
  autocomplete: "Completa esta descripción técnica sin inventar especificaciones.",
};

const HISTORY_COLLAPSED_STORAGE_KEY = "myc-khipu-history-collapsed";

function readStoredHistoryCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(HISTORY_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function persistHistoryCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem(HISTORY_COLLAPSED_STORAGE_KEY, String(collapsed));
  } catch {
    // Best effort only
  }
}

export function AiAssistantPanel({
  controller,
  initialAutocompleteInput = "Excavacion manual en",
  initialApuDescription = "Concreto armado f'c=210 kg/cm2 para columnas",
  initialApuUnit = "m3",
  initialChatMessage = "Genera recomendaciones para revisar este APU.",
  initialReviewSummary = "Partida 01.02 Concreto f'c=210 m3 S/ 420. Partida 01.03 Concreto f'c=210 m2 S/ 415.",
  layout,
  projectId,
  reducedMotion = false,
  showHistory = false,
  theme = "light",
}: AiAssistantPanelProps) {
  const [chatMessage, setChatMessage] = useState(initialChatMessage);
  const [apuDescription, setApuDescription] = useState(initialApuDescription);
  const [apuUnit, setApuUnit] = useState(initialApuUnit);
  const [reviewSummary, setReviewSummary] = useState(initialReviewSummary);
  const [autocompleteInput, setAutocompleteInput] = useState(initialAutocompleteInput);
  const [confirmClear, setConfirmClear] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(() => readStoredHistoryCollapsed());

  useEffect(() => {
    persistHistoryCollapsed(historyCollapsed);
  }, [historyCollapsed]);

  // Auto-expand history when it becomes empty (e.g. after clearing)
  const prevHistoryLengthRef = useRef(controller.history.length);
  useEffect(() => {
    if (controller.history.length === 0 && prevHistoryLengthRef.current > 0) {
      setHistoryCollapsed(false);
    }
    prevHistoryLengthRef.current = controller.history.length;
  }, [controller.history.length]);

  // Dismiss clear confirmation when the active action changes
  const prevConfirmActionRef = useRef(controller.activeAction);
  useEffect(() => {
    if (controller.activeAction !== prevConfirmActionRef.current) {
      setConfirmClear(false);
      prevConfirmActionRef.current = controller.activeAction;
    }
  }, [controller.activeAction]);


  const dedupedHistory = useDedupedHistory(controller);
  const isFloatingDark = layout === "floating" && theme === "dark";

  const actionRegistry = useKhipuActionRegistry();
  const { executeAction, executingActionId } = useKhipuActionDispatcher({
    controller,
    onNavigate: actionRegistry.onNavigate,
    onOpenApuEditor: actionRegistry.onOpenApuEditor,
  });

  const setActiveAction = controller.setActiveAction;

  const quickStartActions: KhipuQuickAction[] = [
    {
      id: "analyze-budget",
      label: "Analizar presupuesto",
      description: "Detecta partidas que requieren revisión.",
      icon: Search,
      onSelect: () => setActiveAction("review"),
    },
    {
      id: "review-apu",
      label: "Revisar APU",
      description: "Evalúa insumos, rendimientos y coherencia técnica.",
      icon: FileSearch,
      onSelect: () => setActiveAction("apu"),
    },
    {
      id: "compare",
      label: "Comparar alternativas",
      description: "Compara soluciones y escenarios de costo.",
      icon: GitCompareArrows,
      onSelect: () => setActiveAction("chat"),
    },
    {
      id: "optimize",
      label: "Optimizar costos",
      description: "Sugiere alternativas para reducir costos.",
      icon: TrendingUp,
      onSelect: () => setActiveAction("chat"),
    },
    {
      id: "report",
      label: "Generar reporte",
      description: "Resume observaciones para el equipo técnico.",
      icon: FileText,
      onSelect: () => setActiveAction("chat"),
    },
    {
      id: "inconsistencies",
      label: "Detectar inconsistencias",
      description: "Identifica posibles errores en cantidades y unidades.",
      icon: Lightbulb,
      onSelect: () => setActiveAction("review"),
    },
  ];

  const actionButtons = useMemo(() => {
    const structuredData = controller.result?.structuredData;
    if (!isRecord(structuredData)) return [];
    const actions = structuredData.actions;
    return isKhipuActionArray(actions) ? actions : [];
  }, [controller.result?.structuredData]);

  const activeConfig = ACTIONS.find((action) => action.id === controller.activeAction) ?? ACTIONS[0];
  const ActiveIcon = activeConfig.icon;
  const activeHealth = useMemo(
    () => (controller.health ? controller.health.actions[controller.activeAction] : null),
    [controller.activeAction, controller.health],
  );
  const localPreparationVisible = isLocalClientRuntimeEnabled() && process.env.NODE_ENV === "development";
  const installedLocalModels = controller.health?.requiredModels.filter((model) => model.installed).length ?? 0;
  const totalLocalModels = controller.health?.requiredModels.length ?? 0;
  const providerStatus = readProviderStatus(
    controller.provider,
    controller.health?.status,
    controller.bridgeState,
    controller.cloudConfigured,
  );
  const providerOptions: AssistantProvider[] = isLocalClientRuntimeEnabled()
    ? ["ollama", "chatgpt-bridge", "openai", "gemini", "openrouter", "agent"]
    : ["chatgpt-bridge", "openai", "gemini", "openrouter", "agent"];
  const contextRows = [
    { label: "Proyecto", value: controller.context.project },
    { label: "Módulo", value: controller.context.module },
    { label: "Partida seleccionada", value: controller.context.selectedItem },
    { label: "Unidad", value: controller.context.unit },
    {
      label: "Costo actual",
      value: typeof controller.context.currentCost === "number" ? String(controller.context.currentCost) : undefined,
    },
    { label: "Tabla activa", value: controller.context.activeTable },
  ].filter((row): row is { label: string; value: string } => typeof row.value === "string" && row.value.trim().length > 0);

  const recommendedAction: AssistantAction = controller.context.selectedItem
    ? "review"
    : controller.context.project
      ? "review"
      : "chat";

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
    // History-only view: show just the ChatHistory with a clear button
    if (showHistory) {
      return (
        <div className={cn("space-y-3", isFloatingDark && "khipu-floating-dark")}>
          <ChatHistory
            history={controller.history}
            reducedMotion={reducedMotion}
            expandable
            truncateLength={200}
            theme={theme}
            feedbackByHistoryId={controller.feedbackByHistoryId}
          />
          <div className="flex justify-end">
            <ClearHistoryButton
              confirmClear={confirmClear}
              confirmLabel="¿Limpiar historial?"
              onCancel={() => setConfirmClear(false)}
              onClear={() => {
                controller.clearHistory();
                setConfirmClear(false);
              }}
              onRequestClear={() => setConfirmClear(true)}
            />
          </div>
        </div>
      );
    }

    // Normal floating view
    // Show greeting on initial state (no result, no error, no request yet)
    const showGreeting = !controller.result && !controller.error && !controller.loading;

    // Respect reduced motion preference: kill all animation durations
    const anim = (duration: number, delay = 0) =>
      reducedMotion
        ? { duration: 0 }
        : { duration, ease: "easeOut" as const, delay };

    // Staggered entry: greeting first, then context, then actions, then form
    const staggerDelays = showGreeting
      ? { greeting: 0, context: 0.08, actions: 0.16, form: 0.24 }
      : { context: 0, actions: 0.08, form: 0.16 };

    return (
      <div className={cn("space-y-3", isFloatingDark && "khipu-floating-dark")}>
        {/* Welcome greeting — compact */}
        {showGreeting ? (
          <motion.div
            initial={reducedMotion ? undefined : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={anim(0.35, staggerDelays.greeting)}
            className="flex items-center gap-2.5 rounded-xl border border-[var(--khipu-cyan)]/20 bg-gradient-to-br from-[var(--khipu-soft-blue)] to-[var(--khipu-soft-cyan)] px-3 py-2.5"
          >
            <KhipuSymbol className="h-6 w-6 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                Hola, soy Khipu
                {controller.provider === "agent" ? (
                  <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                    · {getAgentModelShortLabel(controller.agentModel)}
                    {getAgentModelCostEmoji(controller.agentModel) ? (
                      <span className="ml-0.5 text-[10px]">{getAgentModelCostEmoji(controller.agentModel)}</span>
                    ) : null}
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-slate-600">¿En qué puedo ayudarte hoy?</p>
            </div>
          </motion.div>
        ) : null}

        {/* Context section — compact */}
        <motion.div
          initial={reducedMotion ? undefined : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={anim(0.3, staggerDelays.context)}
        >                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{ACTION_HELPERS[controller.activeAction]}</p>
                    {controller.activeAction !== recommendedAction ? (
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-blue-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        onClick={() => controller.setActiveAction(recommendedAction)}
                      >
                        Sugerida: {ACTIONS.find((action) => action.id === recommendedAction)?.label}
                      </button>
                    ) : null}
                  </div>
          {contextRows.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {contextRows.slice(0, 3).map((row) => (
                <span key={row.label} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/70 px-2 py-1 text-[11px]">
                  <span className="font-semibold text-slate-500">{row.label}:</span>
                  <span className="font-medium text-slate-900">{row.value}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500">
              Selecciona un presupuesto, partida o APU para que Khipu pueda analizarlo con contexto.
            </p>
          )}
          {contextRows.length > 0 && contextRows.length <= 2 ? (
            <p className="mt-2 rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-1.5 text-[11px] leading-4 text-amber-800">
              Necesito más información — selecciona una partida, APU o incluye metrados.
            </p>
          ) : null}
        </motion.div>

        {/* Actions grid — compact pills */}
        <motion.div
          initial={reducedMotion ? undefined : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={anim(0.3, staggerDelays.actions)}
        >
          <div className="flex flex-wrap gap-1.5">
            {ACTIONS.map((action) => {
              const Icon = action.icon;
              const active = action.id === controller.activeAction;

              return (
                <button
                  key={action.id}
                  type="button"
                  aria-label={action.label}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all duration-200 hover:border-cyan-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60",
                    active ? "border-blue-300 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-600",
                  )}
                  onClick={() => controller.setActiveAction(action.id)}
                >
                  <Icon className={cn("h-3.5 w-3.5", active ? "text-blue-600" : "text-cyan-600")} />
                  {action.label}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Current result/error — compact preview (full response is in ChatHistory) */}
        {(controller.error || controller.result) ? (
          <div className="overflow-x-hidden break-words">
            {controller.error ? <AIMessage content={controller.error} tone="error" /> : null}
            {controller.result ? (
              <div className="space-y-2">
                <AIMessage
                  content={controller.result.answer}
                  model={controller.result.model}
                  streaming={controller.streaming}
                />
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  Revisión técnica requerida antes de aplicar al presupuesto.
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Khipu actions — executable buttons from structured response */}
        {actionButtons.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Acciones</p>
            <div className="flex flex-wrap gap-2">
              {actionButtons.map((action, index) => {
                const actionKey = `${action.type}-${index}`;
                return (
                <KhipuActionButton
                  key={actionKey}
                  action={action}
                  loading={executingActionId !== null}
                  onExecute={executeAction}
                />
              )})}
            </div>
          </div>
        ) : null}

        {/* Form — sticky at the bottom so it's always visible */}
        <div aria-live="polite" className="sticky bottom-0 space-y-3 bg-white pt-3">
          <AnimatePresence>
            {controller.loading && !controller.streaming ? (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={anim(0.25)}
              >
                <TypingIndicator />
              </motion.div>
            ) : null}
          </AnimatePresence>
          <motion.div
            initial={reducedMotion ? undefined : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={anim(0.3, staggerDelays.form)}
          >
            <form onSubmit={(event) => void handleSubmit(event)}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={controller.activeAction}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={anim(0.18)}
                >
                  {controller.activeAction === "chat" ? (
                    <div className="relative">
                      <Textarea
                        value={chatMessage}
                        onChange={(event) => setChatMessage(event.target.value)}
                        className="min-h-0 pr-14"
                        rows={3}
                        placeholder={ACTION_SUGGESTIONS.chat}
                      />
                      <button
                        type="submit"
                        aria-label="Enviar consulta"
                        disabled={controller.loading}
                        className={cn(
                          "btn-ripple absolute bottom-4 right-2.5 flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60",
                          controller.loading
                            ? "cursor-not-allowed bg-slate-300 text-slate-500"
                            : "bg-gradient-to-br from-[var(--khipu-blue)] to-[var(--khipu-cyan)] text-white shadow-sm hover:shadow-md hover:scale-110 active:scale-90",
                        )}
                      >
                        {controller.loading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  ) : null}
                  {controller.activeAction === "apu" ? (
                    <div className="space-y-2">
                      <Input
                        value={apuUnit}
                        onChange={(event) => setApuUnit(event.target.value)}
                        placeholder="Unidad (m3, m2, etc.)"
                      />
                      <div className="relative">
                        <Textarea
                          value={apuDescription}
                          onChange={(event) => setApuDescription(event.target.value)}
                          className="min-h-0 pr-14"
                          rows={3}
                          placeholder={ACTION_SUGGESTIONS.apu}
                        />
                        <button
                          type="submit"
                          aria-label="Generar APU"
                          disabled={controller.loading}
                          className={cn(
                            "btn-ripple absolute bottom-4 right-2.5 flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60",
                            controller.loading
                              ? "cursor-not-allowed bg-slate-300 text-slate-500"
                              : "bg-gradient-to-br from-[var(--khipu-blue)] to-[var(--khipu-cyan)] text-white shadow-sm hover:shadow-md hover:scale-110 active:scale-90",
                          )}
                        >
                          {controller.loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {controller.activeAction === "review" ? (
                    <div className="relative">
                      <Textarea
                        className="min-h-0 pr-14"
                        rows={3}
                        value={reviewSummary}
                        onChange={(event) => setReviewSummary(event.target.value)}
                        placeholder={ACTION_SUGGESTIONS.review}
                      />
                      <button
                        type="submit"
                        aria-label="Revisar presupuesto"
                        disabled={controller.loading}
                        className={cn(
                          "btn-ripple absolute bottom-4 right-2.5 flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60",
                          controller.loading
                            ? "cursor-not-allowed bg-slate-300 text-slate-500"
                            : "bg-gradient-to-br from-[var(--khipu-blue)] to-[var(--khipu-cyan)] text-white shadow-sm hover:shadow-md hover:scale-110 active:scale-90",
                        )}
                      >
                        {controller.loading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  ) : null}
                  {controller.activeAction === "autocomplete" ? (
                    <div className="relative">
                      <Textarea
                        value={autocompleteInput}
                        onChange={(event) => setAutocompleteInput(event.target.value)}
                        className="min-h-0 pr-14"
                        rows={3}
                        placeholder={ACTION_SUGGESTIONS.autocomplete}
                      />
                      <button
                        type="submit"
                        aria-label="Autocompletar"
                        disabled={controller.loading}
                        className={cn(
                          "btn-ripple absolute bottom-4 right-2.5 flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60",
                          controller.loading
                            ? "cursor-not-allowed bg-slate-300 text-slate-500"
                            : "bg-gradient-to-br from-[var(--khipu-blue)] to-[var(--khipu-cyan)] text-white shadow-sm hover:shadow-md hover:scale-110 active:scale-90",
                        )}
                      >
                        {controller.loading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  ) : null}
                </motion.div>
              </AnimatePresence>
            </form>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <Card className="border-[var(--app-border)] bg-[var(--app-surface)] shadow-sm">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl space-y-3">
                <KhipuLogo size="sm" showSubtitle={false} />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">Asistente técnico de obra</p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--app-text-strong)] md:text-4xl">
                    Presupuesta mejor con Khipu.
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--app-text-muted)] md:text-base">
                    Revisa APU, genera partidas y responde con contexto del presupuesto activo.
                  </p>
                </div>
              </div>
              <div className="grid gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-text-muted)]">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-[var(--app-text-strong)]">Proveedor activo</span>
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", providerStatus.className)}>
                    {providerStatus.label}
                  </span>
                </div>
                <p>
                  {readProviderLabel(controller.provider)}
                  {controller.provider === "agent" ? (
                    <span className="ml-1.5 text-[11px] font-medium text-[var(--app-text-muted)]">
                      · {getAgentModelShortLabel(controller.agentModel)}
                      {getAgentModelCostEmoji(controller.agentModel) ? (
                        <span className="ml-0.5 text-[10px]">{getAgentModelCostEmoji(controller.agentModel)}</span>
                      ) : null}
                    </span>
                  ) : null}
                </p>
                <Button variant="outline" size="sm" className="w-fit gap-2" onClick={() => void controller.refreshHealth()}>
                  <RefreshCw className="h-4 w-4" />
                  Actualizar estado
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5 xl:grid-cols-2">
          <Card className="border-[var(--app-border)] bg-[var(--app-surface)] shadow-sm">
            <CardContent className="space-y-3 p-5">
              <div>
                <p className="text-sm font-semibold text-[var(--app-text-strong)]">Trabajo activo</p>                <p className="mt-1 text-sm text-[var(--app-text-muted)]">Contexto de esta sesión.</p>
            </div>              {contextRows.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {contextRows.map((row) => (
                    <div key={row.label} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text-muted)]">{row.label}</p>
                      <p className="mt-1 truncate text-sm font-medium text-[var(--app-text-strong)]">{row.value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm text-[var(--app-text-muted)]">
                  Selecciona un presupuesto, partida o APU para comenzar.
                </p>
              )}
              {contextRows.length > 0 && contextRows.length <= 2 ? (
                <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  Falta contexto para una recomendación confiable. Selecciona una partida o agrega metrados.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-[var(--app-border)] bg-[var(--app-surface-muted)]">
            <CardContent className="grid gap-4 p-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">                <p className="text-sm font-semibold text-[var(--app-text-strong)]">Proveedor</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {providerOptions.map((provider) => (
                  <button
                    key={provider}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                      controller.provider === provider ? "border-blue-300 bg-[var(--app-primary-muted)] text-blue-800" : "border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)]",
                      (provider === "openai" || provider === "gemini" || provider === "openrouter" || provider === "agent") && !controller.cloudConfigured[provider] ? "opacity-60" : "",
                    )}
                    type="button"
                    aria-pressed={controller.provider === provider}
                    onClick={() => controller.setProvider(provider)}
                  >
                    {readProviderButtonLabel(provider)}
                  </button>
                ))}
              </div>
              {isLocalClientRuntimeEnabled() && controller.provider === "ollama" ? (
                <p className="mt-3 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                  Solo local
                </p>
              ) : null}
              {controller.provider === "chatgpt-bridge" ? (
                <p className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">
                  Estado: {readBridgeStateLabel(controller.bridgeState)}
                </p>
              ) : null}
              {controller.provider === "agent" && controller.cloudConfigured.agent ? (
                <div className="mt-3">
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text-muted)]">Modelo</label>
                  <select
                    className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm font-medium text-[var(--app-text-strong)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={controller.agentModel}
                    onChange={(e) => controller.setAgentModel(e.target.value)}
                  >
                    {AGENT_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {COST_EMOJI[m.cost]}{` ${m.label}`}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {(controller.provider === "openai" || controller.provider === "gemini" || controller.provider === "openrouter" || controller.provider === "agent") &&
              !controller.cloudConfigured[controller.provider] ? (
                <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  {readProviderButtonLabel(controller.provider)} no configurado. Revisa la Configuración para agregar tu API key.
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">                <p className="text-sm font-semibold text-[var(--app-text-strong)]">Acción activa</p>
              <p className="mt-1 text-sm text-[var(--app-text-muted)]">
                Modelo solicitado: <span className="font-medium text-[var(--app-text-strong)]">{readActiveModelLabel(controller.provider, activeHealth, controller.agentModel)}</span>
              </p>
              <p className="mt-1 text-sm text-[var(--app-text-muted)]">
                Modelo resuelto: <span className="font-medium text-[var(--app-text-strong)]">{readResolvedModelLabel(controller.provider, activeHealth, controller.agentModel)}</span>
              </p>
              <p className="mt-1 text-sm text-[var(--app-text-muted)]">
                Última latencia: <span className="font-medium text-[var(--app-text-strong)]">{readLatencyLabel(controller.provider, controller.health?.metrics[controller.activeAction]?.latencyMs)}</span>
              </p>
              {controller.provider === "ollama" && activeHealth?.fallbackUsed ? (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  Se utilizó un modelo alternativo para esta acción.
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
        </div>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            const active = action.id === controller.activeAction;

            return (
              <button
                key={action.id}
                className={cn(
                  "group flex min-h-24 items-start gap-3 rounded-2xl border p-4 text-left shadow-sm transition hover:border-cyan-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60",
                  active ? "border-blue-300 bg-[var(--app-primary-muted)] text-[var(--app-text-strong)]" : "border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)]",
                )}
                type="button"
                aria-label={action.label}
                aria-pressed={active}
                onClick={() => controller.setActiveAction(action.id)}
              >
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition group-hover:scale-105", active ? "bg-blue-600 text-white" : "bg-cyan-50 text-cyan-600")}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{action.label}</span>
                    {active && (action.id === recommendedAction || (!controller.context.project && action.id === "chat")) ? <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white">Recomendado</span> : null}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--app-text-muted)]">{action.description}</span>
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
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Ejecución</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">{activeConfig.label}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">{ACTION_HELPERS[controller.activeAction]}</p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
              {controller.activeAction === "chat" ? (
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  <span>Consulta técnica</span>
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
                  <span>Resumen del presupuesto</span>
                  <Textarea className="min-h-36" value={reviewSummary} onChange={(event) => setReviewSummary(event.target.value)} />
                </label>
              ) : null}
              {controller.activeAction === "autocomplete" ? (
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  <span>Texto base</span>
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

        <div className="grid gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm sm:grid-cols-3">
          <QualityMetric label="Aplicadas" value={controller.feedbackSummary.applied} />
          <QualityMetric label="Editadas" value={controller.feedbackSummary.edited} />
          <QualityMetric label="Descartadas" value={controller.feedbackSummary.dismissed} />
        </div>

        {controller.error ? <AIMessage content={controller.error} tone="error" /> : null}
        {controller.feedbackError ? <AIMessage content={controller.feedbackError} tone="error" /> : null}
        {controller.result ? (
          <div aria-live="polite" className="space-y-3">
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">Resultado de Khipu</p>
              <p className="mt-1 text-sm text-[var(--app-text-muted)]">Revisa el análisis y confirma cualquier cambio antes de aplicarlo.</p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <AIMessage
                content={controller.result.answer}
                model={controller.result.model}
                streaming={controller.streaming}
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-2" onClick={() => downloadKhipuResult(controller.result as AiResult, "json")}><Download className="h-4 w-4" />JSON</Button>
                <Button size="sm" variant="outline" className="gap-2" onClick={() => downloadKhipuResult(controller.result as AiResult, "csv")}><Download className="h-4 w-4" />CSV</Button>
              </div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
              Esta recomendación requiere revisión técnica antes de aplicarse al presupuesto.
            </div>
            {controller.activeFeedbackEntry ? (
              <FeedbackControls
                disabled={controller.pendingFeedbackByHistoryId[controller.activeFeedbackEntry.id] === true}
                selected={controller.feedbackByHistoryId[controller.activeFeedbackEntry.id]}
                onSelect={(feedbackType) => {
                  void controller.submitFeedback(controller.activeFeedbackEntry as AiHistoryEntry, feedbackType);
                }}
              />
            ) : null}
            {controller.result.evidence?.length ? (
              <Card>
                <CardContent className="space-y-3 p-5">
                  <div><p className="text-sm font-semibold text-[var(--app-text-strong)]">Fuentes consultadas</p><p className="mt-1 text-xs text-[var(--app-text-muted)]">Referencias utilizadas para orientar esta respuesta. Verifica su vigencia antes de aplicar cambios.</p></div>
                  <ul className="space-y-2">{controller.result.evidence.map((source) => <li key={source.id} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-3"><p className="text-sm font-medium text-[var(--app-text-strong)]">{source.title}</p><p className="mt-1 text-xs leading-5 text-[var(--app-text-muted)]">{source.excerpt}</p></li>)}</ul>
                </CardContent>
              </Card>
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
            {actionButtons.length > 0 ? (
              <Card>
                <CardContent className="space-y-3 p-5">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Acciones sugeridas</p>
                    <p className="mt-1 text-sm text-slate-500">Khipu sugiere estas acciones para continuar. Haz clic para ejecutarlas.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {actionButtons.map((action, index) => {
                      const actionKey = `${action.type}-${index}`;
                      return (
                      <KhipuActionButton
                        key={actionKey}
                        action={action}
                        loading={executingActionId !== null}
                        onExecute={executeAction}
                      />
                    )})}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}

        {dedupedHistory.length > 0 ? (
            <Card>
              <CardContent className="space-y-4 p-6">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={historyCollapsed ? "Expandir historial" : "Colapsar historial"}
                        className="flex items-center gap-1 transition hover:text-slate-600"
                        onClick={() => setHistoryCollapsed((c) => !c)}
                      >
                        <ChevronDown className={cn("h-4 w-4 transition-transform", historyCollapsed && "-rotate-90")} />
                      </button>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-950">Actividad reciente de Khipu</h3>
                      <p className="mt-1 text-sm text-slate-500">
                    {projectId
                      ? "Historial del proyecto; las respuestas de ChatGPT Bridge quedan solo en esta sesión."
                      : "Se guarda solo en este navegador para retomar resultados recientes; no es memoria del proyecto."}
                      {dedupedHistory.length > 0 ? (
                        <HistoryCountBadge className="ml-2 inline-flex items-center px-2 text-[11px]" count={dedupedHistory.length} />
                      ) : null}
                      </p>
                      </div>
                    </div>
                    <ClearHistoryButton
                      confirmClear={confirmClear}
                      confirmLabel="¿Limpiar historial?"
                      onCancel={() => setConfirmClear(false)}
                      onClear={() => {
                        controller.clearHistory();
                        setConfirmClear(false);
                      }}
                      onRequestClear={() => setConfirmClear(true)}
                    />
                  </div>
                </div>              <AnimatePresence>
                {!historyCollapsed ? (
                <motion.div
                  initial={reducedMotion ? undefined : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={reducedMotion ? undefined : { opacity: 0, height: 0 }}
                  transition={reducedMotion ? { duration: 0 } : { duration: 0.25, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                <ChatHistory
                  history={dedupedHistory}
                  maxHeight="max-h-96"
                  onSelect={controller.selectHistoryEntry}
                  reducedMotion={reducedMotion}
                  truncateLength={false}
                  feedbackByHistoryId={controller.feedbackByHistoryId}
                />
                </motion.div>
                ) : null}
              </AnimatePresence>
              </CardContent>
            </Card>
          ) : null}
      </div>

      <div className="space-y-5 xl:sticky xl:top-5 xl:self-start">
        <ContextSidebar context={controller.context} onChange={controller.setContext} />
        <Card className="border-[var(--app-border)] bg-[var(--app-surface)] shadow-sm">
          <CardContent className="space-y-3 p-5">
            <div>
              <p className="text-sm font-semibold text-[var(--app-text-strong)]">Inicio rápido</p>
              <p className="mt-1 text-sm text-[var(--app-text-muted)]">Acciones frecuentes para empezar a trabajar con Khipu.</p>
            </div>
            <KhipuQuickActions actions={quickStartActions} />
          </CardContent>
        </Card>
        {localPreparationVisible ? (
          <Card className="border-[var(--app-border)] bg-[var(--app-surface-muted)]">
            <CardContent className="space-y-3 p-5">
              <div>
                <p className="text-sm font-semibold text-[var(--app-text-strong)]">Preparación local</p>
                <p className="mt-1 text-sm text-[var(--app-text-muted)]">Estado de los modelos locales para ejecutar Khipu.</p>
                {totalLocalModels > 0 ? <p className="mt-2 text-xs font-semibold text-[var(--app-text-strong)]">Modelos disponibles: {installedLocalModels} de {totalLocalModels}.</p> : null}
              </div>
              <div className="grid gap-2">
                {(controller.health?.requiredModels ?? []).map((model) => (
                  <div key={model.model} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-semibold text-[var(--app-text-strong)]">{model.model}</p>
                    <span aria-label={model.installed ? "Modelo disponible" : "Modelo pendiente"} className={cn("shrink-0 text-[11px] font-semibold", model.installed ? "text-emerald-700" : "text-amber-700")}>
                      {model.installed ? "Listo" : "Pendiente"}
                    </span>
                  </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </section>
  );
}

function QualityMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text-muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[var(--app-text-strong)]">{value}</p>
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

function downloadKhipuResult(result: AiResult, format: "json" | "csv") {
  const payload = {
    exportedAt: new Date().toISOString(),
    answer: result.answer,
    provider: result.provider ?? "No especificado",
    model: result.model,
    requestedModel: result.requestedModel,
    latencyMs: result.latencyMs ?? null,
    warnings: result.warnings,
    structuredData: result.structuredData ?? null,
    evidence: result.evidence ?? [],
    trace: {
      requestId: result.requestId ?? null,
      promptHash: result.promptHash ?? null,
      responseHash: result.responseHash ?? null,
    },
  };
  const content = format === "json" ? JSON.stringify(payload, null, 2) : toCsv(payload);
  const blob = new Blob([content], { type: format === "json" ? "application/json;charset=utf-8" : "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `khipu-propuesta-${new Date().toISOString().slice(0, 10)}.${format}`;
  link.click();
  URL.revokeObjectURL(url);
}

function toCsv(payload: Record<string, unknown>): string {
  const rows = Object.entries(payload).filter(([, value]) => value !== null && typeof value !== "object");
  return ["Campo,Valor", ...rows.map(([key, value]) => `${escapeCsv(key)},${escapeCsv(String(value))}`)].join("\\n");
}

function escapeCsv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function renderStructuredResult(result: AiResult) {
  const structuredData = result.structuredData;

  if (!isRecord(structuredData)) {
    return null;
  }

  if (hasAutocompleteStructuredShape(structuredData)) {
    return <AutocompletePartidaCard data={structuredData} />;
  }

  if (hasApuStructuredShape(structuredData)) {
    return (
      <Card>
        <CardContent className="grid gap-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-2" onClick={() => downloadKhipuResult(result, "json")}><Download className="h-4 w-4" />JSON</Button>
              <Button size="sm" variant="outline" className="gap-2" onClick={() => downloadKhipuResult(result, "csv")}><Download className="h-4 w-4" />CSV</Button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[var(--app-text-strong)]">Propuesta de APU</h3>
              <p className="mt-1 text-sm text-[var(--app-text-muted)]">Revisa los recursos y rendimientos antes de incorporarlos al presupuesto.</p>
            </div>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Revisión requerida</span>
          </div>
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
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Aviso de precios</p>
            <p className="mt-1 text-sm leading-5 text-amber-900">
              No se generaron precios exactos porque deben validarse con tu catálogo, mercado local o base histórica.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (hasReviewStructuredShape(structuredData)) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <h3 className="text-lg font-semibold text-[var(--app-text-strong)]">Hallazgos de revisión</h3>
            <p className="mt-1 text-sm text-[var(--app-text-muted)]">Valida cada observación con los documentos y datos del proyecto.</p>
          </div>
          <div className="space-y-3">
            {structuredData.findings.map((finding, index) => (
              <div key={`${finding.description}-${index}`} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em]", readSeverityClass(finding.severity))}>
                    {finding.severity}
                  </span>
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--app-text-muted)]">{finding.type}</span>
                </div>
                <p className="mt-3 text-sm font-medium text-[var(--app-text-strong)]">{finding.description}</p>
                <p className="mt-2 text-sm text-[var(--app-text-muted)]">{finding.impact}</p>
                <p className="mt-2 text-sm text-[var(--app-text)]">Acción recomendada: {finding.recommendedAction}</p>
              </div>
            ))}
          </div>
          <StructuredTextList title="Supuestos" items={structuredData.assumptions} />
        </CardContent>
      </Card>
    );
  }

  return <GenericStructuredResult data={structuredData} />;
}function AutocompletePartidaCard({ data }: { data: AiAutocompleteStructuredData }) {
  const actionRegistry = useKhipuActionRegistry();
  const partida = data.suggestion;
  const isExisting = partida.matchType === "existing";

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">Partida sugerida</p>
            <h3 className="mt-1 text-lg font-semibold text-[var(--app-text-strong)]">{isExisting ? "Partida encontrada" : "Nueva partida propuesta"}</h3>
            <p className="mt-1 text-sm text-[var(--app-text-muted)]">Revisa los datos y confirma antes de incorporarla al presupuesto.</p>
          </div>
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", isExisting ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-amber-200 bg-amber-50 text-amber-800")}>
            {isExisting ? "Catálogo" : "Borrador"}
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <StructuredMetric label="Descripción" value={partida.description} />
          <StructuredMetric label="Unidad" value={partida.unit} />
          {partida.code ? <StructuredMetric label="Código" value={partida.code} /> : null}
          {partida.category ? <StructuredMetric label="Categoría" value={partida.category} /> : null}
          {partida.apuDescription ? <StructuredMetric label="APU asociado" value={partida.apuDescription} /> : null}
        </div>
        {partida.missingFields.length ? <StructuredTextList title="Datos por confirmar" items={partida.missingFields} /> : null}
        {data.assumptions.length ? <StructuredTextList title="Supuestos" items={data.assumptions} /> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="gap-2" onClick={() => actionRegistry.onOpenPartidaForm?.(partida)}><Pencil className="h-4 w-4" />{isExisting ? "Usar partida" : "Crear partida"}</Button>
          <Button type="button" variant="outline" onClick={() => actionRegistry.onOpenPartidaApu?.(partida)}>{partida.apuId ? "Ver APU" : "Generar APU"}</Button>
          <Button type="button" variant="outline" onClick={() => actionRegistry.onOpenPartidaForm?.(partida)}>Editar sugerencia</Button>
        </div>
        <p className="text-xs text-[var(--app-text-muted)]">La propuesta queda pendiente de confirmación técnica antes de guardarse.</p>
      </CardContent>
    </Card>
  );
}

function GenericStructuredResult({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([key]) => key !== "answer");
  if (!entries.length) return null;

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div>
          <h3 className="text-lg font-semibold text-[var(--app-text-strong)]">Detalles de la respuesta</h3>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">
            Información estructurada devuelta por ChatGPT Bridge para revisar el criterio técnico completo.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {entries.map(([key, value]) => (
            <GenericStructuredField key={key} label={formatStructuredLabel(key)} value={value} />
          ))}
        </div>
        <details className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--app-text-strong)]">Ver respuesta completa</summary>
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--app-surface)] p-3 text-xs leading-5 text-[var(--app-text)]">
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
      <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
        <p className="text-sm font-semibold text-[var(--app-text-strong)]">{label}</p>
        <ul className="mt-3 space-y-2 text-sm text-[var(--app-text)]">
          {value.map((item, index) => (
            <li key={`${label}-${index}`} className="rounded-xl bg-[var(--app-surface-muted)] px-3 py-2">
              {renderGenericValue(item)}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (isRecord(value)) {
    return (
      <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 lg:col-span-2">
        <p className="text-sm font-semibold text-[var(--app-text-strong)]">{label}</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {Object.entries(value).map(([nestedKey, nestedValue]) => (
            <GenericStructuredField key={nestedKey} label={formatStructuredLabel(nestedKey)} value={nestedValue} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
      <p className="text-sm font-semibold text-[var(--app-text-strong)]">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--app-text)]">{renderGenericValue(value)}</p>
    </div>
  );
}

function StructuredMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--app-text-muted)]">{label}</p>
      <p className="mt-2 text-sm font-medium text-[var(--app-text-strong)]">{value}</p>
    </div>
  );
}

function StructuredLineItems({ items, title }: { items: AiApuStructuredData["materials"]; title: string }) {
  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
      <p className="text-sm font-semibold text-[var(--app-text-strong)]">{title}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[360px] text-left text-xs">
          <thead className="border-b border-[var(--app-border)] text-[var(--app-text-muted)]">
            <tr><th className="pb-2 pr-3 font-semibold">Recurso</th><th className="pb-2 pr-3 font-semibold">Cantidad</th><th className="pb-2 font-semibold">Unidad</th></tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={`${item.description}-${index}`} className="border-b border-[var(--app-border-soft)] last:border-0">
                <td className="py-2 pr-3 font-medium text-[var(--app-text-strong)]">{item.description}{item.notes ? <span className="block text-[11px] font-normal text-[var(--app-text-muted)]">{item.notes}</span> : null}</td>
                <td className="py-2 pr-3 text-[var(--app-text)]">{item.quantity}</td>
                <td className="py-2 text-[var(--app-text)]">{item.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StructuredTextList({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
      <p className="text-sm font-semibold text-[var(--app-text-strong)]">{title}</p>
      <ul className="mt-3 space-y-2 text-sm text-[var(--app-text)]">
        {items.map((item) => (
          <li key={item} className="rounded-xl bg-[var(--app-surface-muted)] px-3 py-2">
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
  bridgeState: AiAssistantControllerViewModel["bridgeState"],
  cloudConfigured: AiAssistantControllerViewModel["cloudConfigured"],
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
  if (provider === "agent") return cloudConfigured.agent ? { label: "Agente listo", className: "bg-emerald-100 text-emerald-700" } : { label: "Agente sin key", className: "bg-amber-100 text-amber-800" };
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
  if (provider === "agent") return "Khipu Agente";
  return provider;
}

function readProviderButtonLabel(provider: AssistantProvider) {
  if (provider === "ollama") return "Ollama local";
  if (provider === "chatgpt-bridge") return "Bridge";
  if (provider === "openai") return "ChatGPT";
  if (provider === "gemini") return "Gemini";
  if (provider === "openrouter") return "OpenRouter";
  if (provider === "agent") return "Agente";
  return provider;
}

function readActiveModelLabel(provider: AssistantProvider, activeHealth: { requestedModel?: string } | null, agentModel?: string) {
  if (provider === "ollama") return activeHealth?.requestedModel ?? "Sin datos";
  if (provider === "chatgpt-bridge") return "ChatGPT web";
  if (provider === "openai") return "OpenAI API";
  if (provider === "gemini") return "Gemini API";
  if (provider === "openrouter") return "OpenRouter API";
  if (provider === "agent") return getAgentModelShortLabel(agentModel ?? "");
  return "Sin datos";
}

function readResolvedModelLabel(provider: AssistantProvider, activeHealth: { model?: string } | null, agentModel?: string) {
  if (provider === "ollama") return activeHealth?.model ?? "Sin datos";
  if (provider === "chatgpt-bridge") return "Pestana ChatGPT";
  if (provider === "openai") return "OpenAI API";
  if (provider === "gemini") return "Gemini API";
  if (provider === "openrouter") return "OpenRouter API";
  if (provider === "agent") return getAgentModelShortLabel(agentModel ?? "");
  return "Sin datos";
}

function readLatencyLabel(provider: AssistantProvider, latencyMs: number | null | undefined) {
  if (provider === "ollama") return typeof latencyMs === "number" ? `${latencyMs} ms` : "Sin ejecuciones";
  if (provider === "chatgpt-bridge") return "Depende de ChatGPT";
  if (provider === "openai" || provider === "gemini" || provider === "openrouter" || provider === "agent") return "Nube";
  return "Sin ejecuciones";
}

function readBridgeStateLabel(state: AiAssistantControllerViewModel["bridgeState"]) {
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
  if (provider === "agent") return loading ? "Consultando Agente" : "Enviar a Agente";
  if (streaming) return "Khipu respondiendo";
  return loading ? "Consultando IA local" : "Enviar a Ollama";
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

function KhipuActionButton({
  action,
  loading = false,
  onExecute,
}: {
  action: KhipuAction;
  loading?: boolean;
  onExecute: (action: KhipuAction) => Promise<boolean>;
}) {
  const label = getActionLabel(action);
  const description = getActionDescription(action);
  const icon = getActionIcon(action.type);

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={loading}
      className="gap-2 border-sky-200 bg-gradient-to-br from-sky-50 to-cyan-50 text-xs font-semibold text-sky-800 transition hover:border-sky-300 hover:from-sky-100 hover:to-cyan-100 hover:shadow-sm disabled:opacity-60"
      title={description}
      onClick={() => void onExecute(action)}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {label}
    </Button>
  );
}

function getActionIcon(type: KhipuAction["type"]) {
  switch (type) {
    case "navigate":
      return <ExternalLink className="h-4 w-4" />;
    case "open_apu_editor":
      return <Sparkles className="h-4 w-4" />;
    case "select_partida":
      return <Send className="h-4 w-4" />;
    case "fill_form":
      return <Pencil className="h-4 w-4" />;
    case "run_ai_action":
      return <BotMessageSquare className="h-4 w-4" />;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
