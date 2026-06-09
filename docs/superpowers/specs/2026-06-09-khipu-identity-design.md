# Khipu Identity Design

## Goal

Polish Khipu's visible product identity so it feels like a native MYC Presupuestos assistant, not a generic AI lab or chatbot. This step focuses only on brand-facing UI copy and lightweight visual identity: tagline, microcopy, and brand chip.

## Positioning

Khipu should feel like a sober technical assistant with a small amount of helpful guidance.

Primary identity:

- Professional and precise.
- Oriented to construction budgets, APU, review, and technical criteria.
- Calm and trustworthy rather than playful or futuristic.
- Helpful without overclaiming project memory, legal authority, or autonomous decision making.

Khipu should not feel like:

- A generic chatbot.
- A marketing AI gimmick.
- A full autonomous estimator.
- A replacement for the engineer, budget owner, or final approver.

## Recommended Tagline

Use this as the primary tagline in the `/ai` workspace header:

> Criterio tecnico para presupuestos de obra.

Rationale:

- It is specific to the product domain.
- It sounds technical and professional.
- It does not overpromise persistent memory, full automation, or regulation-grade validation.
- It gives Khipu a more distinct identity than "IA local" or "asistente tecnico" alone.

## Supporting Microcopy

Use functional supporting copy near the tagline:

> Revisa APU, genera partidas y responde con contexto del presupuesto activo.

This explains what Khipu can do today without implying features that are planned but not implemented yet.

For shorter surfaces, use one of these:

- `Asistente tecnico de obra`
- `Criterio tecnico para APU y presupuestos`
- `Respuestas con contexto del presupuesto`

Avoid copy that implies unavailable features:

- `Memoria completa del proyecto`
- `Auditoria normativa automatica`
- `Aprueba presupuestos por ti`
- `Control total de costos con IA`

## Brand Chip

The workspace header should include a compact brand chip that pairs Khipu's name with a familiar assistant icon.

Recommended structure:

- Icon: use an existing `lucide-react` icon, preferably `BotMessageSquare`.
- Label: `Khipu`
- Descriptor: `Asistente tecnico de obra` or the primary tagline nearby.
- Visual language: navy/blue, thin border, subtle light-blue background, consistent with MYC's SaaS style.

The chip should be understated. Do not create a complex logo or custom illustration in this step.

## Workspace Header

The `/ai` header should move from a generic assistant label toward a branded assistant presentation:

- Brand chip: `Khipu`
- Tagline: `Criterio tecnico para presupuestos de obra.`
- Supporting copy: `Revisa APU, genera partidas y responde con contexto del presupuesto activo.`
- Keep the provider/runtime summary visible in the header.

The header should remain compact and operational. It should not become a landing-page hero.

## Microcopy Rules

Use `Khipu` where the user is interacting with the assistant as a product surface:

- `/ai` header and activity section.
- Sidebar navigation.
- Upgrade CTA.
- APU/Partida sheet entry points.
- Settings panels related to AI context.

Use generic `IA` only where the copy describes the underlying technology or provider:

- `IA local`
- `Proveedor de IA`
- `Modelo de IA`
- `Respuesta de IA`

Provider names should remain explicit:

- `Ollama local`
- `ChatGPT Bridge`

## Out Of Scope

This identity pass must not change:

- API routes.
- Model routing.
- Token accounting.
- ChatGPT Bridge behavior.
- RAG retrieval behavior.
- Project-persistent history.
- Streaming responses.
- Metrics and analytics storage.

Those are later recommended steps.

## Components Affected

Expected implementation scope:

- `components/ai/AIWorkspace.tsx`
- `components/ai/AIWorkspace.bridge.test.tsx`
- Optional nearby copy-only surfaces if wording should stay consistent:
  - `app/ai/page.tsx`
  - `components/settings/local-ai-settings-card.tsx`
  - `components/landing/landing-content.ts`

Do not touch budget calculation logic, S10 import logic, Prisma schema, or unrelated dashboard work.

## Testing

Add or update focused tests to verify:

- `/ai` renders `Khipu`.
- `/ai` renders `Criterio tecnico para presupuestos de obra.`
- `/ai` renders the supporting copy about APU, partidas, and active budget context.
- Existing provider controls, command actions, and recent activity still render.

Run:

```bash
npm run test -- components/ai/AIWorkspace.bridge.test.tsx app/ai/page.test.tsx
npm run lint
```

## Success Criteria

- Khipu has a clearer product identity on first view.
- The copy feels technical, sober, and trustworthy.
- The UI explains current capabilities without overpromising future features.
- No financial, regulatory, RAG, provider, or persistence behavior changes.
