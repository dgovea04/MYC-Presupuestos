# Khipu Retrieval Evidence Design

## Goal

Improve Khipu's RAG behavior with a lightweight retrieval layer that supplies compact, traceable evidence to AI prompts. This first increment should use existing catalog and document sources without adding embeddings, pgvector, database migrations, or a document administration UI.

The objective is not to build the final RAG platform yet. The objective is to make Khipu answers more grounded and auditable with explicit evidence blocks.

## Current State

Khipu already has useful catalog-aware behavior:

- `lib/ai/catalog-search.ts` ranks catalog partidas and resources using normalized token scoring.
- `lib/ai/apu-context-builder.ts` builds compact APU context from catalog partidas and resources.
- `lib/ai/apu-generator.ts` can generate APU proposals from catalog-backed context and fallback to catalog proposals.
- `lib/ai/prompts.ts` already instructs the model to use similar partidas and matching resources.
- Prisma stores `CatalogPartida`, `PartidaApuRow`, `Resource`, budget items, APUs, generated partidas, and token usage.
- S10 import already persists imported budgets, partidas, APUs, resources, and source metadata into the MYC data model.

The gap is that Khipu does not yet have a shared retrieval contract that can be reused across chat, review, APU, and autocomplete prompts, and it does not present source evidence in a consistent shape.

## Recommended Direction

Build a lightweight "retrieval evidence" layer.

This layer should:

- Search existing catalog partidas and resources.
- Include known S10/imported catalog sources through existing `source` metadata.
- Include a small curated local document corpus from internal PRDs/docs as technical reference evidence.
- Return evidence records with source type, title, excerpt, score, and metadata.
- Format evidence into a compact prompt block named `Fuentes consultadas`.
- Preserve current AI route behavior and structured output flows.

This first increment should not add vector embeddings, pgvector, new database tables, external document crawling, or automatic legal/normative claims.

## Evidence Contract

Create a shared type:

```ts
export type AiEvidenceSourceType = "catalog_partida" | "catalog_resource" | "s10_import" | "technical_doc";

export type AiEvidence = {
  id: string;
  sourceType: AiEvidenceSourceType;
  title: string;
  excerpt: string;
  score: number;
  metadata: Record<string, string | number | boolean>;
};
```

Rules:

- `id` must be stable within a retrieval result.
- `score` must be decimal-like and rounded to 3 decimals.
- `excerpt` must be short enough for prompts, ideally under 320 characters.
- `metadata` must contain only primitive values to keep prompt formatting deterministic.
- Evidence must never contain raw JSON blobs, full documents, or large APU payloads.

## Retrieval Inputs

Create an input shape:

```ts
export type BuildAiRetrievalEvidenceInput = {
  query: string;
  action: "chat" | "apu" | "review" | "autocomplete";
  unit?: string;
  context?: AiContext;
  catalogPartidas?: CatalogPartidaRecord[];
  resources?: ResourceRecord[];
  limit?: number;
};
```

For route integration, callers may initially pass already-loaded catalog partidas/resources. This keeps the retrieval service pure and testable, and avoids adding data access responsibilities to it.

## Evidence Sources

### Catalog Partidas

Use `searchCatalogPartidas` from `lib/ai/catalog-search.ts`.

Evidence mapping:

- `sourceType`: `catalog_partida`
- `title`: partida description
- `excerpt`: unit, unit price, source, performance, and top APU row names where available
- `metadata`: partida id, unit, source, similarity
- `score`: search similarity

If `partida.source` indicates S10/imported origin, classify the evidence as `s10_import` instead of `catalog_partida`.

### Catalog Resources

Use `searchCatalogResources` from `lib/ai/catalog-search.ts`.

Evidence mapping:

- `sourceType`: `catalog_resource`
- `title`: resource description
- `excerpt`: category, unit, price, source, IU where available
- `metadata`: resource id, category, unit, source, score
- `score`: resource search score

### Technical Documents

Create a small in-code corpus for the first increment, not a database table.

Initial sources:

- `prd/formula-polinomica-peru-webapp-spec.md`
- `prd/prd_ai_apu_catalog_rag_myc_presupuestos.md`
- `prd/PRD_Sistema_Generacion_Partidas_Similitud_V1.md`

The implementation should not load full files dynamically at runtime. Instead, define curated snippets in code, each with:

- id
- title
- source path
- topic tags
- excerpt

This avoids accidental prompt bloat and keeps the content under version control.

