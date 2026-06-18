"use client";

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  onMYCBridgeResponse,
  onMYCBridgeState,
  sendToMYCChatGPTBridge,
  type MYCBridgeResponse,
  type MYCBridgeState,
} from "@/lib/ai/myc-bridge-client";
import { APU_OUTPUT_JSON_SHAPE, REVIEW_OUTPUT_JSON_SHAPE } from "@/lib/ai/prompts";
import { buildBridgeTaskPayload } from "@/lib/ai/task-payloads";
import type {
  AiApuStructuredData,
  AiContext,
  AiEndpointResult,
  AiMessage,
  AiReviewStructuredData,
} from "@/lib/ai/types";

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

type StreamEvent =
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

type AiFeedbackSummaryLoadResult =
  | { ok: true; summary: AiFeedbackSummary }
  | { ok: false };

const AI_HISTORY_STORAGE_KEY = "myc-ai-session-history";
const AI_FEEDBACK_STORAGE_KEY = "myc-ai-session-feedback";

export function useAiAssistantController({
  projectId,
  initialAction,
  initialContext,
}: {
  projectId?: string;
  initialAction: AssistantAction;
  initialContext: AiContext;
}): AiAssistantControllerViewModel {
  const [activeAction, setActiveActionState] = useState<AssistantAction>(initialAction);
  const [context, setContext] = useState<AiContext>(initialContext);
  const [result, setResult] = useState<AiResultWithHistory | null>(null);
  const [error, setError] = useState("");
  const [feedbackError, setFeedbackError] = useState("");
  const [history, setHistory] = useState<AiHistoryEntry[]>(() => (projectId ? [] : readStoredHistory()));
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [lastRequest, setLastRequest] = useState<AssistantRequest | null>(null);
  const [health, setHealth] = useState<AiHealth | null>(null);
  const [provider, setProviderState] = useState<AssistantProvider>("ollama");
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

  useEffect(() => {
    if (!projectId) {
      persistStoredHistory(history);
    }
  }, [history, projectId]);

  useEffect(() => {
    if (!projectId) {
      persistStoredFeedback(sessionFeedbackByHistoryId);
    }
  }, [projectId, sessionFeedbackByHistoryId]);

  useEffect(() => {
    let active = true;

    if (!projectId) {
      return () => {
        active = false;
      };
    }

    void Promise.all([loadProjectHistory(projectId), loadProjectFeedbackSummary(projectId)]).then(async ([entries, summaryResult]) => {
      const feedback = await loadProjectLatestFeedback(projectId, entries.map((entry) => entry.id));

      if (!active) {
        return;
      }

      setHistory(entries);
      setProjectFeedbackByHistoryId({ projectId, feedback });
      setProjectFeedbackSummary({
        projectId,
        summary: summaryResult.ok ? summaryResult.summary : createEmptyFeedbackSummary(),
      });
    });

    return () => {
      active = false;
    };
  }, [projectId]);

  useEffect(() => {
    const unsubscribeResponse = onMYCBridgeResponse((response) => {
      if (response.requestId && pendingBridgeRequestId.current && response.requestId !== pendingBridgeRequestId.current) {
        return;
      }

      clearPendingBridgeTimeout(pendingBridgeTimeoutId);
      pendingBridgeRequestId.current = null;
      setLoading(false);

      if (response.error) {
        setError(response.error);
        latestBridgeRequest.current = null;
        return;
      }

      const nextResult = readBridgeAiResult(response);
      const scopedRequest = latestBridgeRequest.current;
      latestBridgeRequest.current = null;

      if (scopedRequest && isSameHistoryScope(scopedRequest.historyScope, latestHistoryScope.current)) {
        const nextHistoryEntry =
          scopedRequest.historyScope.mode === "session"
            ? {
                id: `${Date.now()}-${scopedRequest.request.action}-chatgpt-bridge`,
                action: scopedRequest.request.action,
                summary: summarizeRequest(scopedRequest.request),
                context: latestContext.current,
                result: nextResult,
                timestamp: new Date().toISOString(),
              }
            : null;

        if (nextHistoryEntry) {
          setResult({ ...nextResult, historyEntry: nextHistoryEntry });
          setHistory((current) => [nextHistoryEntry, ...current]);
          return;
        }
      }

      setResult(nextResult);
    });

    const unsubscribeState = onMYCBridgeState(setBridgeState);

    return () => {
      unsubscribeResponse();
      unsubscribeState();
      clearPendingBridgeTimeout(pendingBridgeTimeoutId);
    };
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

      if (!response.ok) {
        throw new Error(readErrorMessage(payload));
      }

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
    if (!lastRequest) {
      return;
    }

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

    if (pendingFeedbackByHistoryId[entry.id]) {
      return;
    }

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
        if (previousFeedback) {
          next[entry.id] = previousFeedback;
        } else {
          delete next[entry.id];
        }
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
    refreshHealth,
    retryLastRequest,
    selectHistoryEntry,
    streaming,
    submit,
    submitFeedback,
  };
}

async function loadHealth(
  setHealth: (value: AiHealth | null) => void,
  setCloudConfigured: (value: (current: { openai: boolean; gemini: boolean; openrouter: boolean }) => {
    openai: boolean;
    gemini: boolean;
    openrouter: boolean;
  }) => void,
) {
  try {
    const response = await fetch("/api/ai/health");
    const payload: unknown = await response.json();

    if (!response.ok) {
      throw new Error(readErrorMessage(payload));
    }

    const nextHealth = readAiHealth(payload);
    setHealth(nextHealth);
    setCloudConfigured((current) => ({
      ...current,
      openrouter: nextHealth.providers?.openrouter?.configured === true,
    }));
  } catch {
    setHealth(null);
  }
}

async function loadCloudStatus(
  setCloudConfigured: (value: (current: { openai: boolean; gemini: boolean; openrouter: boolean }) => {
    openai: boolean;
    gemini: boolean;
    openrouter: boolean;
  }) => void,
) {
  try {
    const response = await fetch("/api/settings/ai-provider");
    if (!response.ok) return;
    const payload: unknown = await response.json();
    if (isRecord(payload)) {
      setCloudConfigured((current) => ({
        openai: payload.openaiConfigured === true,
        gemini: payload.geminiConfigured === true,
        openrouter: payload.openrouterConfigured === true || current.openrouter,
      }));
    }
  } catch {
    // Best effort only
  }
}

function submitBridgeRequest({
  latestBridgeRequest,
  pendingBridgeRequestId,
  pendingBridgeTimeoutId,
  request,
  setError,
  setLoading,
}: {
  latestBridgeRequest: MutableRefObject<ScopedRequestState | null>;
  pendingBridgeRequestId: MutableRefObject<string | null>;
  pendingBridgeTimeoutId: MutableRefObject<number | null>;
  request: AssistantRequest;
  setError: (value: string) => void;
  setLoading: (value: boolean) => void;
}) {
  try {
    const requestId = sendToMYCChatGPTBridge(buildBridgePrompt(request), {
      source: "myc-presupuestos",
      provider: "chatgpt-bridge",
      action: request.action,
    });

    pendingBridgeRequestId.current = requestId;
    clearPendingBridgeTimeout(pendingBridgeTimeoutId);
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

async function submitStreamingChatRequest({
  context,
  latestHistoryScope,
  provider,
  request,
  requestHistoryScope,
  setHistory,
  setResult,
  setStreaming,
}: {
  context: AiContext;
  latestHistoryScope: MutableRefObject<HistoryScope>;
  provider: AssistantProvider;
  request: AssistantRequest;
  requestHistoryScope: HistoryScope;
  setHistory: Dispatch<SetStateAction<AiHistoryEntry[]>>;
  setResult: (value: AiResultWithHistory | null) => void;
  setStreaming: (value: boolean) => void;
}) {
  try {
    const requestBody = JSON.stringify(
      requestHistoryScope.mode === "project"
        ? { ...request.payload, provider: toBackendProvider(provider), projectId: requestHistoryScope.projectId }
        : { ...request.payload, provider: toBackendProvider(provider) },
    );

    setStreaming(true);
    await waitForStreamPaint();
    let receivedFinal = false;
    let streamedAnswer = "";

    const handleStreamEvent = (event: StreamEvent) => {
      if (event.event === "delta") {
        streamedAnswer += event.data.text;
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

      setResult(nextHistoryEntry ? { ...event.data, historyEntry: nextHistoryEntry } : event.data);
      if (nextHistoryEntry && isSameHistoryScope(requestHistoryScope, latestHistoryScope.current)) {
        setHistory((current) => [nextHistoryEntry, ...current]);
      }
    };

    const streamStarted = await readStreamingChatEvents("/api/ai/chat/stream", requestBody, handleStreamEvent);
    if (!streamStarted) {
      return false;
    }

    return receivedFinal;
  } catch {
    setStreaming(false);
    return false;
  }
}

async function submitCloudRequest({
  context,
  latestHistoryScope,
  provider,
  request,
  requestHistoryScope,
  setError,
  setHistory,
  setLoading,
  setResult,
}: {
  context: AiContext;
  latestHistoryScope: MutableRefObject<HistoryScope>;
  provider: "openai" | "gemini" | "openrouter";
  request: AssistantRequest;
  requestHistoryScope: HistoryScope;
  setError: (value: string) => void;
  setHistory: Dispatch<SetStateAction<AiHistoryEntry[]>>;
  setLoading: (value: boolean) => void;
  setResult: (value: AiResultWithHistory | null) => void;
}) {
  try {
    const body: Record<string, unknown> = {
      provider,
      task: mapActionToKhipuTask(request.action),
      payload: request.payload,
    };

    if (requestHistoryScope.mode === "project") {
      body.projectId = requestHistoryScope.projectId;
    }

    const response = await fetch("/api/ai/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload: unknown = await response.json();

    if (!response.ok) {
      throw new Error(readErrorMessage(payload));
    }

    const nextResult = readAiResult(payload);
    const nextHistoryEntry =
      requestHistoryScope.mode === "session"
        ? {
            id: `${Date.now()}-${request.action}-cloud`,
            action: request.action,
            summary: summarizeRequest(request),
            context,
            result: nextResult,
            timestamp: new Date().toISOString(),
          }
        : null;

    setResult(nextHistoryEntry ? { ...nextResult, historyEntry: nextHistoryEntry } : nextResult);
    if (nextHistoryEntry && isSameHistoryScope(requestHistoryScope, latestHistoryScope.current)) {
      setHistory((current) => [nextHistoryEntry, ...current]);
    }
  } catch (caughtError) {
    setError(caughtError instanceof Error ? caughtError.message : "No se pudo completar la solicitud de IA.");
  } finally {
    setLoading(false);
  }
}

function toBackendProvider(frontend: AssistantProvider): "ollama" | "chatgpt_bridge" | "openai" | "gemini" | "openrouter" {
  return frontend === "chatgpt-bridge" ? "chatgpt_bridge" : frontend;
}

function mapActionToKhipuTask(action: AssistantAction): "chat" | "generate_apu" | "review_budget" | "autocomplete" {
  if (action === "apu") return "generate_apu";
  if (action === "review") return "review_budget";
  return action;
}

function clearPendingBridgeTimeout(pendingBridgeTimeoutId: MutableRefObject<number | null>) {
  if (pendingBridgeTimeoutId.current) {
    window.clearTimeout(pendingBridgeTimeoutId.current);
    pendingBridgeTimeoutId.current = null;
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

async function readStreamingChatEvents(url: string, body: string, onEvent: (event: StreamEvent) => void) {
  if (shouldUseXhrStreaming()) {
    return readXhrStreamEvents(url, body, onEvent);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!response.ok || !response.body) {
    return false;
  }

  await readStreamEvents(response, onEvent);
  return true;
}

function shouldUseXhrStreaming() {
  return typeof window !== "undefined" && typeof window.XMLHttpRequest !== "undefined" && process.env.NODE_ENV !== "test";
}

async function readXhrStreamEvents(url: string, body: string, onEvent: (event: StreamEvent) => void) {
  return new Promise<boolean>((resolve, reject) => {
    const request = new window.XMLHttpRequest();
    let cursor = 0;
    let buffer = "";
    let settled = false;

    const settle = (value: boolean) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const processText = () => {
      const nextText = request.responseText.slice(cursor);
      cursor = request.responseText.length;
      buffer = processStreamText(`${buffer}${nextText}`, onEvent);
    };

    request.open("POST", url, true);
    request.setRequestHeader("Content-Type", "application/json");
    request.setRequestHeader("Accept", "text/event-stream");
    request.onprogress = () => {
      try {
        processText();
      } catch (error) {
        request.abort();
        reject(error);
      }
    };
    request.onload = () => {
      try {
        if (request.status < 200 || request.status >= 300) {
          settle(false);
          return;
        }

        processText();
        const finalEvent = readStreamEvent(buffer);
        if (finalEvent) {
          onEvent(finalEvent);
        }
        settle(true);
      } catch (error) {
        reject(error);
      }
    };
    request.onerror = () => settle(false);
    request.onabort = () => settle(false);
    request.send(body);
  });
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
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        const event = readStreamEvent(frame);
        if (event) {
          onEvent(event);
          await waitForStreamPaint();
        }
      }
    }

    buffer += decoder.decode();
    const finalEvent = readStreamEvent(buffer);
    if (finalEvent) {
      onEvent(finalEvent);
      await waitForStreamPaint();
    }
  } finally {
    reader.releaseLock();
  }
}

function processStreamText(text: string, onEvent: (event: StreamEvent) => void) {
  const frames = text.split("\n\n");
  const nextBuffer = frames.pop() ?? "";

  for (const frame of frames) {
    const event = readStreamEvent(frame);
    if (event) {
      onEvent(event);
    }
  }

  return nextBuffer;
}

async function waitForStreamPaint() {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
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

function buildBridgePrompt(request: AssistantRequest): Record<string, unknown> {
  const taskPayload = buildBridgeTaskPayload({ action: request.action, payload: request.payload });
  const shape = getBridgeOutputShape(request.action);

  if (!shape) return { ...taskPayload };

  return {
    ...taskPayload,
    output: {
      ...taskPayload.output,
      shape,
    },
  };
}

function getBridgeOutputShape(action: AssistantAction): Record<string, unknown> | null {
  if (action === "apu") return APU_OUTPUT_JSON_SHAPE;
  if (action === "review") return REVIEW_OUTPUT_JSON_SHAPE;
  return null;
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

function readFeedbackErrorMessage(payload: unknown) {
  if (isRecord(payload) && typeof payload.error === "string") {
    return payload.error;
  }

  return "No se pudo registrar la metrica de calidad.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createEmptyFeedbackSummary(): AiFeedbackSummary {
  return { applied: 0, edited: 0, dismissed: 0 };
}

function summarizeFeedbackState(state: AiFeedbackState): AiFeedbackSummary {
  return Object.values(state).reduce(
    (summary, feedbackType) => updateFeedbackSummary(summary, undefined, feedbackType),
    createEmptyFeedbackSummary(),
  );
}

function updateFeedbackSummary(
  summary: AiFeedbackSummary,
  previous: AiFeedbackType | undefined,
  next: AiFeedbackType | undefined,
): AiFeedbackSummary {
  const updated = { ...summary };
  if (previous === "APPLIED") updated.applied -= 1;
  if (previous === "EDITED") updated.edited -= 1;
  if (previous === "DISMISSED") updated.dismissed -= 1;
  if (next === "APPLIED") updated.applied += 1;
  if (next === "EDITED") updated.edited += 1;
  if (next === "DISMISSED") updated.dismissed += 1;

  return {
    applied: Math.max(0, updated.applied),
    edited: Math.max(0, updated.edited),
    dismissed: Math.max(0, updated.dismissed),
    total: updated.total,
  };
}

function readStoredFeedback(): AiFeedbackState {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(AI_FEEDBACK_STORAGE_KEY) ?? "{}");
    if (!isRecord(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, AiFeedbackType] => isFeedbackType(entry[1])),
    );
  } catch {
    return {};
  }
}

function persistStoredFeedback(feedback: AiFeedbackState) {
  try {
    window.localStorage.setItem(AI_FEEDBACK_STORAGE_KEY, JSON.stringify(feedback));
  } catch {
    // Best effort only
  }
}

function isFeedbackType(value: unknown): value is AiFeedbackType {
  return value === "APPLIED" || value === "EDITED" || value === "DISMISSED";
}

function readFeedbackEntryForResult(result: AiResultWithHistory, history: AiHistoryEntry[]) {
  if (result.historyEntry) {
    return result.historyEntry;
  }

  return history.find((entry) => entry.result === result) ?? null;
}

function readHistoryScope(projectId: string | undefined): HistoryScope {
  return projectId ? { mode: "project", projectId } : { mode: "session" };
}

function isSameHistoryScope(left: HistoryScope, right: HistoryScope) {
  if (left.mode !== right.mode) return false;
  if (left.mode === "session") return true;
  return right.mode === "project" && left.projectId === right.projectId;
}

async function loadProjectHistory(projectId: string) {
  try {
    const response = await fetch(`/api/projects/${projectId}/ai-history`);
    if (!response.ok) return [];

    const payload: unknown = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.entries)) return [];

    return payload.entries.map(readHistoryEntry).filter((entry): entry is AiHistoryEntry => entry !== null);
  } catch {
    return [];
  }
}

async function loadProjectFeedbackSummary(projectId: string): Promise<AiFeedbackSummaryLoadResult> {
  try {
    const response = await fetch(`/api/projects/${projectId}/ai-feedback/summary`);
    if (!response.ok) return { ok: false };

    const payload: unknown = await response.json();
    if (!isRecord(payload) || !isRecord(payload.summary)) return { ok: false };

    return { ok: true, summary: readFeedbackSummary(payload.summary) };
  } catch {
    return { ok: false };
  }
}

async function loadProjectLatestFeedback(projectId: string, historyEntryIds: string[]) {
  if (historyEntryIds.length === 0) {
    return {};
  }

  const query = new URLSearchParams();
  for (const historyEntryId of historyEntryIds) {
    query.append("historyEntryId", historyEntryId);
  }

  try {
    const response = await fetch(`/api/projects/${projectId}/ai-feedback/latest?${query.toString()}`);
    if (!response.ok) return {};

    const payload: unknown = await response.json();
    if (!isRecord(payload) || !isRecord(payload.feedbackByHistoryId)) return {};

    return Object.fromEntries(
      Object.entries(payload.feedbackByHistoryId).filter(
        (entry): entry is [string, AiFeedbackType] => typeof entry[0] === "string" && isFeedbackType(entry[1]),
      ),
    );
  } catch {
    return {};
  }
}

function readFeedbackSummary(value: Record<string, unknown>): AiFeedbackSummary {
  return {
    applied: typeof value.applied === "number" ? value.applied : 0,
    edited: typeof value.edited === "number" ? value.edited : 0,
    dismissed: typeof value.dismissed === "number" ? value.dismissed : 0,
    total: typeof value.total === "number" ? value.total : undefined,
  };
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
  if (!result) return null;

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
    debug: readAiDebug(value.debug),
  };
}

