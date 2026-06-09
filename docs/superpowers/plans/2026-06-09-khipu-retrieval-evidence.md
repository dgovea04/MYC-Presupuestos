# Khipu Retrieval Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight retrieval evidence layer that gives Khipu compact, traceable sources from catalog partidas, resources, imported S10 metadata, and curated internal technical snippets.

**Architecture:** Build a pure service in `lib/ai/retrieval-context.ts` with no database access, no route changes, no embeddings, and no persistence. Integrate evidence blocks into prompt builders as optional inputs so existing callers keep working unchanged. Keep APU catalog behavior stable by verifying existing APU generator tests.

**Tech Stack:** TypeScript strict, Vitest, existing `catalog-search` helpers, existing `CatalogPartidaRecord`, `ResourceRecord`, and `AiContext` types.

---

## File Structure

- Create: `lib/ai/retrieval-context.ts`
  - Owns evidence types, curated technical snippets, retrieval builder, S10/import source classification, excerpt formatting, score rounding, deterministic evidence formatting.
- Create: `lib/ai/retrieval-context.test.ts`
  - Owns tests for catalog partida evidence, S10 classification, resource evidence, technical document evidence, sorting, limits, and formatted prompt blocks.
- Modify: `lib/ai/prompts.ts`
  - Adds optional `evidence` parameters to chat and review prompt builders.
  - Adds evidence as additional system/context text only when provided.
- Modify: `lib/ai/prompts.test.ts`
  - Verifies chat/review prompts include evidence when passed and omit evidence when absent.
- Verify only: `lib/ai/apu-generator.test.ts`
  - Existing tests must continue to pass, proving catalog-backed APU behavior was not weakened.

Do not modify:

- `app/api/ai/*`
- `prisma/*`
- `lib/ai/service.ts`
- `lib/ai/usage.ts`
- S10 import/export files
- budget/APU calculation files
- UI files
- unrelated dirty files already present in the working tree:
  - `app/dashboard/page.tsx`
  - `components/budget/budget-editor.tsx`
  - `lib/dashboard/onboarding.test.ts`
  - `lib/dashboard/onboarding.ts`

---

### Task 1: Add Retrieval Evidence Service Tests

**Files:**
- Create: `lib/ai/retrieval-context.test.ts`

- [ ] **Step 1: Create failing tests for catalog, S10, resource, document, and formatting behavior**

