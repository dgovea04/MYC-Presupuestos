"use client";

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MYCBridgeState } from "@/lib/ai/myc-bridge-client";
import type {
  AiApuStructuredData,
  AiContext,
  AiEndpointResult,
  AiReviewStructuredData,
} from "@/lib/ai/types";

// ─── Module imports ─────────────────────────────────────────────

import { loadHealth, loadCloudStatus } from "@/components/ai/controller-health";
import {
  readStoredHistory,
  persistStoredHistoryAndSync,
  KHIPU_HISTORY_SYNCED_EVENT,
  KHIPU_FEEDBACK_SYNCED_EVENT,
  type KhipuHistorySyncedDetail,
  type KhipuFeedbackSyncedDetail,
  readStoredFeedback,
  persistStoredFeedbackAndSync,
  createEmptyFeedbackSummary,
  summarizeFeedbackState,
  updateFeedbackSummary,
  readFeedbackEntryForResult,
  loadProjectHistory,
  loadProjectFeedbackSummary,
  loadProjectLatestFeedback,
  readFeedbackErrorMessage,
} from "@/components/ai/controller-history";
import { submitStreamingChatRequest } from "@/components/ai/controller-streaming";
import {
  readHistoryScope,
  isSameHistoryScope,
  clearPendingBridgeTimeout,
  submitBridgeRequest,
  subscribeBridgeEvents,
  toBackendProvider,
  mapActionToKhipuTask,
  submitCloudRequest,
} from "@/components/ai/controller-providers";
import {
  isRecord,
  readErrorMessage,
  summarizeRequest,
  readAiResult,
  areAiContextsEqual,
} from "@/components/ai/controller-parsers";

// ─── Types ──────────────────────────────────────────────────────

export type AssistantAction = "chat" | "apu" | "review" | "autocomplete";
export type AssistantProvider = "ollama" | "chatgpt-bridge" | "openai" | "gemini" | "openrouter";
export type AiResult = AiEndpointResult;
export type AiFeedbackType = "APPLIED" | "EDITED" | "DISMISSED";
export type AiFeedbackState = Record<string, AiFeedbackType>;
export type AiFeedbackPendingState = Record<string, boolean>;

export type AiFeedbackSummary = {
  applied: number;
  edited: number;
  dismissed: number;
  total?: number;
};

export type AiHealth = {
  status: "ok" | "degraded" | "down";
  ollamaReachable: boolean;
  availableModels: string[];
  requiredModels: Array<{
    model: string;
    installed: boolean;
    actions: AssistantAction[];
  }>;
  actions: Record<
    AssistantAction,
    {
      model: string;
      requestedModel: string;
      fallbackUsed: boolean;
      warnings: string[];
    }
  >;
  metrics: Record<
    AssistantAction,
    {
      latencyMs: number | null;
      lastError: string | null;
    }
  >;
  providers: Record<"ollama" | "chatgpt_bridge" | "openai" | "gemini" | "openrouter", {
    configured: boolean;
    reachable: boolean | null;
  }>;
};

export type AiHistoryEntry = {
  id: string;
  action: AssistantAction;
  summary: string;
  context: AiContext;
  result: AiResult;
  timestamp: string;
};

export type AiResultWithHistory = AiResult & {
  historyEntry?: AiHistoryEntry;
};

export type AssistantRequest = {
  action: AssistantAction;
  payload: Record<string, unknown>;
};

