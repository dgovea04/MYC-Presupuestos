import type { AiContext } from "@/lib/ai/types";
import type { AiHistoryEntry, AiResultWithHistory, AssistantRequest, StreamEvent } from "@/components/ai/use-ai-assistant-controller";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import {
  isRecord,
  readAiResult,
  summarizeRequest,
} from "@/components/ai/controller-parsers";

type HistoryScope =
  | { mode: "project"; projectId: string }
  | { mode: "session" };

function readStreamEvent(frame: string): StreamEvent | null {
  const lines = frame
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const eventLine = lines.find((line) => line.startsWith("event:"));
  const dataLine = lines.find((line) => line.startsWith("data:"));

  if (!eventLine || !dataLine) return null;

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

async function waitForStreamPaint() {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

function shouldUseXhrStreaming() {
  return typeof window !== "undefined" && typeof window.XMLHttpRequest !== "undefined" && process.env.NODE_ENV !== "test";
}

async function readStreamEventsFromReader(response: Response, onEvent: (event: StreamEvent) => void) {
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
    if (event) onEvent(event);
  }

  return nextBuffer;
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
        if (finalEvent) onEvent(finalEvent);
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

async function readStreamingChatEvents(url: string, body: string, onEvent: (event: StreamEvent) => void) {
  if (shouldUseXhrStreaming()) {
    return readXhrStreamEvents(url, body, onEvent);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!response.ok || !response.body) return false;

  await readStreamEventsFromReader(response, onEvent);
  return true;
}

function isSameHistoryScope(left: HistoryScope, right: HistoryScope) {
  if (left.mode !== right.mode) return false;
  if (left.mode === "session") return true;
  return right.mode === "project" && left.projectId === right.projectId;
}

function toBackendProvider(frontend: "ollama" | "chatgpt-bridge" | "openai" | "gemini" | "openrouter"): "ollama" | "chatgpt_bridge" | "openai" | "gemini" | "openrouter" {
  return frontend === "chatgpt-bridge" ? "chatgpt_bridge" : frontend;
}

export async function submitStreamingChatRequest({
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
  provider: "ollama" | "chatgpt-bridge" | "openai" | "gemini" | "openrouter";
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
    if (!streamStarted) return false;

    return receivedFinal;
  } catch {
    setStreaming(false);
    return false;
  }
}
