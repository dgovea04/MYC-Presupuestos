# Khipu Chat Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real streaming for Khipu Chat tecnico through a dedicated stream route while preserving existing non-streaming AI flows.

**Architecture:** Keep `POST /api/ai/chat` unchanged and add `POST /api/ai/chat/stream` for Ollama chat streaming. Implement streaming as a narrow path: Ollama async iterable -> chat streaming service -> SSE-style route -> `AIWorkspace` partial rendering and final history commit.

**Tech Stack:** Next.js App Router, TypeScript strict, Vitest, Fetch/ReadableStream APIs, Ollama `/api/chat` streaming, existing Khipu AI services and project history helpers.

---

## File Structure

- Modify: `lib/ai/ollama.ts`
  - Add streaming chunk parsing and `streamOllamaChat`.
- Modify: `lib/ai/ollama.test.ts`
  - Cover streaming request body, chunk parsing, malformed chunks, timeout/connection behavior.
- Modify: `lib/ai/service.ts`
  - Export `estimateAiTokens` and add `streamChatAiResponse`.
- Create: `lib/ai/service-streaming.test.ts`
  - Mock Ollama/model/usage/runtime dependencies and test streamed accumulation plus final metadata.
- Create: `app/api/ai/chat/stream/route.ts`
  - New streaming chat endpoint.
- Create: `app/api/ai/chat/stream/route.test.ts`
  - Test SSE-style `delta`, `final`, and `error` events.
- Modify: `components/ai/AIWorkspace.tsx`
  - Use streaming only for Ollama chat, render partial text, commit history on final, fallback to non-streaming on pre-final failure.
- Modify: `components/ai/AIWorkspace.bridge.test.tsx`
  - Add UI tests for partial streaming, final history, fallback, and keep existing provider behavior.

Do not modify:

- Budget/APU calculation files.
- S10 import/export files.
- Structured-output parsing for APU/review/autocomplete.
- `app/api/ai/apu/route.ts`, `review`, `autocomplete`, or `apu/generate` route behavior.
- Existing unrelated dirty files:
  - `app/dashboard/page.tsx`
  - `components/budget/budget-editor.tsx`
  - `lib/dashboard/onboarding.test.ts`
  - `lib/dashboard/onboarding.ts`

---

### Task 1: Add Ollama Chat Streaming Adapter

**Files:**
- Modify: `lib/ai/ollama.ts`
- Modify: `lib/ai/ollama.test.ts`

- [ ] **Step 1: Add failing streaming tests**

In `lib/ai/ollama.test.ts`, update the import:

```ts
import {
  askOllama,
  OllamaConnectionError,
  OllamaResponseError,
  OllamaTimeoutError,
  parseOllamaAnswer,
  parseOllamaStreamLine,
  streamOllamaChat,
} from "@/lib/ai/ollama";
```

Add these tests inside `describe("Ollama service", () => { ... })`:

```ts
  it("parses Ollama streaming lines into text deltas", () => {
    expect(parseOllamaStreamLine(JSON.stringify({ message: { content: "Hola" }, done: false }))).toEqual({
      done: false,
      text: "Hola",
    });
    expect(parseOllamaStreamLine(JSON.stringify({ done: true }))).toEqual({ done: true, text: "" });
    expect(parseOllamaStreamLine("")).toBeNull();
  });

  it("rejects malformed Ollama streaming lines", () => {
    expect(() => parseOllamaStreamLine("{bad json")).toThrow(OllamaResponseError);
    expect(() => parseOllamaStreamLine(JSON.stringify({ message: { content: 12 } }))).toThrow(OllamaResponseError);
  });

  it("streams chat deltas from Ollama", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(`${JSON.stringify({ message: { content: "Hola " }, done: false })}\n`));
        controller.enqueue(encoder.encode(`${JSON.stringify({ message: { content: "obra" }, done: false })}\n`));
        controller.enqueue(encoder.encode(`${JSON.stringify({ done: true })}\n`));
        controller.close();
      },
    });
    const fetchImpl = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>(async () => {
      return new Response(stream, { status: 200 });
    });

    const chunks = [];
    for await (const chunk of streamOllamaChat({
      model: AI_MODELS.CHAT,
      messages: [{ role: "user", content: "Hola" }],
      fetchImpl,
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["Hola ", "obra"]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost:11434/api/chat",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          model: "llama3.1",
          messages: [{ role: "user", content: "Hola" }],
          stream: true,
          options: {
            temperature: 0.2,
            num_predict: 1200,
          },
        }),
      }),
    );
  });

  it("throws a response error when Ollama streaming has no response body", async () => {
    const fetchImpl = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>(async () => {
      return new Response(null, { status: 200 });
    });

    const consume = async () => {
      for await (const _chunk of streamOllamaChat({
        model: AI_MODELS.CHAT,
        messages: [{ role: "user", content: "Hola" }],
        fetchImpl,
      })) {
        // consume stream
      }
    };

    await expect(consume()).rejects.toBeInstanceOf(OllamaResponseError);
  });
```