Create `lib/ai/retrieval-context.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { buildAiRetrievalEvidence, formatEvidenceBlock } from "@/lib/ai/retrieval-context";
import type { CatalogPartidaRecord } from "@/types/partida";
import type { ResourceRecord } from "@/types/resource";

const partidas: CatalogPartidaRecord[] = [
  {
    id: "par-concreto-columnas",
    description: "Concreto f'c=210 kg/cm2 en columnas",
    unit: "m3",
    unitPrice: 280,
    currency: "PEN",
    source: "S10_OBRA_MYC",
    performance: 12,
    apuRows: [
      {
        id: "row-cemento",
        catalogPartidaId: "par-concreto-columnas",
        resourceId: "res-cemento",
        description: "Cemento Portland Tipo I",
        unit: "bol",
        quantity: 7.5,
        unitPrice: 32,
        subtotal: 240,
        resourceType: "MATERIAL",
        sortOrder: 0,
      },
      {
        id: "row-arena",
        catalogPartidaId: "par-concreto-columnas",
        resourceId: "res-arena",
        description: "Arena gruesa",
        unit: "m3",
        quantity: 0.5,
        unitPrice: 80,
        subtotal: 40,
        resourceType: "MATERIAL",
        sortOrder: 1,
      },
    ],
  },
  {
    id: "par-tarrajeo",
    description: "Tarrajeo en muros interiores",
    unit: "m2",
    unitPrice: 45,
    currency: "PEN",
    source: "catalogo-propio",
    performance: 20,
    apuRows: [],
  },
];

const resources: ResourceRecord[] = [
  {
    id: "res-cemento",
    code: "MAT-001",
    description: "Cemento Portland Tipo I",
    category: "MATERIAL",
    unit: "bol",
    unitPrice: 32,
    currency: "PEN",
    source: "catalogo-propio",
    iu: "21",
    iuCurrent: "CEMENTO PORTLAND TIPO I",
  },
  {
    id: "res-operario",
    code: "MO-001",
    description: "Operario",
    category: "LABOR",
    unit: "hh",
    unitPrice: 25,
    currency: "PEN",
    source: "S10_OBRA_MYC",
  },
];

describe("retrieval-context", () => {
  it("maps similar catalog partidas into compact traceable evidence and classifies S10 sources", () => {
    const evidence = buildAiRetrievalEvidence({
      query: "concreto fc 210 columnas cemento",
      action: "apu",
      unit: "m3",
      catalogPartidas: partidas,
      resources,
      limit: 4,
    });

    const concreteEvidence = evidence.find((item) => item.id === "partida:par-concreto-columnas");
    expect(concreteEvidence).toMatchObject({
      sourceType: "s10_import",
      title: "Concreto f'c=210 kg/cm2 en columnas",
      metadata: expect.objectContaining({
        partidaId: "par-concreto-columnas",
        unit: "m3",
        source: "S10_OBRA_MYC",
      }),
    });
    expect(concreteEvidence?.excerpt).toContain("Unidad: m3");
    expect(concreteEvidence?.excerpt).toContain("Fuente: S10_OBRA_MYC");
    expect(concreteEvidence?.excerpt).toContain("APU: Cemento Portland Tipo I, Arena gruesa");
    expect(concreteEvidence?.score).toBeGreaterThan(0.6);
    expect(String(concreteEvidence?.score)).toMatch(/^\\d(?:\\.\\d{1,3})?$/);
  });

  it("maps catalog resources with category, unit, source, IU, and rounded score", () => {
    const evidence = buildAiRetrievalEvidence({
      query: "cemento portland concreto",
      action: "chat",
      catalogPartidas: partidas,
      resources,
      limit: 6,
    });

    const resourceEvidence = evidence.find((item) => item.id === "resource:res-cemento");
    expect(resourceEvidence).toMatchObject({
      sourceType: "catalog_resource",
      title: "Cemento Portland Tipo I",
      metadata: expect.objectContaining({
        resourceId: "res-cemento",
        category: "MATERIAL",
        unit: "bol",
        source: "catalogo-propio",
        iu: "21",
      }),
    });
    expect(resourceEvidence?.excerpt).toContain("Categoria: MATERIAL");
    expect(resourceEvidence?.excerpt).toContain("Unidad: bol");
    expect(resourceEvidence?.excerpt).toContain("IU: 21");
    expect(String(resourceEvidence?.score)).toMatch(/^\\d(?:\\.\\d{1,3})?$/);
  });

  it("retrieves curated technical document evidence without treating it as official law", () => {
    const evidence = buildAiRetrievalEvidence({
      query: "formula polinomica monomios incidencia menor 0.05",
      action: "review",
      limit: 4,
    });

    const technicalEvidence = evidence.find((item) => item.sourceType === "technical_doc");
    expect(technicalEvidence).toMatchObject({
      id: "technical:formula-polinomica-monomios",
      title: "Formula polinomica Peru - reglas de monomios",
      metadata: expect.objectContaining({
        sourcePath: "prd/formula-polinomica-peru-webapp-spec.md",
        referenceType: "internal_technical_reference",
      }),
    });
    expect(technicalEvidence?.excerpt).toContain("Referencia interna");
    expect(technicalEvidence?.excerpt.toLowerCase()).not.toContain("norma oficial");
  });

  it("formats evidence deterministically and returns an empty block when no evidence exists", () => {
    const evidence = buildAiRetrievalEvidence({
      query: "concreto fc 210 columnas cemento",
      action: "apu",
      unit: "m3",
      catalogPartidas: partidas,
      resources,
      limit: 3,
    });

    const block = formatEvidenceBlock(evidence);
    expect(block).toContain("Fuentes consultadas:");
    expect(block).toContain("1. [s10_import] Concreto f'c=210 kg/cm2 en columnas");
    expect(block).toContain("score ");
    expect(block).toContain("[catalog_resource] Cemento Portland Tipo I");
    expect(block.split("\\n").length).toBeLessThanOrEqual(10);
    expect(formatEvidenceBlock([])).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm run test -- lib/ai/retrieval-context.test.ts
```

Expected: FAIL because `@/lib/ai/retrieval-context` does not exist yet.

