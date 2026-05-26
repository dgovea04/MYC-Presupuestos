import type { AiMessage } from "@/lib/ai/types";

type FetchLike = typeof fetch;

type AskOllamaInput = {
  model: string;
  messages: AiMessage[];
  responseFormat?: "json";
  timeoutMs?: number;
  fetchImpl?: FetchLike;
};

type OllamaTagsPayload = {
  models?: Array<{
    name?: string;
    model?: string;
  }>;
};

export class OllamaConnectionError extends Error {
  constructor() {
    super("No se pudo conectar con Ollama. Verifica que Ollama este activo en http://localhost:11434 y que el modelo este descargado.");
    this.name = "OllamaConnectionError";
  }
}

export class OllamaResponseError extends Error {
  constructor(message = "Ollama devolvio una respuesta invalida.") {
    super(message);
    this.name = "OllamaResponseError";
  }
}

export class OllamaTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Ollama tardo mas de ${Math.round(timeoutMs / 1000)} segundos en responder. Intenta nuevamente o usa un modelo mas ligero para JSON.`);
    this.name = "OllamaTimeoutError";
  }
}

export function parseOllamaAnswer(payload: unknown) {
  if (!isRecord(payload)) {
    throw new OllamaResponseError();
  }

  const message = payload.message;
  if (!isRecord(message) || typeof message.content !== "string") {
    throw new OllamaResponseError();
  }

  return message.content.trim();
}

const DEFAULT_OLLAMA_TIMEOUT_MS = 90_000;
const DEFAULT_JSON_NUM_PREDICT = 900;
const DEFAULT_CHAT_NUM_PREDICT = 1_200;

export async function askOllama({
  model,
  messages,
  responseFormat,
  timeoutMs = DEFAULT_OLLAMA_TIMEOUT_MS,
  fetchImpl = fetch,
}: AskOllamaInput) {
  let response: Response;
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    response = await fetchImpl(getOllamaChatUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: abortController.signal,
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: {
          temperature: responseFormat ? 0 : 0.2,
          num_predict: responseFormat ? DEFAULT_JSON_NUM_PREDICT : DEFAULT_CHAT_NUM_PREDICT,
        },
        ...(responseFormat ? { format: responseFormat } : {}),
      }),
    });
  } catch (error) {
    if (abortController.signal.aborted) {
      throw new OllamaTimeoutError(timeoutMs);
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new OllamaTimeoutError(timeoutMs);
    }

    throw new OllamaConnectionError();
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new OllamaResponseError(`Ollama respondio con estado ${response.status}.`);
  }

  const payload: unknown = await response.json();
  return parseOllamaAnswer(payload);
}

export async function listInstalledOllamaModels(fetchImpl = fetch) {
  let response: Response;

  try {
    response = await fetchImpl(getOllamaTagsUrl(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch {
    throw new OllamaConnectionError();
  }

  if (!response.ok) {
    throw new OllamaResponseError(`Ollama respondio con estado ${response.status}.`);
  }

  const payload = (await response.json()) as OllamaTagsPayload;
  const models = Array.isArray(payload.models) ? payload.models : [];

  return models
    .map((model) => model.name ?? model.model ?? "")
    .map((model) => model.trim())
    .filter((model) => model.length > 0);
}

function getOllamaChatUrl() {
  const baseUrl = process.env.OLLAMA_BASE_URL?.replace(/\/$/, "") || "http://localhost:11434";
  return `${baseUrl}/api/chat`;
}

function getOllamaTagsUrl() {
  const baseUrl = process.env.OLLAMA_BASE_URL?.replace(/\/$/, "") || "http://localhost:11434";
  return `${baseUrl}/api/tags`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
