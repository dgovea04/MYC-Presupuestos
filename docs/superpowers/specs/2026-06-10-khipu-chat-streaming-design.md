# Khipu Chat Streaming Design

## Goal

Add real streaming for Khipu Chat tecnico without changing the current non-streaming AI routes for APU, review, autocomplete, or catalog-backed APU generation.

This first increment improves perceived latency for conversational questions while preserving the existing JSON-based flows that depend on structured parsing, repair, history persistence, token accounting, and route tests.

## Scope

In scope:

- Stream only the `chat` action for the Ollama provider.
- Keep `POST /api/ai/chat` as the stable non-streaming endpoint.
- Add a dedicated streaming chat route: `POST /api/ai/chat/stream`.
- Render partial assistant text in `AIWorkspace` while chunks arrive.
- Emit a final event with the same metadata shape the UI needs today: answer, model, requestedModel, fallbackUsed, warnings, latencyMs, optional debug, and optional `historyEntry`.
- Persist project history after the final answer is complete when `projectId` is present.
- Keep local session history behavior when `projectId` is absent.
- Fall back to the existing non-streaming chat request if streaming fails before a usable final response.

Out of scope:

- Streaming APU, review, autocomplete, or catalog APU.
- Streaming structured JSON parsing or repair.
- Streaming ChatGPT Bridge responses.
- Changing token accounting policy beyond using the final completed answer for usage estimation.
- Using history as prompt memory.

## Architecture

### Ollama Adapter

Add a streaming adapter alongside the current `askOllama` function instead of replacing it. The new adapter should call Ollama `/api/chat` with `stream: true`, parse newline-delimited JSON chunks, and expose an async iterable of text deltas.

The existing `askOllama` remains the source of truth for non-streaming and structured flows.

### AI Service

Add a chat-specific streaming service that mirrors the current chat resolution steps:

1. Estimate prompt tokens.
2. Enforce AI entitlement and usage allowance when `userId` exists.
3. List installed Ollama models.
4. Resolve the chat model and fallback metadata.
5. Stream text deltas from Ollama.
6. Accumulate the final answer.
7. On completion, record metrics and usage using the final answer.

The service should not support schemas. If a caller needs structured output, it must use the existing non-streaming service.

### Streaming Route

Add `POST /api/ai/chat/stream` using the existing `withAiRoute` authentication and billing wrapper where possible. The route returns a `ReadableStream` using server-sent-event style frames:

- `event: delta` with `{ text }`
- `event: final` with the completed `AiEndpointResultWithHistory`
- `event: error` with `{ error }` for runtime failures after the stream starts

Before the stream starts, validation/auth errors should keep normal HTTP status behavior when possible.

The final result should pass through `attachProjectHistoryEntry` so project history behavior stays centralized.

### UI

`AIWorkspace` should use streaming only for:

- provider is `ollama`
- active action is `chat`

For all other actions, keep the current request path.

While streaming:

- Show the partial answer in the existing result area.
- Keep the submit button loading state active.
- Append warnings and metadata only after the final event.
- Add history only after the final event.
- Preserve the existing request-scope guard so stale responses do not leak across project/session changes.

If streaming errors before the final event, the UI may retry once through the existing `/api/ai/chat` endpoint and show the current non-streaming error behavior if that also fails.

## Error Handling

- Connection or model errors before the response stream is created should return the same mapped status behavior as current AI routes.
- Errors after streaming starts should emit an `error` event and close the stream.
- The UI should not persist partial answers to history.
- If history persistence fails after a successful streamed answer, the final result should include the same warning currently used by `attachProjectHistoryEntry`.

## Testing

Add focused tests for:

- Ollama stream parsing and malformed chunk handling.
- Streaming chat service accumulates deltas, records metrics/usage after completion, and preserves model fallback metadata.
- Streaming route emits `delta` and `final` events.
- Streaming route final event includes `historyEntry` when project persistence succeeds.
- `AIWorkspace` renders partial streamed text and commits history only after `final`.
- `AIWorkspace` falls back to non-streaming chat when streaming fails before final.
- Existing non-streaming chat, APU, review, autocomplete, project history, and retrieval tests continue to pass.

## Compatibility

The existing `/api/ai/chat` contract remains unchanged. Existing callers that do not opt into the new stream route continue receiving JSON responses.

The implementation should avoid touching financial calculations, S10 import/export, APU calculation logic, or structured-output parsing beyond tests that confirm those flows remain stable.

## Implementation Decisions

- The stream route path will be `POST /api/ai/chat/stream` unless implementation discovers a Next.js routing conflict.
- The wire format will use SSE-style text frames over `fetch` rather than browser `EventSource`, because the request needs POST body context.