- [ ] **Step 3: Commit the failing tests**

```bash
git add lib/ai/retrieval-context.test.ts
git commit -m "test: describe khipu retrieval evidence"
```

---

### Task 2: Implement Pure Retrieval Evidence Service

**Files:**
- Create: `lib/ai/retrieval-context.ts`
- Test: `lib/ai/retrieval-context.test.ts`

- [ ] **Step 1: Create the retrieval evidence service**

Create `lib/ai/retrieval-context.ts` with:

```ts
import { searchCatalogPartidas, searchCatalogResources, tokenizeCatalogText } from "@/lib/ai/catalog-search";
import type { AiAction, AiContext } from "@/lib/ai/types";
import type { CatalogPartidaRecord } from "@/types/partida";
import type { ResourceRecord } from "@/types/resource";

export type AiEvidenceSourceType = "catalog_partida" | "catalog_resource" | "s10_import" | "technical_doc";

export type AiEvidence = {
  id: string;
  sourceType: AiEvidenceSourceType;
  title: string;
  excerpt: string;
  score: number;
  metadata: Record<string, string | number | boolean>;
};

export type BuildAiRetrievalEvidenceInput = {
  query: string;
  action: Exclude<AiAction, "json">;
  unit?: string;
  context?: AiContext;
  catalogPartidas?: CatalogPartidaRecord[];
  resources?: ResourceRecord[];
  limit?: number;
};

type TechnicalEvidenceSnippet = {
  id: string;
  title: string;
  sourcePath: string;
  tags: string[];
  excerpt: string;
};

const DEFAULT_EVIDENCE_LIMIT = 6;
const EXCERPT_LIMIT = 320;

const TECHNICAL_SNIPPETS: TechnicalEvidenceSnippet[] = [
  {
    id: "formula-polinomica-monomios",
    title: "Formula polinomica Peru - reglas de monomios",
    sourcePath: "prd/formula-polinomica-peru-webapp-spec.md",
    tags: ["formula", "polinomica", "monomios", "incidencia", "reajuste", "0.05"],
    excerpt: "Referencia interna: evitar monomios con incidencia menor a 0.05 salvo criterio tecnico sustentado.",
  },
  {
    id: "apu-catalog-source-truth",
    title: "Khipu APU - catalogo como fuente de verdad",
    sourcePath: "prd/prd_ai_apu_catalog_rag_myc_presupuestos.md",
    tags: ["apu", "catalogo", "insumos", "partidas", "resource", "validacion"],
    excerpt: "Referencia interna: el catalogo es la fuente de verdad; Khipu no debe inventar insumos ni guardar automaticamente.",
  },
  {
    id: "partida-similarity-generation",
    title: "Generacion de partidas por similitud",
    sourcePath: "prd/PRD_Sistema_Generacion_Partidas_Similitud_V1.md",
    tags: ["partidas", "similares", "similitud", "catalogo", "sugerencias"],
    excerpt: "Referencia interna: buscar partidas similares, proponer candidatas y mantener revision manual antes de aplicar cambios.",
  },
];

export function buildAiRetrievalEvidence({
  query,
  action,
  unit,
  context,
  catalogPartidas = [],
  resources = [],
  limit = DEFAULT_EVIDENCE_LIMIT,
}: BuildAiRetrievalEvidenceInput): AiEvidence[] {
  const retrievalQuery = buildRetrievalQuery({ query, action, context });
  const partidaResults = searchCatalogPartidas({
    query: retrievalQuery,
    unit,
    partidas: catalogPartidas,
    limit,
  }).map(({ partida, similarity }): AiEvidence => mapPartidaEvidence(partida, similarity));
  const resourceResults = searchCatalogResources({
    query: retrievalQuery,
    similarPartidas: searchCatalogPartidas({
      query: retrievalQuery,
      unit,
      partidas: catalogPartidas,
      limit: Math.min(5, limit),
    }),
    resources,
    limit,
  }).map(({ resource, score }): AiEvidence => mapResourceEvidence(resource, score));
  const technicalResults = searchTechnicalEvidence({ query: retrievalQuery, action, limit });

  return [...partidaResults, ...resourceResults, ...technicalResults]
    .sort(compareEvidence)
    .slice(0, limit);
}

export function formatEvidenceBlock(evidence: AiEvidence[], limit = DEFAULT_EVIDENCE_LIMIT) {
  const compactEvidence = evidence.slice().sort(compareEvidence).slice(0, limit);
  if (compactEvidence.length === 0) {
    return "";
  }

  return [
    "Fuentes consultadas:",
    ...compactEvidence.flatMap((item, index) => [
      `${index + 1}. [${item.sourceType}] ${item.title} (score ${formatScore(item.score)})`,
      `   ${limitText(item.excerpt, EXCERPT_LIMIT)}`,
    ]),
  ].join("\n");
}

function buildRetrievalQuery({ query, action, context }: { query: string; action: Exclude<AiAction, "json">; context?: AiContext }) {
  return [
    query,
    action,
    context?.project,
    context?.module,
    context?.selectedItem,
    context?.unit,
    context?.activeTable,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");
}

function mapPartidaEvidence(partida: CatalogPartidaRecord, similarity: number): AiEvidence {
  const source = partida.source ?? "catalogo";
  return {
    id: `partida:${partida.id}`,
    sourceType: isS10Source(source) ? "s10_import" : "catalog_partida",
    title: partida.description,
    excerpt: limitText(
      [
        `Unidad: ${partida.unit}`,
        `PU: ${partida.unitPrice} ${partida.currency}`,
        `Fuente: ${source}`,
        `Rendimiento: ${partida.performance}`,
        partida.apuRows.length ? `APU: ${partida.apuRows.slice(0, 4).map((row) => row.description).join(", ")}` : null,
      ]
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .join(". "),
      EXCERPT_LIMIT,
    ),
    score: roundScore(similarity),
    metadata: {
      partidaId: partida.id,
      unit: partida.unit,
      source,
      similarity: roundScore(similarity),
    },
  };
}

function mapResourceEvidence(resource: ResourceRecord, score: number): AiEvidence {
  const source = resource.source ?? "catalogo";
  return {
    id: `resource:${resource.id}`,
    sourceType: "catalog_resource",
    title: resource.description,
    excerpt: limitText(
      [
        `Categoria: ${resource.category}`,
        `Unidad: ${resource.unit}`,
        `PU: ${resource.unitPrice} ${resource.currency}`,
        `Fuente: ${source}`,
        resource.iu ? `IU: ${resource.iu}` : null,
        resource.iuCurrent ? `IU actual: ${resource.iuCurrent}` : null,
      ]
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .join(". "),
      EXCERPT_LIMIT,
    ),
    score: roundScore(score),
    metadata: {
      resourceId: resource.id,
      category: resource.category,
      unit: resource.unit,
      source,
      score: roundScore(score),
      ...(resource.iu ? { iu: resource.iu } : {}),
    },
  };
}

function searchTechnicalEvidence({
  query,
  action,
  limit,
}: {
  query: string;
  action: Exclude<AiAction, "json">;
  limit: number;
}): AiEvidence[] {
  const queryTokens = tokenizeCatalogText(`${query} ${action}`);

  return TECHNICAL_SNIPPETS.map((snippet) => {
    const snippetTokens = tokenizeCatalogText([snippet.title, snippet.tags.join(" "), snippet.excerpt].join(" "));
    const score = scoreTokenOverlap(queryTokens, snippetTokens);

    return {
      id: `technical:${snippet.id}`,
      sourceType: "technical_doc" as const,
      title: snippet.title,
      excerpt: limitText(snippet.excerpt, EXCERPT_LIMIT),
      score: roundScore(score),
      metadata: {
        sourcePath: snippet.sourcePath,
        referenceType: "internal_technical_reference",
      },
    };
  })
    .filter((item) => item.score > 0)
    .sort(compareEvidence)
    .slice(0, limit);
}

function scoreTokenOverlap(queryTokens: string[], candidateTokens: string[]) {
  if (queryTokens.length === 0 || candidateTokens.length === 0) {
    return 0;
  }

  const candidateSet = new Set(candidateTokens);
  const matches = new Set(queryTokens.filter((token) => candidateSet.has(token)));
  return matches.size / Math.max(new Set(queryTokens).size, 1);
}

function isS10Source(source: string) {
  return source.toLowerCase().includes("s10");
}

function compareEvidence(left: AiEvidence, right: AiEvidence) {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  return left.title.localeCompare(right.title);
}

function roundScore(score: number) {
  return Number(Math.max(0, Math.min(1, score)).toFixed(3));
}

function formatScore(score: number) {
  return roundScore(score).toFixed(3);
}

function limitText(value: string, limit: number) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) {
    return compact;
  }

  return `${compact.slice(0, limit - 1).trimEnd()}...`;
}
```