export type AiAssistantControllerViewModel = {
  activeAction: AssistantAction;
  activeFeedbackEntry: AiHistoryEntry | null;
  clearHistory: () => void;
  bridgeState: MYCBridgeState | null;
  cloudConfigured: {
    openai: boolean;
    gemini: boolean;
    openrouter: boolean;
  };
  context: AiContext;
  error: string;
  feedbackByHistoryId: AiFeedbackState;
  feedbackError: string;
  feedbackSummary: AiFeedbackSummary;
  health: AiHealth | null;
  history: AiHistoryEntry[];
  lastRequest: AssistantRequest | null;
  loading: boolean;
  pendingFeedbackByHistoryId: AiFeedbackPendingState;
  provider: AssistantProvider;
  refreshHealth: () => Promise<void>;
  result: AiResultWithHistory | null;
  retryLastRequest: () => Promise<void>;
  selectHistoryEntry: (entry: AiHistoryEntry) => void;
  setActiveAction: (action: AssistantAction) => void;
  setContext: Dispatch<SetStateAction<AiContext>>;
  setProvider: (provider: AssistantProvider) => void;
  streaming: boolean;
  submit: (request: AssistantRequest) => Promise<void>;
  submitFeedback: (entry: AiHistoryEntry, feedbackType: AiFeedbackType) => Promise<void>;
};

export type StreamEvent =
  | { event: "delta"; data: { text: string } }
  | { event: "final"; data: AiResultWithHistory }
  | { event: "error"; data: { error: string } };

type HistoryScope =
  | { mode: "project"; projectId: string }
  | { mode: "session" };

type ScopedRequestState = {
  request: AssistantRequest;
  historyScope: HistoryScope;
};

type ProjectFeedbackState = {
  projectId: string;
  feedback: AiFeedbackState;
};

type ProjectFeedbackSummaryState = {
  projectId: string;
  summary: AiFeedbackSummary;
};

// ─── Hook ───────────────────────────────────────────────────────

const VALID_PROVIDERS = new Set(["ollama", "chatgpt-bridge", "openai", "gemini", "openrouter"]);

function readInitialProvider(raw?: string): AssistantProvider {
  if (typeof raw === "string" && VALID_PROVIDERS.has(raw)) return raw as AssistantProvider;
  if (raw === "auto") return "ollama";
  return "ollama";
}