function readAiDebug(value: unknown): AiEndpointResult["debug"] | undefined {
  if (!isRecord(value)) return undefined;
  const status = value.structuredParseStatus;
  if (status !== "not_requested" && status !== "parsed" && status !== "repaired" && status !== "failed") {
    return undefined;
  }

  return {
    structuredParseStatus: status,
    rawAnswer: typeof value.rawAnswer === "string" ? value.rawAnswer : undefined,
    repairedRawAnswer: typeof value.repairedRawAnswer === "string" ? value.repairedRawAnswer : undefined,
    context: value.context,
    messages: Array.isArray(value.messages) ? value.messages.filter(isAiMessage) : undefined,
    ai: isRecord(value.ai) && typeof value.ai.answer === "string"
      ? {
          answer: value.ai.answer,
          rawAnswer: typeof value.ai.rawAnswer === "string" ? value.ai.rawAnswer : undefined,
          repairedRawAnswer: typeof value.ai.repairedRawAnswer === "string" ? value.ai.repairedRawAnswer : undefined,
          structuredParseStatus: readStructuredParseStatus(value.ai.structuredParseStatus) ?? status,
        }
      : undefined,
    fallback: isRecord(value.fallback) && typeof value.fallback.used === "boolean"
      ? {
          used: value.fallback.used,
          reason: typeof value.fallback.reason === "string" ? value.fallback.reason : undefined,
        }
      : undefined,
    validationWarnings: Array.isArray(value.validationWarnings)
      ? value.validationWarnings.filter((warning): warning is string => typeof warning === "string")
      : undefined,
    requestBody: isRecord(value.requestBody) ? value.requestBody : undefined,
  };
}