- [ ] **Step 2: Run retrieval evidence tests**

Run:

```bash
npm run test -- lib/ai/retrieval-context.test.ts
```

Expected: PASS. All retrieval evidence tests pass.

- [ ] **Step 3: Commit service implementation**

```bash
git add lib/ai/retrieval-context.ts
git commit -m "feat: add khipu retrieval evidence service"
```

---

### Task 3: Integrate Evidence Blocks Into Prompt Builders

**Files:**
- Modify: `lib/ai/prompts.ts`
- Modify: `lib/ai/prompts.test.ts`
- Test: `lib/ai/retrieval-context.test.ts`

- [ ] **Step 1: Add failing prompt tests for optional evidence**

In `lib/ai/prompts.test.ts`, update the import:

```ts
import { buildApuPrompt, buildAutocompletePrompt, buildCatalogApuPrompt, buildChatMessages, buildReviewPrompt } from "@/lib/ai/prompts";
```

stays the same, then add these tests inside `describe("AI prompts", ...)`:

```ts
  it("adds retrieval evidence to chat messages only when provided", () => {
    const messages = buildChatMessages({
      message: "Revisa el rendimiento",
      evidence: [
        {
          id: "technical:formula-polinomica-monomios",
          sourceType: "technical_doc",
          title: "Formula polinomica Peru - reglas de monomios",
          excerpt: "Referencia interna: evitar monomios con incidencia menor a 0.05 salvo criterio tecnico sustentado.",
          score: 0.684,
          metadata: {
            sourcePath: "prd/formula-polinomica-peru-webapp-spec.md",
            referenceType: "internal_technical_reference",
          },
        },
      ],
    });

    expect(messages[1]).toMatchObject({ role: "system" });
    expect(messages[1]?.content).toContain("Fuentes consultadas:");
    expect(messages[1]?.content).toContain("[technical_doc] Formula polinomica Peru - reglas de monomios");
    expect(messages.at(-1)).toEqual({ role: "user", content: "Revisa el rendimiento" });

    const messagesWithoutEvidence = buildChatMessages({ message: "Revisa el rendimiento" });
    expect(messagesWithoutEvidence.map((message) => message.content).join("\n")).not.toContain("Fuentes consultadas:");
  });

  it("adds retrieval evidence to review prompts without changing the structured JSON instruction", () => {
    const prompt = buildReviewPrompt("Partida duplicada de acero", {
      evidence: [
        {
          id: "partida:par-acero",
          sourceType: "catalog_partida",
          title: "Acero de refuerzo fy=4200 kg/cm2",
          excerpt: "Unidad: kg. Fuente: catalogo-propio. APU: Operario, Acero corrugado.",
          score: 0.912,
          metadata: {
            partidaId: "par-acero",
            unit: "kg",
            source: "catalogo-propio",
          },
        },
      ],
    });

    expect(prompt).toContain("Fuentes consultadas:");
    expect(prompt).toContain("[catalog_partida] Acero de refuerzo fy=4200 kg/cm2");
    expect(prompt).toContain('{"answer":"resumen corto"');
    expect(prompt).toContain("No modifiques datos automaticamente");

    expect(buildReviewPrompt("Partida duplicada de acero")).not.toContain("Fuentes consultadas:");
  });
```

