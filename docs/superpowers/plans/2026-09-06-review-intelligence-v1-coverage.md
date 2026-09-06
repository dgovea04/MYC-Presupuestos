# Revisión Inteligente V1 — Cobertura ampliada Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ampliar la revisión inteligente para detectar y explicar mejor metrados, especificaciones, rendimientos y componentes APU, con cobertura por categoría y sin mutaciones automáticas.

**Architecture:** Reutilizar `ReviewEvidence`, `EntityLink`, `ReviewFinding` y `progressJson` del V0. Introducir un normalizador puro compartido por PDF/XLSX/CSV, extender matching/reglas con señales opcionales y persistir los campos nuevos dentro de `metadataJson`/`comparisonJson`, agregando sólo el enum de hallazgo necesario para rendimiento.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Prisma 7, Vitest, Decimal.js, ExcelJS.

**Spec:** `docs/superpowers/specs/2026-09-06-review-intelligence-v1-coverage-design.md`

## Global Constraints

- No se ejecutan fórmulas, macros, enlaces ni scripts de documentos.
- Cantidades y rendimientos se comparan con `decimal.js`.
- Toda evidencia publicada conserva provenance verificable.
- `humanReviewRequired=true` y `automaticBudgetMutation=false`.
- Consultas limitadas por `companyId` y `projectId`.
- No se crea almacenamiento paralelo de evidencia.

---

### Task 1: Normalización de señales V1

**Files:**
- Create: `lib/review-intelligence/normalization.ts`
- Test: `lib/review-intelligence/normalization.test.ts`
- Modify: `lib/review-intelligence/types.ts`

**Interfaces:** `normalizeEvidenceMetadata(metadata)`, `parseDecimalText(value)`, `classifyEvidenceType(metadata)` y `NormalizedEvidenceMetadata` con `code`, `description`, `quantity`, `unit`, `technicalSpecification`, `discipline`, `yield`, `attributes`, `apuComponents`.

- [ ] **Step 1: Write the failing test**

```ts
it("normaliza aliases de especificación, rendimiento y componentes APU", () => {
  const result = normalizeEvidenceMetadata({ spec: "f'c 210", rendimiento: "0,125", componente: "cemento; arena", cantidad: "12,50", unidad: "M²" });
  expect(result.technicalSpecification).toBe("f'c 210");
  expect(result.yield?.toFixed(3)).toBe("0.125");
  expect(result.quantity?.toFixed(2)).toBe("12.50");
  expect(result.apuComponents).toEqual(["cemento", "arena"]);
  expect(parseDecimalText("[FORMULA:B2*2]")).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- lib/review-intelligence/normalization.test.ts`

Expected: FAIL because the module and exports do not exist.

- [ ] **Step 3: Write minimal implementation**

Implement alias lookup case-insensitive, decimal parsing only for complete numeric text, unit canonicalization through `normalizeUnit`, and component splitting by `;`, `,`, `|`. Return `undefined` for invalid values and preserve string attributes.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- lib/review-intelligence/normalization.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add lib/review-intelligence/normalization.ts lib/review-intelligence/normalization.test.ts lib/review-intelligence/types.ts
git commit -m "feat: normalize review intelligence evidence"
```

### Task 2: Extracción estructurada y persistencia

**Files:**
- Modify: `lib/review-intelligence/extractors.ts`
- Modify: `lib/review-intelligence/extractors.test.ts`
- Modify: `lib/review-intelligence/extraction-persistence.ts`
- Modify: `lib/review-intelligence/extraction-persistence.test.ts`

**Interfaces:** `ExtractionItem.metadata` conserva aliases V0 y añade `yield`, detalles de recursos y especificación normalizada. `extractAndPersistDocumentVersion` persiste esos campos en `metadataJson` y usa `value/unit` sólo para datos verificables.

- [ ] **Step 1: Write the failing tests**

Agregar fixtures XLSX y PDF con `Metrado`, `Rendimiento`, `Recurso`, `Tipo recurso`, `Cantidad recurso` y `Especificación técnica`. Verificar cantidad, unidad, rendimiento, especificación, componentes y `sheet/range` o `page`. Añadir una prueba de persistencia que verifique `metadataJson` y `value` decimal.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm.cmd test -- lib/review-intelligence/extractors.test.ts lib/review-intelligence/extraction-persistence.test.ts`

Expected: FAIL because the new headers and labels are not mapped.

- [ ] **Step 3: Write minimal implementation**

