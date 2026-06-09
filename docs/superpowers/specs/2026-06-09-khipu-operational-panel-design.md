# Khipu Operational Panel Design

## Goal

Turn `/ai` from a useful assistant page into a lightweight operational panel for Khipu. The panel should make the active work context, recommended action, provider state, execution form, and next actions easier to scan without changing backend behavior.

This is a UI and microcopy pass only.

## Current State

Khipu already has:

- A branded `/ai` workspace header.
- Provider selection for Ollama local and ChatGPT Bridge.
- Runtime status and model details.
- Four commands: chat, generate APU, review budget, autocomplete.
- Editable context fields.
- Browser-local recent activity.
- Entry links from APU, Partida, and budget review surfaces.

The remaining gap is operational clarity. `/ai` still feels like a destination page rather than a compact work console connected to the current budget/APU context.

## Recommended Direction

Use a lightweight operational panel layout.

Keep `/ai` as a page, but make its first screen answer:

- What am I working on?
- What does Khipu recommend doing next?
- Which provider/runtime is active?
- What command am I about to run?
- What can I do after this response?

Do not embed Khipu into budget/APU drawers in this step. Do not add database persistence, RAG, streaming, or metrics here.

## Panel Structure

### Header

Keep the current Khipu identity header:

- Brand chip: `Khipu`
- Descriptor: `Asistente tecnico de obra`
- Tagline: `Criterio tecnico para presupuestos de obra.`
- Supporting copy: `Revisa APU, genera partidas y responde con contexto del presupuesto activo.`
- Provider summary remains visible.

### Active Work Strip

Add a compact strip below the header named:

> Trabajo activo

It should summarize the current context from `AiContext`:

- Proyecto
- Modulo
- Partida seleccionada
- Unidad
- Costo actual
- Tabla activa

Rules:

- Show only values that exist.
- Use compact chips or key-value rows.
- Keep it read-only; editing remains in `ContextSidebar`.
- If no meaningful values exist, show a calm empty state: `Sin contexto activo`.

This is not persistent project memory. It reflects only the current URL/default context and user edits in the current session.

### Recommended Action

Use `initialAction` / `activeAction` to highlight the command Khipu is ready to run.

Add a small label on the active action card:

> Recomendado

Only the currently active command receives the label.

The label should be visual and text-based, not color-only.

### Runtime Status

Keep the current runtime status and provider controls, but frame them as operational readiness.

Suggested title:

> Preparacion

Suggested description:

> Proveedor, modelos y latencia para ejecutar la accion activa.

The existing provider controls and active action details stay functionally unchanged.

### Execution Block

Rename the main form section from only the action label to an operational block:

- Section eyebrow/title: `Ejecucion`
- Main title: current action label, such as `Chat tecnico`
- Short helper text based on the current action.

Helper text:

- `chat`: `Consulta criterios tecnicos con el contexto activo.`
- `apu`: `Genera una propuesta editable de recursos y rendimiento.`
- `review`: `Revisa unidades, duplicados y costos sospechosos.`
- `autocomplete`: `Completa descripciones tecnicas sin perder el contexto.`

The existing input fields and submit behavior remain unchanged.

### Next Actions

Add a small `Siguientes acciones` block near the context sidebar or below it.

It should provide simple command shortcuts, not navigation to other app modules:

- `Explicar contexto` -> selects `chat`
- `Generar APU` -> selects `apu`
- `Revisar presupuesto` -> selects `review`
- `Autocompletar texto` -> selects `autocomplete`

Behavior:

- Clicking a shortcut changes `activeAction`.
- It clears current `result` and `error`, same as command cards.
- It does not submit automatically.
- It does not modify provider, history, context, or localStorage.

## Architecture

Keep the implementation inside the existing AI feature boundary:

- `components/ai/AIWorkspace.tsx`
- `components/ai/ContextSidebar.tsx`
- `components/ai/AIWorkspace.bridge.test.tsx`

If helper data is needed, keep it local to `AIWorkspace.tsx`:

- action helper copy
- context summary formatting
- next action definitions

Do not create a new service or persistence layer for this pass.

## Data Flow

Input data:

- `initialAction`
- `initialContext`
- user edits in `ContextSidebar`
- existing local component state

Derived UI:

- active work strip reads from `context`
- recommended label reads from `activeAction`
- execution helper text reads from `activeAction`
- next actions call the same local action-switching behavior as command cards

No new network calls are introduced.

## Error Handling

Existing error handling remains unchanged:

- Ollama/API failures still render `AIMessage` with error tone.
- ChatGPT Bridge timeout/errors remain unchanged.
- Runtime health refresh remains unchanged.

The active work strip should tolerate missing or empty context fields.

## Accessibility

- Active/recommended command remains visible in text.
- Shortcut buttons must be real buttons.
- Continue using `aria-pressed` on selectable command/provider controls.
- Do not rely on color alone for active or recommended states.

## Out Of Scope

This pass must not change:

- API routes.
- Model routing.
- ChatGPT Bridge event protocol.
- Token accounting.
- RAG retrieval.
- Project-persistent history.
- Streaming responses.
- Metrics and analytics storage.
- Budget/APU calculation logic.
- S10 import/export behavior.
- Database schema.

## Testing

Update focused jsdom tests to verify:

- `/ai` renders `Trabajo activo`.
- Context values are visible in the active work strip.
- The active command shows `Recomendado`.
- Runtime status section uses `Preparacion`.
- Execution block renders `Ejecucion` and action-specific helper text.
- `Siguientes acciones` shortcuts switch the active command without submitting.
- Existing provider controls and ChatGPT Bridge behavior still pass.

Run:

```bash
npm run test -- components/ai/AIWorkspace.bridge.test.tsx app/ai/page.test.tsx
npm run lint
```

## Success Criteria

- `/ai` feels like a work panel connected to the current budget/APU context.
- A user can quickly see the active project/module/partida context.
- The current command and next command options are obvious.
- Existing AI request behavior is unchanged.
- No backend, persistence, RAG, streaming, metrics, S10, or calculation behavior changes.
