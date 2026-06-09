# Khipu Project History Design

## Objective

Persist Khipu activity by project so useful AI results are available beyond the current browser session. The first increment replaces the current "recent activity only in localStorage" behavior when a real project is available, while preserving the existing `/ai` laboratory fallback for sessions without a project id.

This is storage and retrieval of completed Khipu executions. It is not yet conversational memory, semantic search over history, streaming, or quality metrics.

## Current State

- `components/ai/AIWorkspace.tsx` stores recent history in `window.localStorage` under `myc-ai-session-history`.
- History entries include action, summary, context, result, and timestamp.
- The `/api/ai/chat` route calls `buildChatMessages(data)` and `generateAiResponse(...)`.
- Other AI routes follow the same pattern with structured results.
- Prisma already has `Project`, `User`, `AiUsagePeriod`, `AiTokenLedger`, and project ownership through `Project -> Company -> User`.
- `ActivityEvent` is for broad product activity; it should not become Khipu's operational memory.

## Recommended Approach

Create a dedicated project-scoped Khipu history table and small data service. Each successful Khipu execution can be saved as a single immutable history entry linked to `projectId` and `userId`.

This gives us a real project memory surface without changing prompts, token accounting, AI providers, or budget data.

## Data Model

Add a Prisma model named `AiProjectHistoryEntry`.

Fields:

- `id: String`
- `projectId: String`
- `userId: String`
- `action: String`
- `summary: String`
- `context: Json`
- `answer: String`
- `structuredData: Json?`
- `model: String`
- `requestedModel: String`
- `fallbackUsed: Boolean`
- `warnings: String[]`
- `latencyMs: Int?`
- `createdAt: DateTime`

Relations:

- `project` references `Project` with cascade delete.
- `user` references `User` with cascade delete.

Indexes:

- `[projectId, createdAt(sort: Desc)]`
- `[userId, createdAt(sort: Desc)]`
- `[action, createdAt(sort: Desc)]`

No financial values are calculated in this model. It stores AI output and metadata only.

## Data Service

Create `lib/ai/project-history.ts`.

Responsibilities:

- Verify project access through `project.company.userId`.
- List recent Khipu history for a project.
- Save one successful Khipu execution.
- Map database rows into a UI/API-safe shape.
- Keep the returned list capped, recommended first limit: `20`.

Public functions:

- `getAiProjectHistory(projectId: string, userId: string, limit?: number)`
- `recordAiProjectHistory(input)`

The service should not call Ollama, build prompts, or mutate budgets.

## API

Add a route:

- `GET /api/projects/[id]/ai-history`

Behavior:

- Requires an authenticated active user.
- Verifies project ownership.
- Returns recent entries ordered newest first.
- Returns `401` when unauthenticated.
- Returns `404` when the project does not exist or is not owned by the user, so inaccessible ids do not reveal project existence.

Saving history should happen server-side immediately after successful AI generation. The first implementation can either:

- Extend the AI action routes to accept optional `projectId`, then call `recordAiProjectHistory(...)` after `generateAiResponse(...)`.
- Or introduce a small internal helper used by each AI route to avoid duplicating the save logic.

Recommended first cut: extend the existing AI request schemas with optional `projectId`, and save from the four existing AI routes after a successful result.

## UI Behavior

Update `AIWorkspace` with optional `projectId`.

When `projectId` exists:

- Load `/api/projects/${projectId}/ai-history` on mount.
- Render those entries in "Actividad reciente de Khipu".
- After a successful Ollama request, prepend the `historyEntry` returned by the AI route.
- Do not write project history to `localStorage`.

When `projectId` is absent:

- Keep the current localStorage behavior exactly as the `/ai` lab fallback.
- Existing tests that seed `myc-ai-session-history` should continue to work.

ChatGPT Bridge:

- Because Bridge responses are client-side and manual-copy based, the first implementation should keep Bridge entries local unless we add a dedicated authenticated save endpoint.
- The UI copy should not imply Bridge entries are persisted by project until that endpoint exists.

## Data Flow

1. User runs a Khipu action in a project-aware workspace.
2. `AIWorkspace` sends the existing AI request payload plus `projectId`.
3. The AI route validates the request and calls `generateAiResponse(...)`.
4. On success, the route calls `recordAiProjectHistory(...)` with action, summary, context, result metadata, and project/user ids.
5. The route returns the normal AI result plus optional `historyEntry`.
6. `AIWorkspace` prepends that entry to the visible history.
7. If the page reloads, `AIWorkspace` fetches project history from the project route.

## Error Handling

- If history loading fails, Khipu still works and shows a non-blocking empty history state.
- If AI generation fails, no history entry is created.
- If AI generation succeeds but history persistence fails, the route should still return the AI result and append a warning to the response. Persistence failure must not turn a useful AI answer into a failed request.
- Invalid or inaccessible `projectId` should not leak another user's history.

## Testing

Data service tests:

- Lists only entries for projects owned by the user.
- Returns an empty list for inaccessible projects at the data-service level.
- Records a successful chat/APU/review entry with context and result metadata.
- Caps history results.

API route tests:

- Unauthorized request returns `401`.
- Authorized project history request returns entries newest first.
- Inaccessible project id does not return entries.

AI route integration tests:

- A successful project-aware chat/review request records history.
- A request without `projectId` still behaves as before and does not record project history.
- Failed AI request does not record history.

UI tests:

- With `projectId`, `AIWorkspace` fetches project history and renders it.
- With `projectId`, successful Ollama response updates project history UI without writing to localStorage.
- Without `projectId`, existing localStorage history behavior remains intact.
- Bridge provider still uses local session history unless a save endpoint is added later.

## Out of Scope

- Full conversation threads.
- Prompting Khipu with prior history.
- Streaming responses.
- Metrics for applied/discarded/edited suggestions.
- Embeddings or vector search over history.
- UI redesign of the Khipu workspace.
- Persisting ChatGPT Bridge responses server-side.

## Open Follow-Ups

- Add a dedicated save endpoint for ChatGPT Bridge history.
- Add filters by action, module, budget, or selected item.
- Use project history as optional retrieval evidence after persistence proves stable.
- Promote important AI findings into `ActivityEvent` only when they become user-visible project milestones.