- [ ] **Step 2: Run prompt tests and verify they fail**

Run:

```bash
npm run test -- lib/ai/prompts.test.ts
```

Expected: FAIL because `buildChatMessages` and `buildReviewPrompt` do not accept evidence yet.

- [ ] **Step 3: Update prompt builder signatures and evidence formatting**

In `lib/ai/prompts.ts`, add imports:

```ts
import { formatEvidenceBlock, type AiEvidence } from "@/lib/ai/retrieval-context";
```

Update `buildChatMessages` signature from:

```ts
export function buildChatMessages({ message, context }: { message: string; context?: AiContext }): AiMessage[] {
  const contextBlock = buildContextBlock(context);
```

to:

```ts
export function buildChatMessages({
  message,
  context,
  evidence = [],
}: {
  message: string;
  context?: AiContext;
  evidence?: AiEvidence[];
}): AiMessage[] {
  const contextBlock = buildContextBlock(context);
  const evidenceBlock = buildEvidenceSystemMessage(evidence);
```

Then update the returned messages to include evidence after context:

```ts
  return [
    { role: "system", content: MYC_AI_SYSTEM_PROMPT },
    ...(contextBlock ? [{ role: "system" as const, content: contextBlock }] : []),
    ...(evidenceBlock ? [{ role: "system" as const, content: evidenceBlock }] : []),
    { role: "user", content: message },
  ];
```