function generateSyncSourceId() {
  return `khipu-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useAiAssistantController({
  projectId,
  initialAction,
  initialContext,
  initialProvider,
}: {
  projectId?: string;
  initialAction: AssistantAction;
  initialContext: AiContext;
  initialProvider?: string;
}): AiAssistantControllerViewModel {
  const syncSourceId = useRef(generateSyncSourceId());
  const [activeAction, setActiveActionState] = useState<AssistantAction>(initialAction);
  const [context, setContext] = useState<AiContext>(initialContext);
  const [result, setResult] = useState<AiResultWithHistory | null>(null);
  const [error, setError] = useState("");
  const [feedbackError, setFeedbackError] = useState("");
  const [history, setHistory] = useState<AiHistoryEntry[]>(() => readStoredHistory(projectId));
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [lastRequest, setLastRequest] = useState<AssistantRequest | null>(null);
  const [health, setHealth] = useState<AiHealth | null>(null);
  const [provider, setProviderState] = useState<AssistantProvider>(() => readInitialProvider(initialProvider));
  const [cloudConfigured, setCloudConfigured] = useState<{ openai: boolean; gemini: boolean; openrouter: boolean }>({
    openai: false,
    gemini: false,
    openrouter: false,
  });
  const [bridgeState, setBridgeState] = useState<MYCBridgeState | null>(null);
  const [sessionFeedbackByHistoryId, setSessionFeedbackByHistoryId] = useState<AiFeedbackState>(readStoredFeedback);
  const [projectFeedbackByHistoryId, setProjectFeedbackByHistoryId] = useState<ProjectFeedbackState | null>(null);
  const [pendingFeedbackByHistoryId, setPendingFeedbackByHistoryId] = useState<AiFeedbackPendingState>({});
  const [projectFeedbackSummary, setProjectFeedbackSummary] = useState<ProjectFeedbackSummaryState | null>(null);

  const latestHistoryScope = useRef<HistoryScope>(readHistoryScope(projectId));
  const pendingBridgeRequestId = useRef<string | null>(null);
  const pendingBridgeTimeoutId = useRef<number | null>(null);
  const latestBridgeRequest = useRef<ScopedRequestState | null>(null);
  const latestContext = useRef(context);

  const feedbackByHistoryId =
    projectId
      ? projectFeedbackByHistoryId?.projectId === projectId
        ? projectFeedbackByHistoryId.feedback
        : {}
      : sessionFeedbackByHistoryId;

  const sessionFeedbackSummary = useMemo(
    () => summarizeFeedbackState(sessionFeedbackByHistoryId),
    [sessionFeedbackByHistoryId],
  );

  const feedbackSummary =
    projectId
      ? projectFeedbackSummary?.projectId === projectId
        ? projectFeedbackSummary.summary
        : createEmptyFeedbackSummary()
      : sessionFeedbackSummary;

  const activeFeedbackEntry = result ? readFeedbackEntryForResult(result, history) : null;

  useEffect(() => {
    latestHistoryScope.current = readHistoryScope(projectId);
  }, [projectId]);

  useEffect(() => {
    latestContext.current = context;
  }, [context]);

  const previousInitialContextRef = useRef(initialContext);

  useEffect(() => {
    setContext((current) => (
      areAiContextsEqual(current, previousInitialContextRef.current)
        ? initialContext
        : current
    ));
    previousInitialContextRef.current = initialContext;
  }, [initialContext]);

  useEffect(() => {
    void loadHealth(setHealth, setCloudConfigured);
    void loadCloudStatus(setCloudConfigured);
  }, []);

  // Sync history from other controller instances (floating ↔ page)
  useEffect(() => {
    function handleSync(event: Event) {
      const detail = (event as CustomEvent<KhipuHistorySyncedDetail>).detail;
      if (!detail || detail.sourceId === syncSourceId.current) return;
      // Only sync when both controllers share the same scope (both session or same project)
      if (detail.projectId !== projectId) return;
      // Use functional update with same-reference bailout to avoid infinite loops
      setHistory((current) => {
        if (
          current.length === detail.history.length &&
          current[0]?.id === detail.history[0]?.id &&
          current[current.length - 1]?.id === detail.history[detail.history.length - 1]?.id
        ) {
          return current; // React bails out when returning same reference
        }
        return detail.history;
      });
    }

    window.addEventListener(KHIPU_HISTORY_SYNCED_EVENT, handleSync);
    return () => window.removeEventListener(KHIPU_HISTORY_SYNCED_EVENT, handleSync);
  }, [projectId]);

  useEffect(() => {
    persistStoredHistoryAndSync(history, syncSourceId.current, projectId);
  }, [history, projectId]);

  // Sync feedback from other controller instances (floating ↔ page)
  useEffect(() => {
    function handleFeedbackSync(event: Event) {
      const detail = (event as CustomEvent<KhipuFeedbackSyncedDetail>).detail;
      if (!detail || detail.sourceId === syncSourceId.current) return;
      if (projectId) return; // Project-scoped feedback doesn't use localStorage sync
      setSessionFeedbackByHistoryId((current) => {
        // Same-reference bailout to avoid infinite loops
        const currentKeys = Object.keys(current);
        const detailKeys = Object.keys(detail.feedback);
        if (
          currentKeys.length === detailKeys.length &&
          currentKeys.every((key) => current[key] === detail.feedback[key])
        ) {
          return current;
        }
        return detail.feedback;
      });
    }

    window.addEventListener(KHIPU_FEEDBACK_SYNCED_EVENT, handleFeedbackSync);
    return () => window.removeEventListener(KHIPU_FEEDBACK_SYNCED_EVENT, handleFeedbackSync);
  }, [projectId]);

  useEffect(() => {
    if (!projectId) persistStoredFeedbackAndSync(sessionFeedbackByHistoryId, syncSourceId.current);
  }, [projectId, sessionFeedbackByHistoryId]);

  useEffect(() => {
    let active = true;
    if (!projectId) return () => { active = false; };
    void Promise.all([loadProjectHistory(projectId), loadProjectFeedbackSummary(projectId)]).then(async ([entries, summaryResult]) => {
      const feedback = await loadProjectLatestFeedback(projectId, entries.map((entry) => entry.id));
      if (!active) return;
      // Server is source of truth when it has entries; otherwise keep local cache
      setHistory((current) => {
        if (entries.length > 0) return entries;
        return current;
      });
      setProjectFeedbackByHistoryId({ projectId, feedback });
      setProjectFeedbackSummary({
        projectId,
        summary: summaryResult.ok ? summaryResult.summary : createEmptyFeedbackSummary(),
      });
    });
    return () => { active = false; };
  }, [projectId]);

  useEffect(() => {
    return subscribeBridgeEvents({
      latestBridgeRequest,
      latestContext,
      latestHistoryScope,
      pendingBridgeRequestId,
      pendingBridgeTimeoutId,
      setBridgeState,
      setError,
      setHistory,
      setLoading,
      setResult,
    });
  }, []);

  async function submit(request: AssistantRequest) {
    setLoading(true);
    setStreaming(false);
    setError("");
    setResult(null);
    setLastRequest(request);
    const requestHistoryScope = readHistoryScope(projectId);

    if (provider === "chatgpt-bridge") {
      latestBridgeRequest.current = { request, historyScope: requestHistoryScope };
      submitBridgeRequest({
        pendingBridgeRequestId,
        pendingBridgeTimeoutId,
        latestBridgeRequest,
        request,
        setError,
        setLoading,
      });
      return;
    }

    if (provider === "openai" || provider === "gemini" || provider === "openrouter") {
      await submitCloudRequest({
        context,
        provider,
        request,
        requestHistoryScope,
        setError,
        setHistory,
        setLoading,
        setResult,
        latestHistoryScope,
      });
      return;
    }

    try {
      if (request.action === "chat") {
        const streamed = await submitStreamingChatRequest({
          context,
          provider,
          request,
          requestHistoryScope,
          setHistory,
          setResult,
          setStreaming,
          latestHistoryScope,
        });
        if (streamed) {
          void loadHealth(setHealth, setCloudConfigured);
          return;
        }
      }

      const response = await fetch(`/api/ai/${request.action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          requestHistoryScope.mode === "project"
            ? { ...request.payload, provider: toBackendProvider(provider), projectId: requestHistoryScope.projectId }
            : { ...request.payload, provider: toBackendProvider(provider) },
        ),
      });
      const payload: unknown = await response.json();

      if (!response.ok) throw new Error(readErrorMessage(payload));

      const nextResult = readAiResult(payload);
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

      setResult(nextHistoryEntry ? { ...nextResult, historyEntry: nextHistoryEntry } : nextResult);
      if (nextHistoryEntry && isSameHistoryScope(requestHistoryScope, latestHistoryScope.current)) {
        setHistory((current) => [nextHistoryEntry, ...current]);
      }
      void loadHealth(setHealth, setCloudConfigured);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No se pudo completar la solicitud de IA.");
      void loadHealth(setHealth, setCloudConfigured);
    } finally {
      setStreaming(false);
      setLoading(false);
    }
  }

  async function refreshHealth() {
    await loadHealth(setHealth, setCloudConfigured);
  }

  async function retryLastRequest() {
    if (!lastRequest) return;
    await submit(lastRequest);
  }

  function setProvider(nextProvider: AssistantProvider) {
    setProviderState(nextProvider);
    pendingBridgeRequestId.current = null;
    latestBridgeRequest.current = null;
    clearPendingBridgeTimeout(pendingBridgeTimeoutId);
    setStreaming(false);
    setLoading(false);
    setError("");
    setResult(null);
  }

  function setActiveAction(action: AssistantAction) {
    setActiveActionState(action);
    setResult(null);
    setError("");
    setStreaming(false);
  }

  function selectHistoryEntry(entry: AiHistoryEntry) {
    setActiveActionState(entry.action);
    setContext(entry.context);
    setResult({ ...entry.result, historyEntry: entry });
    setError("");
    setFeedbackError("");
  }

  async function submitFeedback(entry: AiHistoryEntry, feedbackType: AiFeedbackType) {
    setFeedbackError("");

    if (pendingFeedbackByHistoryId[entry.id]) return;

    if (!projectId) {
      setSessionFeedbackByHistoryId((current) => ({ ...current, [entry.id]: feedbackType }));
      return;
    }

    const previousFeedback = feedbackByHistoryId[entry.id];
    setPendingFeedbackByHistoryId((current) => ({ ...current, [entry.id]: true }));
    setProjectFeedbackByHistoryId((current) => ({
      projectId,
      feedback: {
        ...(current?.projectId === projectId ? current.feedback : {}),
        [entry.id]: feedbackType,
      },
    }));
    setProjectFeedbackSummary((current) => ({
      projectId,
      summary: updateFeedbackSummary(
        current?.projectId === projectId ? current.summary : createEmptyFeedbackSummary(),
        previousFeedback,
        feedbackType,
      ),
    }));

    try {
      const response = await fetch(`/api/projects/${projectId}/ai-history/${entry.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackType }),
      });
      const payload: unknown = await response.json();

      if (!response.ok || !isRecord(payload)) {
        throw new Error(readFeedbackErrorMessage(payload));
      }

      const reconciledSummary = await loadProjectFeedbackSummary(projectId);
      if (reconciledSummary.ok) {
        setProjectFeedbackSummary({ projectId, summary: reconciledSummary.summary });
      }
    } catch (caughtError) {
      setProjectFeedbackByHistoryId((current) => {
        const next = current?.projectId === projectId ? { ...current.feedback } : {};
        if (previousFeedback) next[entry.id] = previousFeedback;
        else delete next[entry.id];
        return { projectId, feedback: next };
      });
      setProjectFeedbackSummary((current) => ({
        projectId,
        summary: updateFeedbackSummary(
          current?.projectId === projectId ? current.summary : createEmptyFeedbackSummary(),
          feedbackType,
          previousFeedback,
        ),
      }));
      setFeedbackError(
        caughtError instanceof Error ? caughtError.message : "No se pudo registrar la metrica de calidad.",
      );
    } finally {
      setPendingFeedbackByHistoryId((current) => {
        const next = { ...current };
        delete next[entry.id];
        return next;
      });
    }
  }

  return {
    activeAction,
    activeFeedbackEntry,
    bridgeState,
    cloudConfigured,
    context,
    error,
    feedbackByHistoryId,
    feedbackError,
    feedbackSummary,
    health,
    history,
    lastRequest,
    loading,
    pendingFeedbackByHistoryId,
    provider,
    result,
    setActiveAction,
    setContext,
    setProvider,
    clearHistory() {
      setHistory([]);
      persistStoredHistoryAndSync([], syncSourceId.current, projectId);
    },
    refreshHealth,
    retryLastRequest,
    selectHistoryEntry,
    streaming,
    submit,
    submitFeedback,
  };
}

// ─── Exported shape validators ─────────────────────────────────

export function hasApuStructuredShape(value: Record<string, unknown>): value is AiApuStructuredData {
  return (
    typeof value.unit === "string" &&
    Array.isArray(value.materials) &&
    Array.isArray(value.labor) &&
    Array.isArray(value.equipment) &&
    Array.isArray(value.observations) &&
    Array.isArray(value.assumptions)
  );
}

export function hasReviewStructuredShape(value: Record<string, unknown>): value is AiReviewStructuredData {
  return Array.isArray(value.findings) && Array.isArray(value.assumptions);
}