Usar `normalizeEvidenceMetadata` desde `metadataFromRows` y `metadataFromPdfLine`. Ampliar patrones de encabezado sin ejecutar fórmulas/enlaces. Conservar hash y deduplicación existentes; guardar componentes con cantidad en atributos JSON sin crear otra tabla.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm.cmd test -- lib/review-intelligence/extractors.test.ts lib/review-intelligence/extraction-persistence.test.ts`

Expected: PASS, incluyendo las pruebas V0.

- [ ] **Step 5: Commit**

```powershell
git add lib/review-intelligence/extractors.ts lib/review-intelligence/extractors.test.ts lib/review-intelligence/extraction-persistence.ts lib/review-intelligence/extraction-persistence.test.ts
git commit -m "feat: extract structured takeoff and apu evidence"
```

### Task 3: Matching enriquecido y carga de APU

**Files:**
- Modify: `lib/review-intelligence/matching.ts`
- Modify: `lib/review-intelligence/matching.test.ts`
- Modify: `lib/review-intelligence/pipeline.ts`
- Modify: `app/api/budgets/[id]/review-runs/route.ts`
- Modify: `app/api/budgets/[id]/review-runs/route.test.ts`

**Interfaces:** `BudgetItemMatchInput`/`EvidenceMatchInput` agregan `technicalSpecification`, `yield`, `apuComponents` y `sectionHeader` opcionales. `EntityLinkCandidate.signals` agrega `specification`, `yield`, `apuComponents` y `unitAlias`. `ReviewBudgetItem` recibe `apu.performance` y recursos con cantidad/tipo/descripción.

- [ ] **Step 1: Write the failing tests**

Probar que especificación y componentes compatibles elevan el score, que una unidad equivalente genera `unitAlias=1`, y que un conflicto de código sigue dejando `eligibleForFindings=false`. En el route test verificar que `runReviewJob` recibe rendimiento y recursos del APU persistido.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm.cmd test -- lib/review-intelligence/matching.test.ts app/api/budgets/[id]/review-runs/route.test.ts`

Expected: FAIL because the new fields/signals are absent.

- [ ] **Step 3: Write minimal implementation**

Agregar señales normalizadas y pesos explícitos con score final en `0..1`, recalculado sólo sobre señales disponibles. En el route ampliar el `select` de APU, sin mutar el presupuesto, y construir `reviewItems` con performance y recursos.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm.cmd test -- lib/review-intelligence/matching.test.ts app/api/budgets/[id]/review-runs/route.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add lib/review-intelligence/matching.ts lib/review-intelligence/matching.test.ts lib/review-intelligence/pipeline.ts app/api/budgets/[id]/review-runs/route.ts app/api/budgets/[id]/review-runs/route.test.ts
git commit -m "feat: match review evidence with apu signals"
```

### Task 4: Reglas de rendimiento, especificación y APU

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260906150000_add_review_yield_finding/migration.sql`
- Modify: `lib/review-intelligence/types.ts`
- Modify: `lib/review-intelligence/rules.ts`
- Modify: `lib/review-intelligence/rules.test.ts`
- Modify: `lib/review-intelligence/validation.ts`

**Interfaces:** Añadir `YIELD_MISMATCH` al enum Prisma y `reviewFindingTypes`. `ReviewRuleItem`/`ReviewRuleEvidence` agregan `yield?: Decimal`, especificación y componentes. `evaluateFindingRules` produce `YIELD_MISMATCH`, reutiliza `TECHNICAL_SPEC_MISMATCH`/`INCOMPLETE_APU` cuando aplica y mantiene ambos guardrails en falso/verdadero según V0.

- [ ] **Step 1: Write the failing tests**

Probar rendimiento fuera de tolerancia con `Decimal`, especificación incompatible, componente faltante, datos inválidos y unidades no comparables. Verificar `comparison.details`, prioridad, `humanReviewRequired=true` y `automaticBudgetMutation=false`. Validar `YIELD_MISMATCH` en `findingTypes`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm.cmd test -- lib/review-intelligence/rules.test.ts lib/review-intelligence/validation.test.ts`

Expected: FAIL because el enum y las reglas no existen.

- [ ] **Step 3: Write minimal implementation**

Crear la migración con `ALTER TYPE "ReviewFindingType" ADD VALUE 'YIELD_MISMATCH'` siguiendo el estilo existente. Comparar con `Decimal`, normalizar texto y producir componentes faltantes sólo para evidencia primaria y vínculos no LOW.

- [ ] **Step 4: Run tests and generate Prisma client**

Run: `npm.cmd test -- lib/review-intelligence/rules.test.ts lib/review-intelligence/validation.test.ts`

Expected: PASS. Luego ejecutar `npm.cmd run prisma:generate` y `node ./node_modules/prisma/build/index.js validate`.

- [ ] **Step 5: Commit**

```powershell
git add prisma/schema.prisma prisma/migrations/20260906150000_add_review_yield_finding/migration.sql lib/review-intelligence/types.ts lib/review-intelligence/rules.ts lib/review-intelligence/rules.test.ts lib/review-intelligence/validation.ts
git commit -m "feat: add review yield and apu rules"
```

### Task 5: Pipeline, persistencia y métricas por categoría

**Files:**
- Modify: `lib/review-intelligence/pipeline.ts`
- Modify: `lib/review-intelligence/metrics.ts`
- Modify: `lib/review-intelligence/metrics.test.ts`
- Modify: `lib/review-intelligence/jobs.ts`
- Modify: `lib/review-intelligence/pipeline.test.ts`
- Modify: `lib/review-intelligence/findings.ts`

**Interfaces:** `ReviewRunMetrics` agrega `coverageByCategory: Record<"quantity" | "unit" | "specification" | "apuComponent" | "yield", number>` y `partiallyCoveredSources`. `evidenceData` persiste rendimiento/especificación/componentes; `calculateReviewRunMetrics` conserva la cobertura global V0 y añade conteos V1.

- [ ] **Step 1: Write the failing tests**

Crear una corrida con evidencia de cada categoría y verificar `progressJson.metrics.coverageByCategory`, `partiallyCoveredSources` para fuentes OCR_REQUIRED/FAILED e idempotencia de un hallazgo `YIELD_MISMATCH`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm.cmd test -- lib/review-intelligence/pipeline.test.ts lib/review-intelligence/metrics.test.ts`

