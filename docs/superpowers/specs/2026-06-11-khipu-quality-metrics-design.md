# Khipu Quality Metrics Design

## Context

Khipu already records AI executions through `AiProjectHistoryEntry` and exposes runtime AI health metrics such as latency and last error. The next roadmap step is to measure the quality outcome of Khipu suggestions: whether a human applied, edited, or dismissed a recommendation.

These outcomes happen after the AI response is generated, so they should be tracked as feedback events linked to the response history instead of being folded into model runtime metrics.

## Goals

- Let users mark a Khipu response as applied, edited, or dismissed.
- Persist feedback for project-backed Khipu history.
- Keep a local session fallback for non-project usage.
- Show simple quality counters in the Khipu workspace.
- Preserve the current human-in-the-loop model: Khipu suggests, the user decides.

## Non-Goals

- Do not automatically mutate budgets or APU from Khipu responses.
- Do not infer applied/edited/dismissed from budget diffs in this step.
- Do not build full analytics dashboards yet.
- Do not change token usage accounting or runtime health metrics.
- Do not add quality scoring by the model.

## Product Behavior

Each Khipu response gets a compact feedback control with three mutually exclusive actions:

- `Aplicada`: the user used the suggestion as-is or close enough to count as accepted.
- `Editada`: the user used the suggestion after meaningful human edits.
- `Descartada`: the user decided not to use it.

For project history, feedback is persisted against the `AiProjectHistoryEntry`. For browser-only session history, feedback is stored in local component state and localStorage with the existing session history.

The workspace shows a compact quality summary:

- Aplicadas
- Editadas
- Descartadas

The first version can show counts for the current project/session scope only. Percentages and trend charts can come later.

## Data Model

Add a new Prisma enum:

```prisma
enum AiSuggestionFeedbackType {
  APPLIED
  EDITED
  DISMISSED
}
```

Add a new table:

```prisma
model AiSuggestionFeedbackEvent {
  id             String                   @id @default(cuid())
  historyEntryId String
  userId         String
  projectId      String
  feedbackType   AiSuggestionFeedbackType
  notes          String?
  createdAt      DateTime                 @default(now())
  historyEntry   AiProjectHistoryEntry    @relation(fields: [historyEntryId], references: [id], onDelete: Cascade)
  user           User                     @relation(fields: [userId], references: [id], onDelete: Cascade)
  project        Project                  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([historyEntryId, createdAt(sort: Desc)])
  @@index([projectId, createdAt(sort: Desc)])
  @@index([userId, createdAt(sort: Desc)])
  @@index([feedbackType, createdAt(sort: Desc)])
}
```

For the first implementation, multiple events per history entry are allowed so a user can correct a previous mark. The UI should display the latest event as the current state. This preserves an audit trail without needing update/delete behavior.

`AiProjectHistoryEntry` should gain a relation:

```prisma
feedbackEvents AiSuggestionFeedbackEvent[]
```

`User` and `Project` should also gain corresponding relations.

## Service Layer

Create a focused service, for example `lib/ai/suggestion-feedback.ts`, with:

- `recordAiSuggestionFeedback(input)`
- `getAiSuggestionFeedbackSummary(input)`
- `getLatestAiSuggestionFeedbackByHistoryEntry(input)`

Ownership rules:

- A user may record feedback only for a history entry belonging to a project owned by that user through `Project -> Company -> User`.
- If the history entry is not owned by the user, return `null` or an empty summary rather than leaking existence.
- Feedback summary should count latest state per history entry, not raw event count, so corrections do not inflate metrics.

## API

Add project-scoped endpoints:

- `POST /api/projects/[projectId]/ai-history/[historyEntryId]/feedback`
- `GET /api/projects/[projectId]/ai-feedback/summary`

`POST` body:

```json
{
  "feedbackType": "APPLIED",
  "notes": "optional short note"
}
```

`GET` response:

```json
{
  "summary": {
    "applied": 3,
    "edited": 2,
    "dismissed": 1
  }
}
```

Session-only feedback should not call the API; it remains local.

## UI

Update `components/ai/AIWorkspace.tsx`:

- Add a quality summary strip near the Khipu preparation/status area.
- Add feedback buttons under the current response and each history item detail:
  - Aplicada
  - Editada
  - Descartada
- Use compact buttons or segmented controls, not large cards.
- Indicate the selected state with subtle blue/emerald/amber/slate styling.
- If an API call fails, keep the previous selected state and show a small error message.

For session history, store feedback in localStorage alongside the current session history shape. For project history, read and write persisted state through the new endpoints.

## Data Flow

1. Khipu returns a response.
2. If project-backed, the response includes `historyEntry`.
3. The user marks feedback on the response.
4. The UI posts feedback to the project endpoint.
5. The backend validates ownership and records an event.
6. The UI refreshes or locally updates the quality summary.
7. When loading project history, the UI also loads latest feedback state and summary.

## Error Handling

- Unauthorized requests return `401`.
- Invalid feedback type returns `400`.
- Non-owned project/history entries return `404`.
- Failed feedback saves show a non-blocking UI error.
- Session feedback never blocks Khipu usage.

## Testing

Add tests for:

- Feedback service ownership checks.
- Latest-state summary counts one state per history entry.
- Feedback POST route records an event.
- Feedback summary route returns counts.
- AI workspace renders quality counters.
- Project feedback uses API and session feedback uses localStorage only.
- Changing feedback updates the selected state without duplicating visible history.

## Rollout

This is safe to ship behind the existing Khipu workspace because feedback is additive. It does not alter AI generation, budget math, APU calculations, or token accounting.