- [ ] **Step 2: Run streaming adapter tests to verify failure**

Run:

```bash
npm run test -- lib/ai/ollama.test.ts
```

Expected: FAIL because `parseOllamaStreamLine` and `streamOllamaChat` do not exist.

- [ ] **Step 3: Implement stream parsing and adapter**

In `lib/ai/ollama.ts`, add `OllamaStreamChunk` near `OllamaTagsPayload`:

```ts
type OllamaStreamChunk = {
  done: boolean;
  text: string;
};
```

Add these exported functions after `askOllama`:

```ts
export function parseOllamaStreamLine(line: string): OllamaStreamChunk | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(trimmed);
  } catch {
    throw new OllamaResponseError("Ollama devolvio un fragmento streaming invalido.");
  }

  if (!isRecord(payload)) {
    throw new OllamaResponseError("Ollama devolvio un fragmento streaming invalido.");
  }

  const done = payload.done === true;
  if (done) {
    return { done: true, text: "" };
  }

  const message = payload.message;
  if (!isRecord(message) || typeof message.content !== "string") {
    throw new OllamaResponseError("Ollama devolvio un fragmento streaming sin contenido.");
  }

  return {
    done: false,
    text: message.content,
  };
}

export async function* streamOllamaChat({
  model,
  messages,
  timeoutMs = DEFAULT_OLLAMA_TIMEOUT_MS,
  fetchImpl = fetch,
}: Omit<AskOllamaInput, "responseFormat">): AsyncIterable<string> {
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
        stream: true,
        options: {
          temperature: 0.2,
          num_predict: DEFAULT_CHAT_NUM_PREDICT,
        },
      }),
    });
  } catch (error) {
    clearTimeout(timeout);
    if (abortController.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw new OllamaTimeoutError(timeoutMs);
    }

    throw new OllamaConnectionError();
  }

  if (!response.ok) {
    clearTimeout(timeout);
    throw new OllamaResponseError(`Ollama respondio con estado ${response.status}.`);
  }

  if (!response.body) {
    clearTimeout(timeout);
    throw new OllamaResponseError("Ollama no devolvio un stream de respuesta.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const chunk = parseOllamaStreamLine(line);
        if (!chunk) {
          continue;
        }

        if (chunk.done) {
          return;
        }

        yield chunk.text;
      }
    }

    buffer += decoder.decode();
    const finalChunk = parseOllamaStreamLine(buffer);
    if (finalChunk && !finalChunk.done) {
      yield finalChunk.text;
    }
  } catch (error) {
    if (abortController.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw new OllamaTimeoutError(timeoutMs);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
    reader.releaseLock();
  }
}
```

- [ ] **Step 4: Run adapter tests**

Run:

```bash
npm run test -- lib/ai/ollama.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit adapter**

```bash
git add lib/ai/ollama.ts lib/ai/ollama.test.ts
git commit -m "feat: stream ollama chat responses"
```

---

### Task 2: Add Chat Streaming AI Service

**Files:**
- Modify: `lib/ai/service.ts`
- Create: `lib/ai/service-streaming.test.ts`

- [ ] **Step 1: Create failing service tests**

Create `lib/ai/service-streaming.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertCanUseAi: vi.fn(),
  listInstalledOllamaModels: vi.fn(),
  recordAiActionMetric: vi.fn(),
  recordAiUsage: vi.fn(),
  resolveAiModel: vi.fn(),
  streamOllamaChat: vi.fn(),
}));

