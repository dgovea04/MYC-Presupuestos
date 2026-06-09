# Khipu Workspace UX Design

## Goal

Turn the current `/ai` laboratory into a focused Khipu workspace that feels like a native assistant for MYC Presupuestos while preserving the existing backend, routes, entitlement checks, model routing, token ledger, and APU generation behavior.

This phase is a product and UX pass. It does not add persistent memory, RAG, streaming, new providers, or new AI actions.

## Current State

Khipu already has a working technical foundation:

- `/ai` is protected by the `ai.local` feature entitlement.
- The workspace supports chat, APU generation, budget review, and autocomplete.
- Ollama health and model fallback diagnostics are available through `/api/ai/health`.
- The workspace can use Ollama local or ChatGPT Bridge.
- APU editors can generate catalog-backed APU proposals through `/api/ai/apu/generate`.
- Recent workspace results are kept in browser `localStorage`.

The main gap is experience. The UI still reads like a diagnostic surface, and the model/runtime details compete with the user's work.

## Product Direction

Khipu should feel like the technical assistant inside MYC Presupuestos:

- clear and calm, not chatty or generic
- oriented around construction budgeting tasks
- transparent about provider/model status without making diagnostics the main experience
- review-first: suggestions are previewed and applied only by explicit user action

The name "Khipu" is the product-facing assistant name. Internal code may continue using `AI*` names where they refer to implementation boundaries rather than user-facing copy.

## UX Scope

### Workspace Header

Replace the current laboratory-style hero with an operational header:

- Primary title: `Khipu`
- Supporting copy: short description of Khipu as the technical assistant for budgets, APU, review, and autocomplete.
- Badge: `Asistente tecnico`
- Compact provider summary: active provider, current health state, and a refresh action.

The header should be visually lighter than the current gradient card and should not dominate the page.

### Action Selection

Keep the existing actions:

- Chat tecnico
- Generar APU
- Revisar presupuesto
- Autocompletar

Present them as work commands rather than feature cards. Each action should show:

- icon
- concise label
- one-line purpose
- active state

The action area should remain responsive and work well from mobile to desktop.

### Runtime Status

Move detailed Ollama/model diagnostics below the main action controls or into a quieter secondary panel.

The user should see:

- provider: Ollama local or ChatGPT Bridge
- status: ready, fallback, unavailable, or bridge waiting
- selected/resolved model for the active action
- last latency when available

Required model cards and verbose fallback warnings remain available, but should not visually compete with the main task form.

### Main Task Form

Preserve the current request payloads and behavior for each action. Improve copy and grouping:

- Chat: `Consulta tecnica`
- APU: `Partida` and `Unidad`
- Review: `Resumen del presupuesto`
- Autocomplete: `Texto base`

Submit labels should stay provider-aware:

- Ollama: `Enviar a Ollama` / `Consultando IA local`
- ChatGPT Bridge: `Enviar a ChatGPT` / `Consultando ChatGPT`

Errors should remain visible near the form and written as actionable messages.

### Context Sidebar

Keep the context sidebar but make it explicitly Khipu-oriented:

- title: `Contexto de trabajo`
- description: explain that these fields guide Khipu's response
- fields: project, module, selected item, unit, current cost, active table

No persistence changes are included in this phase. Context is still local to the current page state and inbound URL parameters.

### Results And Recent Activity

Keep current rendering of plain and structured responses, including APU and review structured data.

Rename the history section to `Actividad reciente de Khipu`. It remains browser-local and limited to recent entries. The section should make clear that it helps resume recent results, not that it is project memory.

### Settings And Marketing Copy

Keep the naming consistent where Khipu is product-facing:

- sidebar label: `Khipu`
- settings panel: `Contexto de Khipu`
- landing/pricing copy: Khipu with IA local
- upgrade CTA: Khipu available in Pro

Backend routes and docs may still use `ai` where they refer to technical infrastructure.

## Architecture

No new backend architecture is required.

Primary component changes:

- `components/ai/AIWorkspace.tsx`: workspace composition, header, action controls, status panels, history title.
- `components/ai/ContextSidebar.tsx`: copy and section naming.
- `app/ai/page.tsx`: upgrade CTA copy if needed.
- Existing tests around `/ai`, APU editor links, and sidebar labels should be updated or extended.

The phase should avoid splitting `AIWorkspace.tsx` unless the implementation naturally needs a small presentational helper. If extraction happens, keep helpers under `components/ai/` and preserve current data flow.

## Data Flow

Data flow remains unchanged:

1. The server page reads session, settings, license, and URL parameters.
2. `AIWorkspace` initializes local UI state from props.
3. The selected action builds the same payload shape as today.
4. Ollama requests call `/api/ai/{action}`.
5. ChatGPT Bridge requests use the existing browser bridge client.
6. Results render in the workspace and recent activity is written to `localStorage`.

No database schema changes are required.

## Error Handling

Preserve existing error paths:

- entitlement failure shows the Pro upgrade CTA
- Ollama connection/model/timeout errors surface through existing route handling
- ChatGPT Bridge timeout gives the existing manual troubleshooting message
- invalid response shapes continue to show a generic "formato esperado" error

Copy can be improved, but behavior should not hide diagnostic detail needed for local setup.

## Testing

Targeted tests should cover:

- `/ai` Pro gate still renders Khipu copy.
- `AIWorkspace` renders Khipu header, action labels, provider selection, and recent activity title.
- Existing APU editor links continue to point to `/ai?action=apu` and show `Abrir en Khipu`.
- Sidebar navigation still links `/ai` and labels it `Khipu`.

Run:

- `npm run test -- app/ai/page.test.tsx components/ai/AIWorkspace.bridge.test.tsx components/apu/apu-editor-sheet.test.tsx components/partidas/partida-apu-sheet.test.tsx components/layout/app-sidebar-client.test.tsx`
- `npm run lint`

## Out Of Scope

- persistent project or budget memory
- RAG over documents, S10, or historical budgets
- streaming responses
- new model providers
- new AI actions
- automatic budget modifications
- renaming technical routes from `/ai` to `/khipu`

## Success Criteria

- A user opening `/ai` immediately sees Khipu as the named assistant, not a generic IA lab.
- Provider/model status is still accessible but visually secondary.
- The main task flow is easier to scan and use.
- Existing API contracts, entitlements, tests, and APU generation behavior remain intact.
