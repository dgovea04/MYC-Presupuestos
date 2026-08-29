import type { AiEndpointResult } from "@/lib/ai/types";
import type { AiContext } from "@/lib/ai/types";
import type {
  AiHistoryEntry,
  AiResult,
  AiResultWithHistory,
  AssistantAction,
  AssistantRequest,
} from "@/components/ai/use-ai-assistant-controller";

// ─── Guards ─────────────────────────────────────────────────────

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readErrorMessage(payload: unknown) {
  if (isRecord(payload) && typeof payload.error === "string") return payload.error;
  return "No se pudo completar la solicitud de IA.";
}

// ─── Request summary ────────────────────────────────────────────

export function summarizeRequest(request: AssistantRequest) {
  if (request.action === "chat") return String(request.payload.message ?? "Consulta técnica");
  if (request.action === "apu") return String(request.payload.description ?? "Generacion de APU");
  if (request.action === "review") return String(request.payload.budgetSummary ?? "Revision de presupuesto").slice(0, 140);
  return String(request.payload.input ?? "Autocompletado técnico");
}

// ─── AI result parsing ─────────────────────────────────────────

export function readAiResult(payload: unknown): AiResultWithHistory {
  const result = readHistoryResult(payload);
  if (!result || !isRecord(payload)) {
    throw new Error("La respuesta de IA no tiene el formato esperado.");
  }
  const historyEntry = readHistoryEntry(payload.historyEntry);
  return historyEntry ? { ...result, historyEntry } : result;
}

export function readHistoryEntry(value: unknown): AiHistoryEntry | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.action !== "string" ||
    typeof value.summary !== "string" ||
    typeof value.timestamp !== "string" ||
    !isRecord(value.result)
  ) return null;

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

export function readHistoryResult(value: unknown): AiResult | null {
  if (
    !isRecord(value) ||
    typeof value.answer !== "string" ||
    typeof value.model !== "string" ||
    typeof value.requestedModel !== "string" ||
    typeof value.fallbackUsed !== "boolean" ||
    !Array.isArray(value.warnings)
  ) return null;

  return {
    answer: value.answer,
    model: value.model,
    requestedModel: value.requestedModel,
    fallbackUsed: value.fallbackUsed,
    warnings: value.warnings.filter((warning): warning is string => typeof warning === "string"),
    latencyMs: typeof value.latencyMs === "number" ? value.latencyMs : undefined,
    structuredData: value.structuredData,
    evidence: readAiEvidence(value.evidence),
    provider: typeof value.provider === "string" ? value.provider as AiEndpointResult["provider"] : undefined,
    requestId: typeof value.requestId === "string" ? value.requestId : undefined,
    promptHash: typeof value.promptHash === "string" ? value.promptHash : undefined,
    responseHash: typeof value.responseHash === "string" ? value.responseHash : undefined,
    debug: readAiDebug(value.debug),
  };
}

function readAiEvidence(value: unknown): AiEndpointResult["evidence"] {
  if (!Array.isArray(value)) return undefined;
  const evidence = value.filter((item): item is Record<string, unknown> => isRecord(item)).flatMap((item) => {
    if (typeof item.id !== "string" || typeof item.title !== "string" || typeof item.excerpt !== "string" || typeof item.sourceType !== "string") return [];
    return [{ id: item.id, sourceType: item.sourceType, title: item.title, excerpt: item.excerpt, score: typeof item.score === "number" ? item.score : undefined, metadata: isRecord(item.metadata) ? readEvidenceMetadata(item.metadata) : undefined }];
  });
  return evidence.length > 0 ? evidence : undefined;
}

function readEvidenceMetadata(value: Record<string, unknown>): Record<string, string | number | boolean> {
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string | number | boolean] => typeof entry[1] === "string" || typeof entry[1] === "number" || typeof entry[1] === "boolean"));
}

export function readAiDebug(value: unknown): AiEndpointResult["debug"] | undefined {
  if (!isRecord(value)) return undefined;
  const status = value.structuredParseStatus;
  if (status !== "not_requested" && status !== "parsed" && status !== "repaired" && status !== "failed") return undefined;

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
      ? { used: value.fallback.used, reason: typeof value.fallback.reason === "string" ? value.fallback.reason : undefined }
      : undefined,
    validationWarnings: Array.isArray(value.validationWarnings)
      ? value.validationWarnings.filter((warning): warning is string => typeof warning === "string")
      : undefined,
    requestBody: isRecord(value.requestBody) ? value.requestBody : undefined,
  };
}

export function readStructuredParseStatus(value: unknown): NonNullable<AiEndpointResult["debug"]>["structuredParseStatus"] | undefined {
  return value === "not_requested" || value === "parsed" || value === "repaired" || value === "failed" ? value : undefined;
}

// ─── Message / action parsing ──────────────────────────────────

type AiMessage = import("@/lib/ai/types").AiMessage;

export function isAiMessage(value: unknown): value is AiMessage {
  return isRecord(value) &&
    (value.role === "system" || value.role === "user" || value.role === "assistant") &&
    typeof value.content === "string";
}

export function readHistoryAction(action: string): AssistantAction {
  if (action === "apu" || action === "review" || action === "autocomplete") return action;
  return "chat";
}

// ─── Context parsing ────────────────────────────────────────────

export function readAiContext(value: unknown): AiContext {
  if (!isRecord(value)) return {};
  return {
    route: typeof value.route === "string" ? value.route : undefined,
    projectId: typeof value.projectId === "string" ? value.projectId : undefined,
    budgetId: typeof value.budgetId === "string" ? value.budgetId : undefined,
    project: typeof value.project === "string" ? value.project : undefined,
    module: typeof value.module === "string" ? value.module : undefined,
    selectedItem: typeof value.selectedItem === "string" ? value.selectedItem : undefined,
    selectionType:
      value.selectionType === "project" ||
        value.selectionType === "budget" ||
        value.selectionType === "partida" ||
        value.selectionType === "resource" ||
        value.selectionType === "metrado"
        ? value.selectionType
        : undefined,
    selectionId: typeof value.selectionId === "string" ? value.selectionId : undefined,
    unit: typeof value.unit === "string" ? value.unit : undefined,
    currentCost: typeof value.currentCost === "number" ? value.currentCost : undefined,
    activeTable: typeof value.activeTable === "string" ? value.activeTable : undefined,
    viewSummary: typeof value.viewSummary === "string" ? value.viewSummary : undefined,
  };
}

export function areAiContextsEqual(left: AiContext, right: AiContext) {
  return left.route === right.route &&
    left.projectId === right.projectId &&
    left.budgetId === right.budgetId &&
    left.project === right.project &&
    left.module === right.module &&
    left.selectedItem === right.selectedItem &&
    left.selectionType === right.selectionType &&
    left.selectionId === right.selectionId &&
    left.unit === right.unit &&
    left.currentCost === right.currentCost &&
    left.activeTable === right.activeTable &&
    left.viewSummary === right.viewSummary;
}
