# Especificación arquitectónica: MC Revisión Inteligente ↔ MC Knowledge Perú

**Estado:** aprobada para planificación  
**Fecha:** 2026-09-09  
**Base:** `prd/PRD_Integracion_Avanzada_MC_Revision_Inteligente_MC_Knowledge_Peru.md` y `docs/integration-review-knowledge-audit.md`

## Objetivo

Permitir que decisiones humanas de MC Revisión Inteligente generen señales y conocimiento estructurado, privado por defecto, idempotente y trazable, sin fusionar módulos ni modificar automáticamente presupuestos.

## Invariantes

- `humanReviewRequired = true`.
- `automaticBudgetMutation = false`.
- Review-originated knowledge escribe `PROJECT` salvo una acción administrativa explícita y autorizada.
- Una observación es evidencia estructurada, no verdad confirmada.
- Ninguna ruta Review promueve automáticamente a `GLOBAL`.
- Toda lectura o escritura resuelve company/project desde ownership de base de datos y sesión; los identificadores del cliente son sólo referencias a validar.
- La decisión Review se conserva aunque falle Knowledge.

## Arquitectura

```text
ReviewRun / ReviewFinding / ReviewDecision
              |
              v
Knowledge Learning Bridge
  - authorization
  - evidence/provenance link
  - event mapper
  - observation builders
  - retry/idempotency
              |
              v
Knowledge services
  - events
  - observations
  - assertions
  - retrieval
```

`lib/review-intelligence` no accederá a tablas Knowledge directamente. El bridge vivirá en `lib/knowledge/learning-bridge.ts` y consumirá servicios de Knowledge y las consultas tenant-safe de Review.

## Contrato del bridge

```ts
type ReviewLearningInput = {
  findingId: string;
  decisionId: string;
  actorUserId: string;
  resolution: FindingResolution;
  correlationId: string;
};

type ReviewLearningResult = {
  status: "PROCESSED" | "SKIPPED" | "RETRYABLE_FAILURE";
  eventId?: string;
  observationIds: string[];
  assertionId?: string;
  skipReasons: string[];
};

function processReviewLearning(input: ReviewLearningInput): Promise<ReviewLearningResult>;
```

El bridge recuperará el finding usando `findingId + actor membership`, verificará que la decisión pertenece al finding y cargará ReviewEvidence, DocumentVersion, ProjectDocument, BudgetVersionSnapshot y relaciones de entidad. El actor nunca se toma del payload persistido sin validar la sesión que inició la operación.

## Flujo de datos

1. `recordFindingDecision` guarda decisión y `ReviewAuditEvent` en una transacción Review.
2. En una etapa separada invoca el bridge con `decisionId`, no con valores reconstituidos por UI.
3. El bridge crea/recupera `KnowledgeSource` y `KnowledgeEvidence` con provenance del documento/version y vínculo a `ReviewEvidence`.
4. Registra un `KnowledgeEvent` determinístico.
5. Para resoluciones elegibles crea `PriceObservation`, `YieldObservation`, `KnowledgeApuVersion` y/o assertion en estado `OBSERVED` o `CONFIRMED` según policy explícita.
6. Un error se persiste como integración retryable y no revierte la decisión Review.

## Datos y migraciones

La primera migración nueva agregará:

- `KnowledgeReviewEvidenceLink` con `reviewEvidenceId`, `knowledgeEvidenceId`, `relationType`, `createdById`, `createdAt` y unique por evidencia/par.
- claves idempotentes en artefactos derivados o una tabla de ledger que permita replay seguro.
- `KnowledgeAssertion` lifecycle metadata: `idempotencyKey`, `sourceId`, `evidenceId`, `reviewFindingId`, `reviewDecisionId`, `createdById`, `updatedById`, `rejectionReason`.
- `KnowledgeIntegrationJob` con estado, attempt, nextRetryAt, errorCode, errorMessage, finding/decision, idempotencyKey y timestamps.

No se editarán migraciones aplicadas ni se eliminarán datos históricos.

## Retrieval

`lib/knowledge/retrieval.ts` expondrá un retrieval compuesto y estructurado para items, resources, APUs, prices, yields, assertions y provenance. Cada consulta usa filtros tenant-safe y ranking determinístico: coincidencia exacta, alias confirmado, coincidencia normalizada, contexto regional/proyecto y fecha; precedencia `PROJECT → COMPANY → GLOBAL`. Embeddings quedan fuera de esta versión.

## UI y administración

Review mostrará, cuando exista influencia Knowledge, source, scope, fecha, confidence y enlace a evidencia primaria. La recomendación no sustituye la evidencia documental.

`/admin/knowledge` añadirá vistas de review queue, assertions, observations, evidence/provenance, conflicts, promotion candidates e integration errors. Las mutaciones administrativas usarán `requireAdminSession` y MFA/capability cuando corresponda.

## Rollout

Flags independientes, desactivadas por defecto:

- `knowledge.reviewLearningBridge`
- `knowledge.reviewEnrichment`
- `knowledge.adminReviewQueue`
- `knowledge.backfill`

Primero se habilita el bridge en un workspace interno, luego enrichment sólo lectura. No se habilita promoción global automática.

## Criterios de aceptación

- decisiones y hallazgos siguen disponibles si Knowledge falla;
- cross-tenant reads/writes devuelven 403/404 sin crear filas;
- retries no duplican artefactos;
- provenance recorre finding → evidence → document/version;
- no existe mutación automática de `BudgetItem`;
- tests, typecheck, lint y build pasan.
