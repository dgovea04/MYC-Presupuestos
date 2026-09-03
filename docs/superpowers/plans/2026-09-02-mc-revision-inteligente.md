# MC Revisión Inteligente V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar un vertical slice persistido que cruce documentos PDF/XLSX con un presupuesto y permita revisar hallazgos determinísticos con evidencia y auditoría humana.

**Architecture:** Añadir un dominio Prisma versionado y servicios puros para extracción, matching, validación y revisión. Las rutas Next.js sólo autentican, autorizan y orquestan servicios; un runner local implementa el contrato de job por etapas para poder sustituirse luego por workers. La UI vive dentro de `/budgets/[id]` y consulta resultados persistidos.

**Tech Stack:** Next.js App Router 16, TypeScript strict, Prisma 7, PostgreSQL, Zod 4, Decimal.js/Prisma Decimal, Vitest, React Testing Library, Tailwind, lucide-react y ExcelJS.

**Spec:** `docs/superpowers/specs/2026-09-02-mc-revision-inteligente-design.md`

## Global Constraints

- Todo hallazgo publicado debe tener evidencia primaria accesible.
- `humanReviewRequired` es verdadero y `automaticBudgetMutation` es falso sin excepción.
- Los valores financieros usan `Decimal`; no se usan operaciones binarias para importes.
- Todas las entidades y consultas se aíslan por `companyId`, `projectId` y permisos de sesión.
- Las versiones, reglas, configuraciones, fuentes y decisiones históricas se conservan.
- El contenido de documentos no ejecuta macros, scripts, enlaces ni instrucciones embebidas.
- OCR productivo, almacenamiento externo y workers distribuidos quedan fuera de este incremento.
- Cada ciclo de código nuevo sigue TDD: RED, GREEN, refactor y prueba completa.

---

## File map

- `prisma/schema.prisma`: enums, modelos, relaciones e índices persistentes.
- `lib/review-intelligence/types.ts`: tipos de dominio y contratos públicos.
- `lib/review-intelligence/validation.ts`: esquemas Zod para configuración y payloads.
- `lib/review-intelligence/units.ts`, `calculations.ts`, `priority.ts`: lógica determinística pura.
- `lib/review-intelligence/matching.ts`: señales y score de vínculos.
- `lib/review-intelligence/rules.ts`: cinco reglas de hallazgo.
- `lib/review-intelligence/documents.ts`, `pipeline.ts`, `jobs.ts`: aplicación y procesamiento por etapas.
- `app/api/projects/[id]/review-documents/*`, `app/api/budgets/[id]/review-runs/*`, `app/api/review-*`: API protegida.
- `components/review-intelligence/*`: gestor, dashboard, bandeja y detalle.
- `app/budgets/[id]/review-intelligence/page.tsx`: entrada de navegación dentro del presupuesto.
- `docs/superpowers/specs/2026-09-02-mc-revision-inteligente-design.md`: diseño aprobado.

### Task 1: Modelo persistente y tipos de dominio

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `lib/review-intelligence/types.ts`
- Create: `lib/review-intelligence/validation.ts`
- Test: `lib/review-intelligence/validation.test.ts`

**Interfaces:**
- Produce `ReviewRunStatus`, `ReviewFindingType`, `FindingStatus`, `FindingResolution`, `DocumentStatus`, `EvidenceType`, `ConfidenceLevel` y `ReviewConfiguration`.
- `parseReviewConfiguration(input: unknown): ReviewConfiguration` rechaza tipos no permitidos y límites mayores a 10 archivos, 300 páginas, 50 MB por archivo o 20 hojas.

- [ ] **Step 1: Escribir la prueba RED**