Update `buildReviewPrompt` signature from:

```ts
export function buildReviewPrompt(budgetSummary: string) {
```

to:

```ts
export function buildReviewPrompt(budgetSummary: string, options: { evidence?: AiEvidence[] } = {}) {
  const evidenceBlock = formatEvidenceBlock(options.evidence ?? []);
```

Then insert the evidence block before `budgetSummary`:

```ts
    evidenceBlock ? `Usa estas fuentes como contexto de apoyo. Si una respuesta requiere validacion normativa u oficial, indicalo.\n\n${evidenceBlock}` : "",
    budgetSummary,
```

and keep the existing JSON and "No modifiques datos automaticamente" instructions unchanged.

Add this helper near the other private helpers in `lib/ai/prompts.ts`:

```ts
function buildEvidenceSystemMessage(evidence: AiEvidence[]) {
  const evidenceBlock = formatEvidenceBlock(evidence);
  if (!evidenceBlock) {
    return "";
  }

  return [
    "Usa estas fuentes como contexto de apoyo. Si una respuesta requiere validacion normativa u oficial, indicalo.",
    "",
    evidenceBlock,
  ].join("\n");
}
```

- [ ] **Step 4: Run prompt and retrieval tests**

Run:

```bash
npm run test -- lib/ai/prompts.test.ts lib/ai/retrieval-context.test.ts
```

Expected: PASS. Prompt tests and retrieval-context tests pass.

- [ ] **Step 5: Commit prompt integration**

```bash
git add lib/ai/prompts.ts lib/ai/prompts.test.ts
git commit -m "feat: add retrieval evidence to ai prompts"
```

---

### Task 4: Final Verification

**Files:**
- Verify: `lib/ai/retrieval-context.ts`
- Verify: `lib/ai/retrieval-context.test.ts`
- Verify: `lib/ai/prompts.ts`
- Verify: `lib/ai/prompts.test.ts`
- Verify: `lib/ai/apu-generator.test.ts`

- [ ] **Step 1: Run focused AI retrieval and prompt tests**

Run:

```bash
npm run test -- lib/ai/retrieval-context.test.ts lib/ai/prompts.test.ts lib/ai/apu-generator.test.ts
```

Expected: PASS. Retrieval, prompt, and existing catalog-backed APU generator tests pass.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS with no ESLint errors.

- [ ] **Step 3: Confirm old assistant names remain absent**

Run:

```bash
rg -n "(?i)copilo(to|t)" app components lib docs prd README.md
```

Expected: no output. `rg` exits with code 1 when there are no matches; that is expected.

- [ ] **Step 4: Confirm scope**

Run:

```bash
git status --short
```

Expected: retrieval evidence changes should be committed. The only remaining dirty files should be the unrelated pre-existing files:

- `app/dashboard/page.tsx`
- `components/budget/budget-editor.tsx`
- `lib/dashboard/onboarding.test.ts`
- `lib/dashboard/onboarding.ts`

Do not stage, commit, revert, or modify those unrelated files.

---

## Self-Review Checklist

- The plan creates a reusable `AiEvidence` contract.
- The plan retrieves catalog partida, S10/imported, catalog resource, and technical document evidence.
- Scores are rounded to 3 decimals.
- Evidence formatting is deterministic and compact.
- Chat/review prompt integration is optional and preserves existing callers.
- Existing APU generator behavior remains verified.
- The plan does not add migrations, pgvector, embeddings, persistence, route changes, S10 import changes, UI changes, streaming, metrics, or budget calculation changes.