vi.mock("@/lib/ai/ollama", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/ollama")>("@/lib/ai/ollama");
  return {
    ...actual,
    listInstalledOllamaModels: mocks.listInstalledOllamaModels,
    streamOllamaChat: mocks.streamOllamaChat,
  };
});

vi.mock("@/lib/ai/models", () => ({
  resolveAiModel: mocks.resolveAiModel,
}));

vi.mock("@/lib/ai/runtime", () => ({
  recordAiActionMetric: mocks.recordAiActionMetric,
}));

vi.mock("@/lib/ai/usage", () => ({
  assertCanUseAi: mocks.assertCanUseAi,
  recordAiUsage: mocks.recordAiUsage,
}));

import { streamChatAiResponse } from "@/lib/ai/service";

describe("streamChatAiResponse", () => {
  beforeEach(() => {
    mocks.assertCanUseAi.mockReset();
    mocks.listInstalledOllamaModels.mockReset();
    mocks.recordAiActionMetric.mockReset();
    mocks.recordAiUsage.mockReset();
    mocks.resolveAiModel.mockReset();
    mocks.streamOllamaChat.mockReset();

    mocks.listInstalledOllamaModels.mockResolvedValue(["llama3.1"]);
    mocks.resolveAiModel.mockReturnValue({
      model: "llama3.1",
      requestedModel: "llama3.1",
      fallbackUsed: false,
      warnings: [],
    });
  });

  it("yields chat deltas and returns final metadata after completion", async () => {
    mocks.streamOllamaChat.mockImplementation(async function* () {
      yield "Hola ";
      yield "obra";
    });

    const deltas: string[] = [];
    let finalResult;
    for await (const event of streamChatAiResponse({
      messages: [{ role: "user", content: "Hola" }],
      userId: "user-1",
    })) {
      if (event.type === "delta") {
        deltas.push(event.text);
      } else {
        finalResult = event.result;
      }
    }

    expect(deltas).toEqual(["Hola ", "obra"]);
    expect(finalResult).toEqual(
      expect.objectContaining({
        answer: "Hola obra",
        model: "llama3.1",
        requestedModel: "llama3.1",
        fallbackUsed: false,
        warnings: [],
      }),
    );
    expect(mocks.assertCanUseAi).toHaveBeenCalledWith({ userId: "user-1", estimatedTokens: expect.any(Number) });
    expect(mocks.recordAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        action: "chat",
        provider: "ollama",
        model: "llama3.1",
        actualTokens: expect.any(Number),
      }),
    );
    expect(mocks.recordAiActionMetric).toHaveBeenCalledWith("chat", {
      latencyMs: expect.any(Number),
      lastError: null,
    });
  });

  it("preserves fallback metadata and warnings in the final result", async () => {
    mocks.resolveAiModel.mockReturnValue({
      model: "llama3.1",
      requestedModel: "mistral",
      fallbackUsed: true,
      warnings: ["Modelo mistral no instalado; usando llama3.1."],
    });
    mocks.streamOllamaChat.mockImplementation(async function* () {
      yield "Respuesta";
    });

    const events = [];
    for await (const event of streamChatAiResponse({
      messages: [{ role: "user", content: "Hola" }],
    })) {
      events.push(event);
    }

    expect(events.at(-1)).toEqual({
      type: "final",
      result: expect.objectContaining({
        answer: "Respuesta",
        requestedModel: "mistral",
        fallbackUsed: true,
        warnings: ["Modelo mistral no instalado; usando llama3.1."],
      }),
    });
  });
});
```

- [ ] **Step 2: Run service streaming tests to verify failure**

Run:

```bash
npm run test -- lib/ai/service-streaming.test.ts
```

Expected: FAIL because `streamChatAiResponse` does not exist.

- [ ] **Step 3: Implement streaming service**

In `lib/ai/service.ts`, update the Ollama import:

```ts
import {
  askOllama,
  listInstalledOllamaModels,
  OllamaConnectionError,
  OllamaResponseError,
  OllamaTimeoutError,
  streamOllamaChat,
} from "@/lib/ai/ollama";
```

Add these types after `GenerateAiResponseInput`:

```ts
type StreamChatAiResponseInput = {
  messages: AiMessage[];
  fetchImpl?: FetchLike;
  userId?: string;
};