Expected: FAIL porque no existe cobertura categorizada.

- [ ] **Step 3: Write minimal implementation**

Centralizar la clasificación para métricas, pasar campos V1 a matching/reglas y serializar sólo valores JSON seguros. Mantener checkpoints, cancelación, stale, leases e IDs deterministas.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm.cmd test -- lib/review-intelligence/pipeline.test.ts lib/review-intelligence/metrics.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add lib/review-intelligence/pipeline.ts lib/review-intelligence/metrics.ts lib/review-intelligence/metrics.test.ts lib/review-intelligence/jobs.ts lib/review-intelligence/pipeline.test.ts lib/review-intelligence/findings.ts
git commit -m "feat: report review coverage by evidence category"
```

### Task 6: Dashboard y detalle de hallazgo

**Files:**
- Modify: `components/review-intelligence/types.ts`
- Modify: `components/review-intelligence/review-intelligence-page.tsx`
- Modify: `components/review-intelligence/review-dashboard.tsx`
- Modify: `components/review-intelligence/finding-detail.tsx`
- Modify: `components/review-intelligence/review-intelligence-page.test.tsx`

**Interfaces:** `ReviewRunView.metrics.coverageByCategory` y `partiallyCoveredSources` son opcionales para corridas V0. `FindingComparisonView.details` muestra rendimiento, especificación y componentes faltantes.

- [ ] **Step 1: Write the failing test**

Renderizar métricas V1 y verificar textos accesibles `Metrados`, `Especificaciones`, `APU`, `Rendimientos` y advertencias de fuentes parciales. Renderizar un hallazgo con `missingComponents` y verificar que el detalle V0 siga visible.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- components/review-intelligence/review-intelligence-page.test.tsx`

Expected: FAIL porque parser/dashboard/detail no renderizan los campos nuevos.

- [ ] **Step 3: Write minimal implementation**

Extender `parseMetrics` con validación runtime, agregar una sección compacta de cobertura por categoría y mostrar detalles enriquecidos dentro del panel existente, manteniendo layout responsive y sin endpoints nuevos.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- components/review-intelligence/review-intelligence-page.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add components/review-intelligence/types.ts components/review-intelligence/review-intelligence-page.tsx components/review-intelligence/review-dashboard.tsx components/review-intelligence/finding-detail.tsx components/review-intelligence/review-intelligence-page.test.tsx
git commit -m "feat: show review coverage categories"
```

### Task 7: Operación, E2E y verificación completa

**Files:**
- Modify: `docs/review-intelligence-operations.md`
- Modify: `tests/e2e/review-intelligence.spec.ts`

- [ ] **Step 1: Add an end-to-end regression scenario**

Extender el flujo existente para ejecutar una revisión con evidencia de metrado/APU, esperar finalización, verificar métricas de cobertura y confirmar el aviso de revisión humana.

- [ ] **Step 2: Run focused checks**

Run: `npm.cmd test -- lib/review-intelligence components/review-intelligence app/api/budgets/[id]/review-runs/route.test.ts`

Expected: PASS.

- [ ] **Step 3: Update operations documentation**

Documentar campos V1, `coverageByCategory`, `YIELD_MISMATCH` y la aplicación de la migración enum en staging.

- [ ] **Step 4: Run full verification**

Ejecutar cada comando por separado y exigir exit code 0:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run prisma:generate
node ./node_modules/prisma/build/index.js validate
git diff --check
```

- [ ] **Step 5: Commit**

```powershell
git add docs/review-intelligence-operations.md tests/e2e/review-intelligence.spec.ts
git commit -m "test: verify review intelligence v1 coverage"
```

## Self-review checklist

- Metrados, especificaciones y APU: Tasks 1–3.
- Reglas de recursos/rendimientos: Task 4.
- Persistencia, provenance, idempotencia y métricas: Task 5.
- Dashboard y detalle: Task 6.
- Operación y verificación: Task 7.
- Comentarios, integraciones y aprendizaje privado quedan fuera de este plan, como exige la especificación del primer vertical.