function readStructuredParseStatus(value: unknown): NonNullable<AiEndpointResult["debug"]>["structuredParseStatus"] | undefined {
  return value === "not_requested" || value === "parsed" || value === "repaired" || value === "failed" ? value : undefined;
}

function isAiMessage(value: unknown): value is AiMessage {
  return isRecord(value) &&
    (value.role === "system" || value.role === "user" || value.role === "assistant") &&
    typeof value.content === "string";
}

function readHistoryAction(action: string): AssistantAction {
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

function summarizeRequest(request: AssistantRequest) {
  if (request.action === "chat") return String(request.payload.message ?? "Consulta tecnica");
  if (request.action === "apu") return String(request.payload.description ?? "Generacion de APU");
  if (request.action === "review") return String(request.payload.budgetSummary ?? "Revision de presupuesto").slice(0, 140);
  return String(request.payload.input ?? "Autocompletado tecnico");
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

function persistStoredHistory(history: AiHistoryEntry[]) {
  try {
    window.localStorage.setItem(AI_HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 8)));
  } catch {
    // Best effort only
  }
}

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

function areAiContextsEqual(left: AiContext, right: AiContext) {
  return left.project === right.project &&
    left.module === right.module &&
    left.selectedItem === right.selectedItem &&
    left.unit === right.unit &&
    left.currentCost === right.currentCost &&
    left.activeTable === right.activeTable;
}