export type StreamChatAiResponseEvent =
  | { type: "delta"; text: string }
  | { type: "final"; result: AiEndpointResult };
```

Add this function before `generateAiResponse`:

```ts
export async function* streamChatAiResponse({
  messages,
  fetchImpl,
  userId,
}: StreamChatAiResponseInput): AsyncIterable<StreamChatAiResponseEvent> {
  const action: AiAction = "chat";
  const startedAt = Date.now();
  const promptText = messages.map((message) => message.content).join("\n");
  const estimatedTokens = estimateAiTokens(promptText);
  let answer = "";

  try {
    if (userId) {
      await assertCanUseAi({ userId, estimatedTokens });
    }

    const availableModels = await listInstalledOllamaModels(fetchImpl);
    const resolution = resolveAiModel(action, availableModels);

    for await (const text of streamOllamaChat({
      model: resolution.model,
      messages,
      fetchImpl,
    })) {
      answer += text;
      yield { type: "delta", text };
    }

    const latencyMs = Date.now() - startedAt;
    const result: AiEndpointResult = {
      answer: answer.trim(),
      model: resolution.model,
      requestedModel: resolution.requestedModel,
      fallbackUsed: resolution.fallbackUsed,
      warnings: resolution.warnings,
      latencyMs,
      debug: {
        structuredParseStatus: "not_requested",
        rawAnswer: answer,
      },
    };

    recordAiActionMetric(action, { latencyMs, lastError: result.warnings[0] ?? null });

    if (userId) {
      await recordAiUsage({
        userId,
        action,
        provider: "ollama",
        model: resolution.model,
        estimatedTokens,
        actualTokens: estimateAiTokens(`${promptText}\n${result.answer}`),
      });
    }

    yield { type: "final", result };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    recordAiActionMetric(action, {
      latencyMs,
      lastError: error instanceof Error ? error.message : "Error inesperado de IA",
    });

    if (error instanceof OllamaConnectionError) {
      throw new AiRuntimeError("connection", error.message);
    }

    if (error instanceof OllamaResponseError) {
      throw new AiRuntimeError("invalid_response", error.message);
    }

    if (error instanceof OllamaTimeoutError) {
      throw new AiRuntimeError("timeout", error.message);
    }

    if (error instanceof AiRuntimeError) {
      throw error;
    }

    if (error instanceof Error && error.message.includes("Falta instalar")) {
      throw new AiRuntimeError("model_missing", error.message);
    }

    throw error;
  }
}
```

Change `function estimateAiTokens` to export it:

```ts
export function estimateAiTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}
```

- [ ] **Step 4: Run service tests**

Run:

```bash
npm run test -- lib/ai/service-streaming.test.ts lib/ai/ollama.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit streaming service**

```bash
git add lib/ai/service.ts lib/ai/service-streaming.test.ts
git commit -m "feat: add khipu chat streaming service"
```

---

### Task 3: Add Chat Stream API Route

**Files:**
- Create: `app/api/ai/chat/stream/route.ts`
- Create: `app/api/ai/chat/stream/route.test.ts`

- [ ] **Step 1: Create failing route tests**