```ts
it("acepta configuración V0 y rechaza límites excedidos", () => {
  expect(() => parseReviewConfiguration({ maxFiles: 10, maxPdfPages: 300, maxFileSizeMb: 50, maxXlsxSheets: 20, tolerancePercent: "1.00", findingTypes: ["QUANTITY_MISMATCH"] })).not.toThrow();
  expect(() => parseReviewConfiguration({ maxFiles: 11, maxPdfPages: 300, maxFileSizeMb: 50, maxXlsxSheets: 20, tolerancePercent: "1.00", findingTypes: ["QUANTITY_MISMATCH"] })).toThrow();
});
```

- [ ] **Step 2: Ejecutar RED**

Run: `npm test -- lib/review-intelligence/validation.test.ts`

Expected: FAIL porque los tipos, el parser y los modelos aún no existen.

- [ ] **Step 3: Implementar mínimo**

Añadir enums Prisma, relaciones a `Project`, `Budget`, `BudgetItem` y `User`, índices tenant/proyecto/estado, y el esquema Zod que devuelve tipos sin `any`. Usar `Json` sólo para estructuras validadas antes de persistir.

- [ ] **Step 4: Ejecutar GREEN y generar cliente**

Run: `npm test -- lib/review-intelligence/validation.test.ts`; `npm run prisma:generate`