Technical document evidence should be clearly labeled as internal technical reference unless the source is an official legal/normative document curated later.

## Prompt Formatting

Create a helper:

```ts
export function formatEvidenceBlock(evidence: AiEvidence[]): string;
```

Expected output:

```txt
Fuentes consultadas:
1. [catalog_partida] Concreto f'c=210 kg/cm2 para columnas (score 0.912)
   Unidad: m3. Fuente: S10_OBRA_MYC. APU: Cemento Portland, Arena gruesa, Piedra chancada.
2. [technical_doc] Formula polinomica Peru - reglas de monomios (score 0.684)
   Referencia interna: evitar monomios con incidencia menor a 0.05 salvo criterio tecnico.
```

Rules:

- If no evidence exists, return an empty string.
- Limit to the requested top N, default 6.
- Sort by score descending, then title.
- Do not include markdown tables.
- Do not include unbounded text from source documents.

## Prompt Integration

Integrate evidence block gradually:

### Chat

`buildChatMessages` should accept optional evidence and insert a system message after the context block:

```txt
Usa estas fuentes como contexto de apoyo. Si una respuesta requiere validacion normativa u oficial, indicalo.

Fuentes consultadas:
...
```

### APU

Catalog-backed APU already has strong context. The first increment should avoid disrupting the structured APU JSON prompt. Add evidence only where it helps:

- pass evidence into catalog context debug/metadata, or
- append a compact evidence field to the existing catalog context if tests confirm it does not break structured output.

Do not weaken existing rules that forbid invented resources.

### Review

Budget review should receive evidence about relevant catalog partidas/resources and internal review rules.

The prompt should continue to return the existing structured JSON shape.

### Autocomplete

Autocomplete should only receive very compact evidence. If evidence would make the prompt too long, skip it.

## Output And Debug

Expose evidence through existing debug channels where possible:

- Add optional `evidence?: AiEvidence[]` to debug metadata when building AI responses.
- Do not require UI changes in the first implementation.
- Do not persist evidence in the database in this increment.

The user-facing answer can mention evidence only when useful, but the model must not claim that internal docs are official legal sources.

## Architecture

Expected files:

- `lib/ai/retrieval-context.ts`
  - evidence types
  - local technical document snippets
  - retrieval builder
  - evidence formatting helper
- `lib/ai/retrieval-context.test.ts`
  - scoring, ordering, formatting, S10 classification, prompt-size discipline
- `lib/ai/prompts.ts`
  - optional evidence block integration for chat/review as the first prompt integration
- `lib/ai/prompts.test.ts`
  - evidence appears when provided and is omitted when empty

Possible later integration files:

- `app/api/ai/chat/route.ts`
- `app/api/ai/review/route.ts`
- `app/api/ai/apu/route.ts`

Route integration can be a second implementation step after the pure service and prompt helpers are tested.

## Safety Rules

- Khipu must ask for human validation before applying cost/APU recommendations.
- Khipu must not cite internal PRDs as official law.
- Khipu must distinguish imported S10/catalog evidence from official normative references.
- Khipu must not invent source ids or metadata.
- Khipu must not include full copyrighted or legal documents in prompts.
- Khipu must not expand the token ledger or entitlement behavior in this increment.

## Out Of Scope

This increment does not include:

- pgvector.
- embeddings.
- database migrations.
- document upload UI.
- external web crawling.
- automatic download of Peruvian legal documents.
- persistent project memory.
- streaming responses.
- metrics for suggestion quality.
- UI display of evidence cards.

## Testing

Focused tests should verify:

- Catalog partida evidence maps similarity, title, source type, and metadata correctly.
- S10/imported sources are classified as `s10_import`.
- Resource evidence includes category, unit, source, IU, and rounded score.
- Technical document evidence is retrieved by matching query/action tokens.
- Evidence formatting is deterministic and compact.
- Empty evidence returns an empty block.
- Chat/review prompts include evidence only when provided.
- Existing APU catalog tests continue to pass.

Suggested commands:

```bash
npm run test -- lib/ai/retrieval-context.test.ts lib/ai/prompts.test.ts lib/ai/apu-generator.test.ts
npm run lint
```

## Success Criteria

- Khipu has a reusable evidence contract for future RAG work.
- Chat/review prompts can receive grounded evidence without changing route behavior.
- Catalog and imported S10 information are represented as traceable evidence.
- Internal technical docs can contribute controlled snippets without prompt bloat.
- No database, vector, persistence, streaming, metrics, S10 import, or calculation behavior changes.