Create `app/api/ai/chat/stream/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  attachProjectHistoryEntry: vi.fn(),
  buildChatMessages: vi.fn(),
  streamChatAiResponse: vi.fn(),
  withAiRoute: vi.fn(),
}));

vi.mock("@/lib/ai/project-history-route", () => ({
  attachProjectHistoryEntry: mocks.attachProjectHistoryEntry,
}));

vi.mock("@/lib/ai/prompts", () => ({
  buildChatMessages: mocks.buildChatMessages,
}));

vi.mock("@/lib/ai/route-handler", () => ({
  withAiRoute: mocks.withAiRoute,
}));

vi.mock("@/lib/ai/service", () => ({
  streamChatAiResponse: mocks.streamChatAiResponse,
}));

import { POST } from "@/app/api/ai/chat/stream/route";

describe("POST /api/ai/chat/stream", () => {
  beforeEach(() => {
    mocks.attachProjectHistoryEntry.mockReset();
    mocks.buildChatMessages.mockReset();
    mocks.streamChatAiResponse.mockReset();
    mocks.withAiRoute.mockReset();
    mocks.withAiRoute.mockImplementation(async (handler: (session: { user: { id: string } }) => Promise<Response>) =>
      handler({ user: { id: "user-1" } }),
    );
    mocks.buildChatMessages.mockReturnValue([{ role: "user", content: "Consulta tecnica" }]);
    mocks.attachProjectHistoryEntry.mockImplementation(async ({ result }) => ({
      ...result,
      historyEntry: { id: "history-1" },
    }));
  });

  it("emits delta and final events for a streamed chat response", async () => {
    mocks.streamChatAiResponse.mockImplementation(async function* () {
      yield { type: "delta", text: "Hola " };
      yield {
        type: "final",
        result: {
          answer: "Hola obra",
          model: "llama3.1",
          requestedModel: "llama3.1",
          fallbackUsed: false,
          warnings: [],
        },
      };
    });

    const response = await POST(
      new Request("http://localhost/api/ai/chat/stream", {
        method: "POST",
        body: JSON.stringify({
          message: "Consulta tecnica",
          projectId: "project-1",
          context: { project: "Hospital Norte" },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const body = await response.text();
    expect(body).toContain('event: delta\ndata: {"text":"Hola "}');
    expect(body).toContain('event: final\ndata: {"answer":"Hola obra"');
    expect(body).toContain('"historyEntry":{"id":"history-1"}');
    expect(mocks.attachProjectHistoryEntry).toHaveBeenCalledWith({
      action: "chat",
      context: { project: "Hospital Norte" },
      projectId: "project-1",
      result: expect.objectContaining({ answer: "Hola obra" }),
      summary: "Consulta tecnica",
      userId: "user-1",
    });
  });

  it("emits an error event when streaming fails after the response starts", async () => {
    mocks.streamChatAiResponse.mockImplementation(async function* () {
      yield { type: "delta", text: "Hola" };
      throw new Error("stream failed");
    });

    const response = await POST(
      new Request("http://localhost/api/ai/chat/stream", {
        method: "POST",
        body: JSON.stringify({ message: "Consulta tecnica" }),
      }),
    );

    const body = await response.text();
    expect(body).toContain('event: delta\ndata: {"text":"Hola"}');
    expect(body).toContain('event: error\ndata: {"error":"stream failed"}');
  });
});
```

- [ ] **Step 2: Run route tests to verify failure**

Run:

```bash
npm run test -- app/api/ai/chat/stream/route.test.ts
```

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement streaming route**

Create `app/api/ai/chat/stream/route.ts`:

```ts
import { attachProjectHistoryEntry } from "@/lib/ai/project-history-route";
import { buildChatMessages } from "@/lib/ai/prompts";
import { withAiRoute } from "@/lib/ai/route-handler";
import { streamChatAiResponse } from "@/lib/ai/service";
import { aiChatRequestSchema } from "@/lib/ai/validation";

const encoder = new TextEncoder();

export async function POST(request: Request) {
  return withAiRoute(async (session) => {
    const data = aiChatRequestSchema.parse(await request.json());
    const messages = buildChatMessages(data);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of streamChatAiResponse({
            messages,
            userId: session.user.id,
          })) {
            if (event.type === "delta") {
              writeEvent(controller, "delta", { text: event.text });
              continue;
            }

            const finalResult = await attachProjectHistoryEntry({
              action: "chat",
              context: data.context,
              projectId: data.projectId,
              result: event.result,
              summary: data.message,
              userId: session.user.id,
            });
            writeEvent(controller, "final", finalResult);
          }
        } catch (error) {
          writeEvent(controller, "error", {
            error: error instanceof Error ? error.message : "No se pudo completar la solicitud de IA.",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream; charset=utf-8",
      },
    });
  });
}

function writeEvent(controller: ReadableStreamDefaultController<Uint8Array>, event: string, data: unknown) {
  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}
```