Expected: PASS y cliente Prisma actualizado.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma lib/review-intelligence/types.ts lib/review-intelligence/validation.ts lib/review-intelligence/validation.test.ts
git commit -m "feat: add intelligent review domain model"
```

### Task 2: Unidades, cálculos y prioridad determinísticos

**Files:**
- Create: `lib/review-intelligence/units.ts`
- Create: `lib/review-intelligence/calculations.ts`
- Create: `lib/review-intelligence/priority.ts`
- Test: `lib/review-intelligence/calculations.test.ts`
- Test: `lib/review-intelligence/priority.test.ts`

**Interfaces:**
- `normalizeUnit(value: string): NormalizedUnit`
- `calculateQuantityDifference(input: { documentValue: Decimal; budgetValue: Decimal; unitPrice?: Decimal; tolerance: Decimal }): QuantityComparison`
- `calculatePriority(input: PriorityInput): PriorityResult`

- [ ] **Step 1: Escribir pruebas RED** para equivalencias `m²/M2/m2`, valor base cero, tolerancia mayor entre `0.01` y `1%`, impacto negativo y score versionado.
- [ ] **Step 2: Ejecutar RED** con `npm test -- lib/review-intelligence/calculations.test.ts lib/review-intelligence/priority.test.ts`; confirmar fallas por funciones ausentes.
- [ ] **Step 3: Implementar** usando `Prisma.Decimal`/`Decimal.js`; porcentaje `null` cuando el presupuesto sea cero; nunca convertir área/volumen sin regla explícita.
- [ ] **Step 4: Ejecutar GREEN** con el mismo comando y comprobar cero errores.
- [ ] **Step 5: Commit** con `git add lib/review-intelligence && git commit -m "feat: add deterministic review calculations"`.

### Task 3: Matching y reglas de los cinco hallazgos

**Files:**
- Create: `lib/review-intelligence/matching.ts`
- Create: `lib/review-intelligence/rules.ts`
- Test: `lib/review-intelligence/matching.test.ts`
- Test: `lib/review-intelligence/rules.test.ts`

**Interfaces:**
- `matchBudgetItemToEvidence(item: BudgetItemMatchInput, evidence: EvidenceMatchInput[]): EntityLinkCandidate[]`
- `evaluateFindingRules(input: ReviewRuleInput): FindingCandidate[]`

- [ ] **Step 1: Escribir pruebas RED** para código exacto, descripción/unidad compatibles, confianza baja sin inconsistencia, los cinco tipos y requisito de evidencia primaria.
- [ ] **Step 2: Ejecutar RED** con `npm test -- lib/review-intelligence/matching.test.ts lib/review-intelligence/rules.test.ts`.
- [ ] **Step 3: Implementar** scores explicables por señal, niveles configurables, regla de cobertura con el texto obligatorio “No encontramos documentación relacionada con suficiente confianza.” y APU sin agregar recursos.
- [ ] **Step 4: Ejecutar GREEN** y verificar que ninguna regla use texto de IA para decidir.
- [ ] **Step 5: Commit** `git add lib/review-intelligence && git commit -m "feat: detect intelligent review findings"`.

### Task 4: Servicio de documentos y adaptadores de extracción

**Files:**
- Create: `lib/review-intelligence/documents.ts`
- Create: `lib/review-intelligence/extractors.ts`
- Test: `lib/review-intelligence/documents.test.ts`
- Test: `lib/review-intelligence/extractors.test.ts`

**Interfaces:**
- `createProjectDocument(input, client): Promise<ProjectDocumentRecord>`
- `createDocumentVersion(input, client): Promise<DocumentVersionRecord>`
- `extractDocument(input: ExtractionInput): Promise<ExtractionOutput>`

- [ ] **Step 1: Escribir pruebas RED** para MIME/extensión, hash deduplicado, nueva versión, XLSX sin ejecución de macros y evidencia con ubicación real.
- [ ] **Step 2: Ejecutar RED** con `npm test -- lib/review-intelligence/documents.test.ts lib/review-intelligence/extractors.test.ts`.
- [ ] **Step 3: Implementar** validación de 50 MB, 10 archivos, PDF/XLSX, SHA-256, adaptador XLSX basado en ExcelJS y adaptador PDF que consuma el contrato existente de `lib/pdf-import` sin inventar páginas/bounding boxes.
- [ ] **Step 4: Ejecutar GREEN** y conservar warnings para archivos parcialmente procesados.
- [ ] **Step 5: Commit** `git add lib/review-intelligence && git commit -m "feat: add review document extraction services"`.

### Task 5: Pipeline, jobs y persistencia idempotente

**Files:**
- Create: `lib/review-intelligence/pipeline.ts`
- Create: `lib/review-intelligence/jobs.ts`
- Test: `lib/review-intelligence/pipeline.test.ts`
- Test: `lib/review-intelligence/jobs.test.ts`

**Interfaces:**
- `runReviewJob(input: RunReviewJobInput, client): Promise<RunReviewJobResult>`
- `getReviewProgress(reviewRunId: string, companyId: string, client): Promise<ReviewProgress>`
- `requestReviewCancellation(reviewRunId: string, companyId: string, client): Promise<void>`

- [ ] **Step 1: Escribir pruebas RED** para orden de ocho etapas, checkpoints, reintento sin duplicados, `COMPLETED_WITH_WARNINGS`, cancelación cooperativa y ejecución stale.
- [ ] **Step 2: Ejecutar RED** con `npm test -- lib/review-intelligence/pipeline.test.ts lib/review-intelligence/jobs.test.ts`.
- [ ] **Step 3: Implementar** transacciones por etapa, clave idempotente derivada de presupuesto/documentos/configuración/reglas, límites de ejecución activa y runner local explícito.
- [ ] **Step 4: Ejecutar GREEN** y revisar que los hallazgos históricos no se sobrescriban.
- [ ] **Step 5: Commit** `git add lib/review-intelligence && git commit -m "feat: orchestrate persisted review runs"`.

### Task 6: APIs de documentos y ejecuciones

**Files:**
- Create: `app/api/projects/[id]/review-documents/route.ts`
- Create: `app/api/projects/[id]/review-documents/route.test.ts`
- Create: `app/api/review-documents/[id]/classification/route.ts`
- Create: `app/api/budgets/[id]/review-runs/route.ts`
- Create: `app/api/budgets/[id]/review-runs/route.test.ts`
- Create: `app/api/review-runs/[id]/route.ts`
- Create: `app/api/review-runs/[id]/cancel/route.ts`

**Interfaces:**
- Las rutas toman empresa desde `getAuthSession`, verifican acceso al proyecto/presupuesto y delegan a `documents.ts`/`jobs.ts`.
- `POST /api/budgets/:id/review-runs` devuelve `{ reviewRunId, status, idempotencyKey }`.

- [ ] **Step 1: Escribir pruebas RED** para autenticación, tenant cruzado, payload inválido, idempotency key y carga de documentos.
- [ ] **Step 2: Ejecutar RED** con `npm test -- app/api/projects/[id]/review-documents/route.test.ts app/api/budgets/[id]/review-runs/route.test.ts`.
- [ ] **Step 3: Implementar** rutas con `NextResponse`, Zod, paginación y errores consistentes; nunca aceptar `companyId` del cliente ni devolver URL permanente.
- [ ] **Step 4: Ejecutar GREEN** y confirmar respuestas 401/403/400/409 según corresponda.
- [ ] **Step 5: Commit** `git add app/api lib/review-intelligence && git commit -m "feat: expose review documents and runs api"`.

### Task 7: APIs de hallazgos, evidencia, vínculos y decisiones

**Files:**
- Create: `app/api/review-runs/[id]/findings/route.ts`
- Create: `app/api/review-findings/[id]/route.ts`
- Create: `app/api/review-findings/[id]/decisions/route.ts`
- Create: `app/api/review-links/[id]/validate/route.ts`
- Create: `app/api/review-evidence/[id]/view/route.ts`
- Test: rutas equivalentes en `app/api/review-*/**/route.test.ts`

**Interfaces:**
- `listFindings(filters): Promise<PaginatedFindings>` ordena `priority`, `potentialImpact`, `confidence`, `budgetItem.code`.
- `recordFindingDecision(input): Promise<FindingDecisionRecord>` usa `expectedUpdatedAt` y rechaza hallazgos stale sin reconfirmación.

- [ ] **Step 1: Escribir pruebas RED** para filtros, paginación, fuente accesible, decisión auditada, concurrencia y aislamiento tenant.
- [ ] **Step 2: Ejecutar RED** con `npm test -- app/api/review-runs/[id]/findings/route.test.ts app/api/review-findings/[id]/decisions/route.test.ts`.
- [ ] **Step 3: Implementar** consultas con tenant/proyecto, detalle con comparación y provenance, transacción de decisión + auditoría y validación manual del vínculo.
- [ ] **Step 4: Ejecutar GREEN** y comprobar que una decisión no modifica BudgetItem.
- [ ] **Step 5: Commit** `git add app/api/review-* && git commit -m "feat: add review findings and decisions api"`.

### Task 8: UI de Revisión Inteligente

**Files:**
- Create: `app/budgets/[id]/review-intelligence/page.tsx`
- Create: `components/review-intelligence/review-intelligence-page.tsx`
- Create: `components/review-intelligence/document-manager.tsx`
- Create: `components/review-intelligence/review-dashboard.tsx`
- Create: `components/review-intelligence/finding-queue.tsx`
- Create: `components/review-intelligence/finding-detail.tsx`
- Test: `components/review-intelligence/*.test.tsx`
- Modify: navegación existente del presupuesto para incluir el enlace.

**Interfaces:**
- `ReviewIntelligencePageProps = { budgetId: string; projectId: string; initialRun?: ReviewRunView }`.
- `FindingQueue` recibe `PaginatedFindings`, emite `onFilterChange` y `onOpenFinding`.

- [ ] **Step 1: Escribir pruebas RED** para pantalla vacía, estados por etapas, filtros, provenance PDF/XLSX, acciones accesibles y no mutación automática.
- [ ] **Step 2: Ejecutar RED** con `npm test -- components/review-intelligence`.
- [ ] **Step 3: Implementar** componentes client sólo donde haya interacción, estilos del proyecto, dos paneles desktop/apilado móvil, etiquetas “para revisar”, advertencias y CTAs explícitos.
- [ ] **Step 4: Ejecutar GREEN** con las pruebas de componentes.
- [ ] **Step 5: Commit** `git add app/budgets components/review-intelligence && git commit -m "feat: add intelligent review workspace"`.

### Task 9: Integración contextual con Khipu

**Files:**
- Create: `lib/ai/review-intelligence-tools.ts`
- Modify: registro de herramientas existente en `lib/ai`.
- Test: `lib/ai/review-intelligence-tools.test.ts`

**Interfaces:**
- `getReviewSummary(reviewRunId, session): Promise<ReviewSummary>`
- `listReviewFindings(input, session): Promise<PaginatedFindings>`
- `getReviewFinding(findingId, session): Promise<FindingDetail>`
- `getReviewEvidence(evidenceId, session): Promise<EvidenceView>`
- `calculateReviewFindingImpact(findingId, session): Promise<ImpactResult>`
- `recordReviewFindingDecision(input, session): Promise<FindingDecisionRecord>`

- [ ] **Step 1: Escribir prueba RED** que permita consultar resultados persistidos y rechace acceso cross-tenant o cierre implícito.
- [ ] **Step 2: Ejecutar RED** con `npm test -- lib/ai/review-intelligence-tools.test.ts`.
- [ ] **Step 3: Implementar** wrappers con Zod y permisos; el texto de Khipu sólo explica datos/cálculos ya persistidos.
- [ ] **Step 4: Ejecutar GREEN** y comprobar que el proveedor de IA no es necesario para consultar hallazgos.
- [ ] **Step 5: Commit** `git add lib/ai && git commit -m "feat: expose review intelligence tools to khipu"`.

### Task 10: Integración, obsolescencia y verificación final

**Files:**
- Create: `lib/review-intelligence/staleness.ts`
- Test: `lib/review-intelligence/staleness.test.ts`
- Modify: hooks/servicios existentes de cambios de presupuesto y documentos para marcar `STALE`.
- Modify: `README.md` o documentación operativa con configuración de la funcionalidad.

- [ ] **Step 1: Escribir prueba RED** para cambios de cantidad/unidad/descripción/APU, reemplazo de fuente, cambio de regla y tolerancia.
- [ ] **Step 2: Ejecutar RED** con `npm test -- lib/review-intelligence/staleness.test.ts`.
- [ ] **Step 3: Implementar** comparación de fingerprints/versiones y actualización auditable a `STALE` sin borrar resultados.
- [ ] **Step 4: Ejecutar GREEN** y revisar el contrato de cada criterio de aceptación del PRD.
- [ ] **Step 5: Ejecutar verificación completa**

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
git status --short
```

Expected: los cuatro comandos de calidad terminan con código 0; las pruebas reportan cero fallas; `git diff --check` no reporta whitespace; sólo permanecen cambios de la funcionalidad y el PRD original no se incluye en commits accidentales.

- [ ] **Step 6: Commit final**

```bash
git add lib/review-intelligence lib/ai app/api app/budgets components/review-intelligence prisma/schema.prisma README.md
git commit -m "feat: implement MC intelligent review MVP"
```

## Self-review del plan

## Estado de implementación

Implementado en `main` mediante desarrollo dirigido por subagentes. El vertical slice V0 incluye persistencia, extracción digital PDF/XLSX, matching y cinco reglas determinísticas, APIs protegidas, decisiones/auditoría, UI, herramientas Khipu, obsolescencia y lifecycle `UNDER_REVIEW`/`REVIEWED`.

Límites confirmados: OCR para PDFs escaneados, almacenamiento externo, render binario con resaltado nativo y workers distribuidos.

- El modelo persistente, extracción, matching, cinco reglas, prioridad, jobs, auditoría, UI, Khipu, permisos y obsolescencia tienen tareas explícitas.
- No se incluyen OCR productivo, almacenamiento externo, workers distribuidos ni mutaciones automáticas, conforme a la especificación aprobada.
- Las interfaces consumidas por tareas posteriores se definen en tareas anteriores o en la misma tarea.
- Cada función nueva tiene una prueba asociada y cada tarea exige observar RED antes de implementar.
- No quedan placeholders operativos; las extensiones futuras están descritas como límites de alcance, no como pasos pendientes.
