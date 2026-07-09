import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import {
  onMYCBridgeResponse,
  onMYCBridgeState,
  sendToMYCChatGPTBridge,
  type MYCBridgeResponse,
  type MYCBridgeState,
} from "@/lib/ai/myc-bridge-client";
import { APU_OUTPUT_JSON_SHAPE, REVIEW_OUTPUT_JSON_SHAPE } from "@/lib/ai/prompts";
import { buildBridgeTaskPayload } from "@/lib/ai/task-payloads";
import type { AiContext } from "@/lib/ai/types";
import type {
  AiHistoryEntry,
  AiResult,
  AiResultWithHistory,
  AssistantAction,
  AssistantRequest,
} from "@/components/ai/use-ai-assistant-controller";
import {
  isRecord,
  readErrorMessage,
  summarizeRequest,
  readAiResult,
} from "@/components/ai/controller-parsers";

type HistoryScope =
  | { mode: "project"; projectId: string }
  | { mode: "session" };

type ScopedRequestState = {
  request: AssistantRequest;
  historyScope: HistoryScope;
};

export function readHistoryScope(projectId: string | undefined): HistoryScope {
  return projectId ? { mode: "project", projectId } : { mode: "session" };
}

export function isSameHistoryScope(left: HistoryScope, right: HistoryScope) {
  if (left.mode !== right.mode) return false;
  if (left.mode === "session") return true;
  return right.mode === "project" && left.projectId === right.projectId;
}

export function clearPendingBridgeTimeout(timeoutRef: MutableRefObject<number | null>) {
  if (timeoutRef.current) {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }
}

// ─── Bridge ─────────────────────────────────────────────────────

function readAnswerFromBridgeJson(value: unknown) {
  if (!isRecord(value)) return null;
  return typeof value.answer === "string" ? value.answer : null;
}

export function readBridgeAiResult(response: MYCBridgeResponse): AiResult {
  const structuredData = response.jsonValid ? response.json : undefined;
  const answerFromJson = readAnswerFromBridgeJson(structuredData);
  const answer = answerFromJson ?? response.raw ?? "ChatGPT Bridge devolvio una respuesta sin contenido legible.";
  const warnings = response.jsonValid === false ? ["La respuesta de ChatGPT Bridge no parece JSON valido."] : [];
  return { answer, model: "ChatGPT Bridge", requestedModel: "ChatGPT web", fallbackUsed: false, warnings, structuredData };
}

function buildBridgePrompt(request: AssistantRequest): Record<string, unknown> {
  const taskPayload = buildBridgeTaskPayload({ action: request.action, payload: request.payload });
  const shape = getBridgeOutputShape(request.action);
  if (!shape) return { ...taskPayload };
  return { ...taskPayload, output: { ...taskPayload.output, shape } };
}

function getBridgeOutputShape(action: AssistantAction): Record<string, unknown> | null {
  if (action === "apu") return APU_OUTPUT_JSON_SHAPE;
  if (action === "review") return REVIEW_OUTPUT_JSON_SHAPE;
  return null;
}

export function submitBridgeRequest({
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
      if (pendingBridgeRequestId.current !== requestId) return;
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

export function subscribeBridgeEvents({
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
}: {
  latestBridgeRequest: MutableRefObject<ScopedRequestState | null>;
  latestContext: MutableRefObject<AiContext>;
  latestHistoryScope: MutableRefObject<HistoryScope>;
  pendingBridgeRequestId: MutableRefObject<string | null>;
  pendingBridgeTimeoutId: MutableRefObject<number | null>;
  setBridgeState: (state: MYCBridgeState | null) => void;
  setError: (error: string) => void;
  setHistory: Dispatch<SetStateAction<AiHistoryEntry[]>>;
  setLoading: (loading: boolean) => void;
  setResult: (result: AiResultWithHistory | null) => void;
}) {
  const unsubscribeResponse = onMYCBridgeResponse((response) => {
    if (response.requestId && pendingBridgeRequestId.current && response.requestId !== pendingBridgeRequestId.current) return;

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
}

// ─── Cloud ──────────────────────────────────────────────────────

export function toBackendProvider(frontend: "ollama" | "chatgpt-bridge" | "openai" | "gemini" | "openrouter" | "agent"): "ollama" | "chatgpt_bridge" | "openai" | "gemini" | "openrouter" | "agent" {
  return frontend === "chatgpt-bridge" ? "chatgpt_bridge" : frontend;
}

export function mapActionToKhipuTask(action: AssistantAction): "chat" | "generate_apu" | "review_budget" | "autocomplete" {
  if (action === "apu") return "generate_apu";
  if (action === "review") return "review_budget";
  return action;
}

export async function submitCloudRequest({
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
  provider: "openai" | "gemini" | "openrouter" | "agent";
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
    if (requestHistoryScope.mode === "project") body.projectId = requestHistoryScope.projectId;

    const response = await fetch("/api/ai/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload: unknown = await response.json();
    if (!response.ok) throw new Error(readErrorMessage(payload));

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