- [ ] **Step 4: Run route tests**

Run:

```bash
npm run test -- app/api/ai/chat/stream/route.test.ts app/api/ai/chat/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit route**

```bash
git add app/api/ai/chat/stream/route.ts app/api/ai/chat/stream/route.test.ts
git commit -m "feat: add khipu chat stream route"
```

---

### Task 4: Add Streaming UI Client Behavior

**Files:**
- Modify: `components/ai/AIWorkspace.tsx`
- Modify: `components/ai/AIWorkspace.bridge.test.tsx`

- [ ] **Step 1: Add failing UI tests**

In `components/ai/AIWorkspace.bridge.test.tsx`, add these tests before the final `});` of the describe block:

```ts
  it("renders partial streamed chat text and commits history after the final event", async () => {
    const stream = createSseStream([
      { event: "delta", data: { text: "Hola " } },
      { event: "delta", data: { text: "obra" } },
      {
        event: "final",
        data: {
          answer: "Hola obra",
          model: "llama3.1",
          requestedModel: "llama3.1",
          fallbackUsed: false,
          warnings: [],
          historyEntry: {
            id: "history-stream",
            projectId: "project-1",
            userId: "user-1",
            action: "chat",
            summary: "Consulta inicial",
            context: { project: "Edificio Multifamiliar", module: "APU" },
            result: {
              answer: "Hola obra",
              model: "llama3.1",
              requestedModel: "llama3.1",
              fallbackUsed: false,
              warnings: [],
            },
            timestamp: "2026-06-10T12:00:00.000Z",
          },
        },
      },
    ]);
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/ai/health") {
        return Promise.resolve({ ok: true, json: async () => createHealthPayload() });
      }

      if (url === "/api/projects/project-1/ai-history") {
        return Promise.resolve({ ok: true, json: async () => ({ entries: [] }) });
      }

      if (url === "/api/ai/chat/stream") {
        return Promise.resolve({
          ok: true,
          body: stream,
          headers: new Headers({ "content-type": "text/event-stream" }),
        });
      }

      return Promise.reject(new Error(`Unexpected fetch ${url} ${JSON.stringify(init)}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getButtonByText, getByText } = await renderWorkspace({ projectId: "project-1" });

    await act(async () => {
      getButtonByText("Enviar a Ollama").click();
    });

    expect(getByText("Hola obra")).toBeTruthy();
    expect(getByText("Consulta inicial")).toBeTruthy();
    const streamRequest = fetchMock.mock.calls.find(([url]) => url === "/api/ai/chat/stream");
    expect(JSON.parse(String(streamRequest?.[1]?.body))).toEqual(expect.objectContaining({ projectId: "project-1" }));
  });

  it("falls back to non-streaming chat when the stream request fails before final", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/ai/health") {
        return Promise.resolve({ ok: true, json: async () => createHealthPayload() });
      }

      if (url === "/api/ai/chat/stream") {
        return Promise.resolve({ ok: false, json: async () => ({ error: "stream unavailable" }) });
      }

      if (url === "/api/ai/chat") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            answer: "Respuesta sin streaming",
            model: "llama3.1",
            requestedModel: "llama3.1",
            fallbackUsed: false,
            warnings: [],
          }),
        });
      }

      return Promise.reject(new Error(`Unexpected fetch ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getButtonByText, getByText } = await renderWorkspace();

    await act(async () => {
      getButtonByText("Enviar a Ollama").click();
    });

    expect(getByText("Respuesta sin streaming")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/ai/chat/stream", expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith("/api/ai/chat", expect.any(Object));
  });
```

Add this helper near `createHealthPayload`:

```ts
function createSseStream(events: Array<{ event: string; data: unknown }>) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const event of events) {
        controller.enqueue(encoder.encode(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`));
      }
      controller.close();
    },
  });
}
```

- [ ] **Step 2: Run UI tests to verify failure**

Run:

```bash
npm run test -- components/ai/AIWorkspace.bridge.test.tsx
```

Expected: FAIL because the UI still calls `/api/ai/chat` for Ollama chat.

- [ ] **Step 3: Add streaming helpers to `AIWorkspace`**

In `components/ai/AIWorkspace.tsx`, add this type near `RequestState`:

```ts
type StreamEvent =
  | { event: "delta"; data: { text: string } }
  | { event: "final"; data: AiResultWithHistory }
  | { event: "error"; data: { error: string } };
```

Add these helpers near existing reader helpers:

```ts
async function readStreamEvents(response: Response, onEvent: (event: StreamEvent) => void) {
  if (!response.body) {
    throw new Error("La respuesta streaming de IA no tiene cuerpo.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

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
}

function readStreamEvent(frame: string): StreamEvent | null {
  const lines = frame.split(/\r?\n/);
  const eventLine = lines.find((line) => line.startsWith("event: "));
  const dataLine = lines.find((line) => line.startsWith("data: "));

  if (!eventLine || !dataLine) {
    return null;
  }

  const event = eventLine.slice("event: ".length);
  const payload: unknown = JSON.parse(dataLine.slice("data: ".length));

  if (event === "delta" && isRecord(payload) && typeof payload.text === "string") {
    return { event, data: { text: payload.text } };
  }

  if (event === "final") {
    return { event, data: readAiResult(payload) };
  }

  if (event === "error" && isRecord(payload) && typeof payload.error === "string") {
    return { event, data: { error: payload.error } };
  }

  return null;
}
```

- [ ] **Step 4: Route chat submissions through streaming**

In `submitRequest`, before the current non-streaming fetch block, add:

```ts
    if (request.action === "chat") {
      const streamed = await submitStreamingChatRequest(request, requestHistoryScope);
      if (streamed) {
        return;
      }
    }
```

Then add this nested function inside `AIWorkspaceContent`, near `submitBridgeRequest`:

```ts
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

      if (!response.ok) {
        return false;
      }

      let receivedFinal = false;
      let streamedAnswer = "";

      await readStreamEvents(response, (event) => {
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
      return false;
    }
  }
```

Keep the existing non-streaming fetch block unchanged after this fallback point.

- [ ] **Step 5: Run UI tests**

Run:

```bash
npm run test -- components/ai/AIWorkspace.bridge.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit UI streaming**

```bash
git add components/ai/AIWorkspace.tsx components/ai/AIWorkspace.bridge.test.tsx
git commit -m "feat: stream khipu chat in workspace"
```

---

### Task 5: Final Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run focused AI streaming tests**

Run:

```bash
npm run test -- lib/ai/ollama.test.ts lib/ai/service-streaming.test.ts app/api/ai/chat/stream/route.test.ts app/api/ai/chat/route.test.ts components/ai/AIWorkspace.bridge.test.tsx lib/ai/project-history-route.test.ts lib/ai/project-history.test.ts lib/ai/prompts.test.ts lib/ai/retrieval-context.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 3: Validate Prisma remains valid**

Run:

```bash
$env:DATABASE_URL='postgresql://user:pass@localhost:5432/myc_presupuestos'; node ./node_modules/prisma/build/index.js validate
```

Expected: PASS.

- [ ] **Step 4: Confirm old assistant names remain absent**

Run:

```bash
rg -n "(?i)copilo(to|t)" app components lib docs prd README.md
```

Expected: no output. `rg` exits with code 1 when there are no matches; that is expected.

- [ ] **Step 5: Confirm git scope**

Run:

```bash
git status --short
```

Expected: Khipu streaming changes are committed. The only remaining dirty files should be the pre-existing unrelated files:

- `app/dashboard/page.tsx`
- `components/budget/budget-editor.tsx`
- `lib/dashboard/onboarding.test.ts`
- `lib/dashboard/onboarding.ts`

Do not stage, commit, revert, or modify those unrelated files.

---

## Self-Review Checklist

- Streaming applies only to Khipu chat with Ollama.
- Existing `/api/ai/chat` JSON contract remains unchanged.
- APU, review, autocomplete, and APU catalog generation remain non-streaming.
- Partial streamed text is never persisted to history.
- Final streamed result uses existing history helper and warning behavior.
- Token usage and metrics use the final completed answer.
- UI falls back to non-streaming chat if the stream fails before final.
- Request-scope guards continue preventing stale history leaks across project/session changes.
