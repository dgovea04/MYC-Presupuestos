# PRD — Integración Avanzada de MC Revisión Inteligente + MC Knowledge Perú

**Proyecto:** MC Presupuestos / Mercado y Construcción  
**Documento:** Product Requirements Document + Implementation Blueprint para Codex  
**Versión:** 1.0  
**Fecha:** 2026-09-09  
**Estado:** Proposed / Ready for repository audit  
**Prioridad:** P0/P1  
**Mercado inicial:** Perú  
**Idioma del producto:** Español  
**Arquitectura objetivo:** Learning Loop controlado, trazable, multi-tenant y Human-in-the-Loop

---

# 0. Propósito del documento

Este PRD define la integración avanzada entre:

- **MC Revisión Inteligente**, responsable de analizar presupuestos y documentos técnicos, detectar inconsistencias, mostrar evidencia y registrar decisiones humanas.
- **MC Knowledge Perú**, responsable de conservar, normalizar, validar y reutilizar conocimiento técnico/económico con provenance, scopes y control de privacidad.

El objetivo no es fusionar ambos módulos en uno solo.

El objetivo es construir un **ciclo de aprendizaje controlado**:

```text
Documento / Presupuesto / APU
        ↓
Extracción y evidencia
        ↓
MC Revisión Inteligente
        ↓
Hallazgo
        ↓
Decisión humana
        ↓
Knowledge Event
        ↓
Knowledge Observation / APU Snapshot / Assertion
        ↓
Curación + validación + provenance
        ↓
Knowledge Retrieval
        ↓
Nueva revisión / Khipu / sugerencias
        ↓
Nueva decisión humana
```

La integración debe permitir que la plataforma aprenda de la actividad real sin convertir automáticamente cualquier dato extraído, corrección o decisión en conocimiento global.

---

# 1. Resumen ejecutivo

El estado actual muestra una buena separación arquitectónica:

- MC Revisión Inteligente ya funciona como motor de verificación.
- MC Knowledge Perú ya dispone de una base técnica considerable para eventos, observaciones, entidades canónicas, scopes y provenance.
- La integración actual se concentra principalmente en `KnowledgeEvent`.
- Aún no existe un ciclo completo que transforme evidencia revisada y decisiones humanas en conocimiento reutilizable.

La siguiente etapa debe crear una capa explícita de integración denominada en este documento:

# **Knowledge Learning Bridge**

Su responsabilidad será traducir señales confiables provenientes de MC Revisión Inteligente y MC Presupuestos en entidades de MC Knowledge sin romper:

- aislamiento multi-tenant;
- provenance;
- idempotencia;
- revisión humana;
- privacidad;
- trazabilidad;
- no-mutación automática del presupuesto;
- prohibición de promoción automática a `GLOBAL`.

El resultado esperado es que:

> **MC Revisión Inteligente descubra y valide conocimiento, mientras MC Knowledge Perú lo conserve, organice, califique y reutilice.**

---

# 2. Contexto técnico actual

## 2.1 MC Revisión Inteligente

Capacidades existentes identificadas:

- selección de documentos y versiones;
- extracción de evidencia desde PDF/XLSX;
- evidencia de metrados, unidades, especificaciones, APU y rendimientos;
- matching determinístico con partidas;
- hallazgos por diferencias de cantidades;
- inconsistencias de unidad;
- diferencias de especificaciones;
- documentación faltante;
- APU incompletos;
- diferencias de rendimiento V1;
- severidad;
- prioridad;
- confidence;
- evidencia visible;
- historial de ejecuciones;
- estado `STALE`;
- decisiones humanas;
- requisito de una versión posterior para hallazgos marcados como corregidos;
- exportación;
- cancel/retry/resume con checkpoints.

Principio obligatorio existente:

```text
humanReviewRequired = true
automaticBudgetMutation = false
```

Este principio debe mantenerse en toda la integración.

---

## 2.2 MC Knowledge Perú

Base identificada:

- `KnowledgeSource`;
- `KnowledgeEvidence`;
- `KnowledgeEvent`;
- `CanonicalItem`;
- `CanonicalResource`;
- aliases;
- snapshots/versiones de APU;
- `PriceObservation`;
- `YieldObservation`;
- regiones;
- proveedores;
- scopes:
  - `GLOBAL`;
  - `COMPANY`;
  - `PROJECT`;
  - `USER`;
- confidence levels;
- idempotencia;
- protección parcial del conocimiento global;
- `/admin/knowledge`;
- integración con imports;
- integración parcial con decisiones de MC Revisor.

Estado aproximado identificado:

```text
MC Knowledge V0 Core / Backend Foundation: 60–65%
```

---

# 3. Problema

Actualmente el sistema puede registrar que un hallazgo fue confirmado o rechazado, pero no completa el proceso de aprendizaje.

Ejemplo actual:

```text
ReviewFinding
   ↓
CONFIRMED
   ↓
KnowledgeEvent
```

El flujo termina demasiado pronto.

Ejemplo objetivo:

```text
ReviewFinding
   ↓
CONFIRMED
   ↓
KnowledgeEvent
   ↓
ReviewEvidenceLink
   ↓
YieldObservation / PriceObservation / KnowledgeApuVersion
   ↓
KnowledgeAssertion
   ↓
Review Queue
   ↓
CONFIRMED / VERIFIED / REJECTED / DEPRECATED
   ↓
Retrieval
```

También existe el problema inverso:

```text
Knowledge
   ↓
Retrieval
```

todavía no participa de manera profunda en la generación y evaluación de hallazgos de MC Revisión Inteligente.

Por lo tanto, hoy existe:

- captura de evidencia;
- captura de hallazgos;
- decisiones humanas;
- almacenamiento de conocimiento;

pero falta una **retroalimentación bidireccional gobernada**.

---

# 4. Visión del producto

Construir un sistema donde cada proyecto contribuya a mejorar la calidad futura de la plataforma sin comprometer datos privados.

La visión es:

```text
MC Presupuestos
      │
      ├──────► actividad cotidiana
      │
      ▼
MC Revisión Inteligente
      │
      ├──────► evidencia
      ├──────► hallazgos
      ├──────► decisiones humanas
      │
      ▼
Knowledge Learning Bridge
      │
      ▼
MC Knowledge Perú
      │
      ├──────► memoria de proyecto
      ├──────► memoria de empresa
      ├──────► conocimiento validado
      ├──────► provenance
      ├──────► observaciones
      └──────► retrieval
                  │
                  ├────► MC Revisor
                  ├────► Khipu
                  ├────► APU
                  └────► análisis futuros
```

---

# 5. Objetivos

## 5.1 Objetivo principal

Convertir MC Revisión Inteligente + MC Knowledge Perú en un **Learning Loop controlado y auditable**.

## 5.2 Objetivos funcionales

1. Vincular directamente `ReviewEvidence` con `KnowledgeEvidence`.
2. Traducir decisiones confirmadas en observaciones estructuradas.
3. Registrar:
   - precios;
   - rendimientos;
   - correcciones de unidad;
   - asociaciones de partidas;
   - asociaciones de recursos;
   - snapshots de APU;
   - cambios técnicos relevantes.
4. Implementar `KnowledgeAssertion` como lifecycle operativo.
5. Habilitar retrieval compuesto para:
   - partidas;
   - recursos;
   - APU;
   - precios;
   - rendimientos;
   - provenance.
6. Consumir Knowledge desde MC Revisión Inteligente.
7. Mantener scope inicial `PROJECT` o `COMPANY`.
8. Requerir promoción explícita para `GLOBAL`.
9. Mantener evidencia y fuentes visibles.
10. Incorporar review queue administrativa.
11. Fortalecer tenant isolation.
12. Implementar observabilidad y feature flags.

## 5.3 Objetivos de producto

- reducir falsos positivos;
- aumentar consistencia de matching;
- detectar hallazgos con mejor contexto;
- reutilizar correcciones humanas;
- mejorar recomendaciones de APU;
- construir histórico de precios/rendimientos;
- crear progresivamente el data moat de construcción peruana.

---

# 6. No objetivos

Esta versión NO debe:

- usar semantic search como requisito P0;
- construir benchmarks públicos automáticos;
- promover observaciones privadas a `GLOBAL` automáticamente;
- entrenar un modelo con datos de clientes;
- modificar presupuestos automáticamente;
- aceptar evidencia extraída como verdad sin validación;
- generar un “precio correcto” universal;
- construir anomaly detection avanzado en P0;
- mezclar datos de empresas sin autorización;
- reemplazar el motor determinístico por un LLM;
- hacer cambios masivos a modelos existentes sin auditoría previa;
- reescribir MC Revisión Inteligente;
- reescribir MC Knowledge desde cero.

---

# 7. Principios arquitectónicos

## 7.1 Human in the Loop

Toda señal técnica con impacto reutilizable debe conservar:

- origen;
- evidencia;
- decisión humana;
- confidence;
- scope;
- actor;
- fecha;
- contexto.

## 7.2 Observation is not Truth

```text
Observation ≠ Assertion
Assertion ≠ Verified Knowledge
Verified Knowledge ≠ Global Knowledge
```

## 7.3 No Automatic Global Promotion

Nunca:

```text
PROJECT → GLOBAL
```

por automatismo.

Debe existir:

```text
PROJECT
  ↓
COMPANY
  ↓
CANDIDATE_FOR_GLOBAL
  ↓
ADMIN REVIEW
  ↓
GLOBAL
```

## 7.4 Deterministic First

Los cálculos deben permanecer en servicios determinísticos.

La IA puede:

- extraer;
- clasificar;
- sugerir;
- rankear;
- detectar candidatos.

La IA no debe decidir silenciosamente:

- cantidad final;
- precio definitivo;
- rendimiento definitivo;
- modificación del presupuesto;
- promoción de conocimiento.

## 7.5 Provenance Everywhere

Toda observación creada desde Review debe poder navegar de regreso a:

```text
KnowledgeObservation
   ↓
KnowledgeEvidence
   ↓
ReviewEvidence
   ↓
DocumentVersion
   ↓
Document
   ↓
Project
```

## 7.6 Tenant Isolation by Default

Toda escritura debe resolver y validar explícitamente:

```text
userId
companyId
projectId
scope
```

No se debe confiar únicamente en IDs suministrados por el cliente.

---

# 8. Arquitectura objetivo

## 8.1 Componentes principales

```text
┌───────────────────────────────────────────────────┐
│                MC Presupuestos                    │
│ Budget / APU / Resources / Prices / Yields        │
└──────────────────────┬────────────────────────────┘
                       │ Domain Events
                       ▼
┌───────────────────────────────────────────────────┐
│             MC Revisión Inteligente               │
│ Evidence → Matching → Findings → Human Decision   │
└──────────────────────┬────────────────────────────┘
                       │
                       │ Review Learning Signals
                       ▼
┌───────────────────────────────────────────────────┐
│              Knowledge Learning Bridge            │
│                                                   │
│ Event Mapper                                      │
│ Evidence Linker                                   │
│ Observation Builder                               │
│ Assertion Builder                                 │
│ Scope Resolver                                    │
│ Confidence Resolver                               │
│ Idempotency Guard                                 │
└──────────────────────┬────────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────────┐
│               MC Knowledge Perú                   │
│                                                   │
│ Canonical Items / Resources                       │
│ APU Versions                                      │
│ Price / Yield Observations                        │
│ Assertions                                        │
│ Sources / Evidence / Provenance                    │
│ Regions / Suppliers                               │
└──────────────────────┬────────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────────┐
│               Knowledge Retrieval                 │
│ structured search + ranking + scope precedence    │
└───────────────┬───────────────────┬───────────────┘
                │                   │
                ▼                   ▼
        MC Revisión Inteligente    Khipu
```

---

# 9. Nuevo componente: Knowledge Learning Bridge

## 9.1 Responsabilidad

Crear una capa explícita entre Review y Knowledge.

No dispersar lógica de traducción entre:

- controllers;
- UI;
- route handlers;
- Prisma calls directos.

Ruta sugerida:

```text
lib/
  knowledge/
    integrations/
      review-learning/
        index.ts
        mapper.ts
        evidence-linker.ts
        observation-builder.ts
        assertion-builder.ts
        scope-resolver.ts
        confidence-resolver.ts
        idempotency.ts
        contracts.ts
```

Codex debe adaptar esta ubicación después de auditar la estructura real.

## 9.2 Contrato de entrada

Ejemplo conceptual:

```ts
type ReviewLearningSignal = {
  reviewRunId: string;
  findingId: string;
  resolution: ReviewFindingResolution;
  companyId: string;
  projectId: string;
  userId: string;
  budgetId?: string;
  baseBudgetVersionId?: string;
  correctedBudgetVersionId?: string;
  evidenceIds: string[];
  canonicalItemId?: string;
  canonicalResourceId?: string;
  occurredAt: Date;
};
```

## 9.3 Contrato de salida

```ts
type ReviewLearningResult = {
  knowledgeEventId: string;
  knowledgeEvidenceIds: string[];
  createdObservationIds: string[];
  createdApuVersionIds: string[];
  createdAssertionIds: string[];
  skippedReasons: string[];
};
```

---

# 10. Taxonomía de eventos

## 10.1 Eventos existentes a preservar

- `REVIEW_ISSUE_CONFIRMED`
- `REVIEW_ISSUE_REJECTED`
- `IMPORT_COMPLETED`

## 10.2 Nuevos eventos recomendados

### Review

```text
REVIEW_FINDING_CONFIRMED
REVIEW_FINDING_REJECTED
REVIEW_FINDING_FALSE_POSITIVE
REVIEW_FINDING_VALID_AS_IS
REVIEW_FINDING_CORRECTED
REVIEW_FINDING_NEEDS_INFO
REVIEW_FINDING_NOT_APPLICABLE
```

### Evidence

```text
REVIEW_EVIDENCE_CONFIRMED
REVIEW_EVIDENCE_REJECTED
REVIEW_EVIDENCE_LINKED_TO_ITEM
REVIEW_EVIDENCE_LINKED_TO_RESOURCE
```

### Technical corrections

```text
UNIT_CORRECTION_CONFIRMED
ITEM_LINK_CONFIRMED
RESOURCE_LINK_CONFIRMED
QUANTITY_CORRECTION_CONFIRMED
PRICE_CORRECTION_CONFIRMED
YIELD_CORRECTION_CONFIRMED
APU_CHANGE_CONFIRMED
SPECIFICATION_CONFLICT_CONFIRMED
```

### Knowledge lifecycle

```text
KNOWLEDGE_OBSERVATION_CREATED
KNOWLEDGE_ASSERTION_CREATED
KNOWLEDGE_ASSERTION_CONFIRMED
KNOWLEDGE_ASSERTION_VERIFIED
KNOWLEDGE_ASSERTION_REJECTED
KNOWLEDGE_ASSERTION_DEPRECATED
KNOWLEDGE_ASSERTION_PROMOTION_REQUESTED
KNOWLEDGE_ASSERTION_PROMOTED
```

---

# 11. Matriz de resolución → acción de Knowledge

| Resolución Review | Crear evento | Crear observación | Crear assertion | Auto-promover |
|---|---:|---:|---:|---:|
| CONFIRMED | Sí | Según tipo | Sí/candidato | No |
| CORRECTED | Sí | Sí, si hay before/after | Sí | No |
| VALID_AS_IS | Sí | Opcional | Opcional | No |
| FALSE_POSITIVE | Sí | No | No | No |
| REJECTED | Sí | No | No | No |
| NEEDS_MORE_INFO | Sí | No | No | No |
| NOT_APPLICABLE | Sí | No | No | No |

Regla:

> Un hallazgo confirmado no implica necesariamente una observación. Debe existir un extractor/mapper determinístico capaz de producir una entidad válida con unidad, fuente, scope y provenance suficientes.

---

# 12. ReviewEvidence ↔ KnowledgeEvidence

## 12.1 Problema actual

Los modelos viven separados.

## 12.2 Solución

Crear una relación explícita.

Opción preferida:

```text
KnowledgeEvidence
  reviewEvidenceId? FK / logical reference
```

Si una FK directa no es adecuada por límites del modelo actual, crear tabla puente:

```text
KnowledgeReviewEvidenceLink
- id
- knowledgeEvidenceId
- reviewEvidenceId
- reviewFindingId?
- relationType
- createdAt
- createdByUserId
```

## 12.3 relationType

```text
SOURCE
SUPPORTS
CONTRADICTS
DERIVED_FROM
VALIDATED_BY
```

## 12.4 Requisito

Desde `/admin/knowledge` un revisor debe poder navegar:

```text
Assertion
→ Observation
→ KnowledgeEvidence
→ ReviewEvidence
→ document/page/sheet/cell
→ original finding
→ human decision
```

---

# 13. Creación de observaciones

## 13.1 YieldObservation

Crear cuando:

- el hallazgo sea relacionado a rendimiento;
- exista valor documentado;
- exista unidad compatible;
- exista partida/recurso identificado;
- la evidencia sea visible;
- exista resolución humana válida.

Campos mínimos:

```text
canonicalItemId / canonicalResourceId
value
unit
scope
companyId
projectId
sourceId
evidenceId
observedAt
confidence
createdFrom = REVIEW
reviewFindingId
```

## 13.2 PriceObservation

Crear cuando se disponga de:

- recurso canónico;
- monto;
- moneda;
- unidad;
- fecha o fecha del documento;
- fuente;
- proyecto/empresa;
- evidencia.

Campos deseables:

```text
regionId?
supplierId?
supplierRuc?
taxIncluded?
currency
normalizedUnit?
normalizedValue?
```

No bloquear creación P0 si región/proveedor no existe, siempre que provenance sea suficiente.

## 13.3 KnowledgeApuVersion

Crear snapshot cuando:

- un APU relacionado a un hallazgo es confirmado;
- existe una corrección;
- existe versión anterior y/o posterior;
- el usuario valida el resultado.

Debe conservar:

```text
sourceBudgetId
sourceBudgetVersionId
canonicalItemId
scope
companyId
projectId
snapshot
hash
createdFrom
reviewFindingId
```

---

# 14. Correcciones before/after

Para hallazgos `CORRECTED`, conservar siempre:

```text
before
after
delta
```

Ejemplo:

```ts
type KnowledgeCorrectionSnapshot<T> = {
  before: T;
  after: T;
  changedFields: string[];
  baseVersionId: string;
  correctedVersionId: string;
};
```

Casos prioritarios:

- unidad;
- metrado;
- rendimiento;
- precio;
- composición APU;
- resource mapping;
- item mapping.

No inferir una corrección si no existe versión posterior verificable.

---

# 15. KnowledgeAssertion lifecycle

## 15.1 Estados

Implementar formalmente:

```text
OBSERVED
   ↓
CONFIRMED
   ↓
VERIFIED
   ↓
CANONICAL
```

Estados laterales:

```text
REJECTED
DEPRECATED
CONFLICTED
```

## 15.2 Reglas

### OBSERVED

Creada automáticamente desde una observación válida.

### CONFIRMED

Requiere una de:

- decisión humana explícita;
- evidencia confirmada;
- confirmación de administrador.

### VERIFIED

Requiere política más estricta.

Ejemplo V1:

- 2+ observaciones independientes; o
- 1 observación + revisión admin; o
- fuente institucional/autorizada + revisión.

### CANONICAL

No significa GLOBAL.

Significa que dentro del scope correspondiente la assertion es candidata principal.

### GLOBAL

Debe ser una dimensión separada del estado.

Ejemplo:

```text
status = VERIFIED
scope = COMPANY
```

o:

```text
status = CANONICAL
scope = GLOBAL
```

---

# 16. Promoción de conocimiento

## 16.1 Flujo

```text
PROJECT
  ↓ user/company approval
COMPANY
  ↓ aggregation/anonymization eligibility
GLOBAL_CANDIDATE
  ↓ superadmin review
GLOBAL
```

## 16.2 Prohibiciones

No permitir:

```text
project observation → global
```

directamente.

## 16.3 Consentimiento

Agregar política explícita antes de cualquier promoción cross-company.

Propuesta:

```text
KnowledgeSharingPolicy
- companyId
- allowAnonymizedContribution
- allowBenchmarkContribution
- allowGlobalPromotionCandidate
- updatedAt
- updatedBy
```

En P0 puede implementarse con defaults conservadores:

```text
false
false
false
```

---

# 17. Scope resolution

## 17.1 Orden de lectura recomendado

Para requests contextualizados a proyecto:

```text
PROJECT
→ COMPANY
→ GLOBAL
```

`USER` puede incorporarse únicamente si el producto realmente utiliza working context personal.

## 17.2 Escritura desde Review

Default:

```text
scope = PROJECT
```

Promoción a COMPANY solo:

- por acción explícita;
- o por regla de empresa aprobada.

## 17.3 Nunca aceptar scope ciegamente desde client input

El servidor debe derivar scope permitido desde:

- sesión;
- membership;
- company;
- project;
- role;
- policy.

---

# 18. Seguridad y tenancy — P0 absoluto

El diagnóstico identifica riesgo en rutas de:

- observaciones de precio;
- observaciones de rendimiento;
- fuentes;
- evidencia.

Antes de ampliar integración, Codex debe auditar y cerrar este problema.

## 18.1 Regla

Todas las rutas Knowledge que leen o escriben datos tenant-aware deben usar un guard central.

Ejemplo:

```ts
await assertKnowledgeApiScopeAccess({
  userId: session.user.id,
  companyId,
  projectId,
  scope,
  action: "write",
});
```

## 18.2 Nunca confiar en

```text
body.companyId
body.projectId
```

sin resolver ownership.

## 18.3 Pruebas obligatorias

- usuario A no puede leer project B;
- usuario A no puede crear observación para company B;
- user scope no puede acceder otro user;
- company admin no puede mutar global;
- superadmin puede operar global;
- una ruta sin projectId no debe ampliar scope accidentalmente.

---

# 19. Retrieval V1 avanzado

## 19.1 Objetivo

Reemplazar el retrieval limitado a partidas canónicas por texto por un retrieval compuesto.

## 19.2 Tipos de resultado

```ts
type KnowledgeRetrievalResult = {
  items: CanonicalItemCandidate[];
  resources: CanonicalResourceCandidate[];
  apuVersions: ApuCandidate[];
  priceObservations: PriceCandidate[];
  yieldObservations: YieldCandidate[];
  assertions: AssertionCandidate[];
  provenance: ProvenanceSummary[];
};
```

## 19.3 Filtros

```text
query
companyId
projectId
scope[]
regionId?
dateFrom?
dateTo?
canonicalItemId?
canonicalResourceId?
unit?
currency?
confidenceMin?
status?
```

## 19.4 Ranking inicial

Sin embeddings en P0.

Ranking determinístico:

```text
score =
  exact_name_match
+ alias_match
+ normalized_name_match
+ scope_priority
+ recency
+ confidence
+ evidence_quality
+ status_weight
```

## 19.5 Scope priority

Ejemplo:

```text
PROJECT  = 1.00
COMPANY  = 0.85
GLOBAL   = 0.70
```

No interpretar esos números como verdad técnica; Codex debe centralizarlos como policy configurable.

---

# 20. Integración Knowledge → MC Revisión Inteligente

La integración debe ser bidireccional.

## 20.1 Pre-review enrichment

Antes de ejecutar reglas, Review puede solicitar:

```text
canonical item candidates
resource candidates
APU candidates
historical yields
historical prices
known aliases
verified assertions
```

## 20.2 Uso permitido

Knowledge puede:

- mejorar matching;
- aportar contexto;
- generar referencias;
- elevar/bajar confidence;
- mostrar comparación histórica.

## 20.3 Uso no permitido

Knowledge NO debe:

- invalidar evidencia documental;
- cambiar el presupuesto;
- emitir una corrección automática;
- ocultar el source document;
- reemplazar decisión humana.

---

# 21. Knowledge-assisted matching

Agregar un paso opcional:

```text
Review Evidence
      ↓
Deterministic normalization
      ↓
Knowledge candidates
      ↓
Candidate ranking
      ↓
Review matcher
```

Ejemplo:

```text
"Concreto f'c=210 kg/cm2 en vigas"
```

puede mapearse mediante:

- canonical name;
- aliases;
- project-specific aliases;
- company aliases.

Registrar siempre:

```text
matchedBy
matchScore
candidateCount
knowledgeEntityId
```

---

# 22. Retrieval provenance en UI

Cuando Review use información de Knowledge, mostrar:

```text
Origen:
- Proyecto actual
- Empresa
- Base global verificada

Fecha:
- 2026-08-15

Evidencia:
- Documento X, página Y
- Presupuesto Z, versión N

Confidence:
- Alto / Medio / Bajo
```

Evitar UI del tipo:

> “La IA dice que el rendimiento correcto es X.”

Preferir:

> “En este proyecto se documentó X; el APU usa Y. La diferencia fue confirmada previamente en una revisión del proyecto.”

---

# 23. Integración con Khipu

No es P0 para cerrar Review + Knowledge, pero el contrato debe quedar listo.

Khipu debe consumir únicamente mediante Retrieval, no directamente desde tablas Prisma.

```text
Khipu
  ↓
Knowledge Retrieval API
  ↓
Policy + Scope + Ranking
  ↓
Knowledge
```

Esto evita bypass de tenancy y provenance.

---

# 24. APIs objetivo

Codex debe reutilizar las APIs existentes cuando sea viable.

Endpoints conceptuales:

```text
POST /api/knowledge/review-learning/process
GET  /api/knowledge/retrieval
GET  /api/knowledge/assertions
POST /api/knowledge/assertions/:id/confirm
POST /api/knowledge/assertions/:id/verify
POST /api/knowledge/assertions/:id/reject
POST /api/knowledge/assertions/:id/deprecate
POST /api/knowledge/assertions/:id/request-promotion
POST /api/knowledge/assertions/:id/promote
GET  /api/knowledge/review-queue
GET  /api/knowledge/conflicts
```

No crear endpoint duplicado si ya existe una ruta equivalente.

---

# 25. Idempotencia

Toda integración Review → Knowledge debe ser idempotente.

Ejemplo de key:

```text
review-learning:{findingId}:{resolution}:{budgetVersionId}
```

Para observaciones:

```text
review-observation:{findingId}:{evidenceId}:{observationType}:{valueHash}
```

Para APU:

```text
review-apu:{findingId}:{correctedBudgetVersionId}:{snapshotHash}
```

Un retry no debe duplicar:

- eventos;
- evidence links;
- observations;
- assertions;
- snapshots.

---

# 26. Transacciones

El procesamiento de un `ReviewLearningSignal` debe ser consistente.

Preferencia:

```text
1. validar tenancy
2. validar finding + resolution
3. resolver evidence
4. registrar event
5. crear links
6. crear observations
7. crear assertions
8. persistir audit
```

Usar transacción cuando las operaciones dependan entre sí.

No mantener transacciones largas durante OCR, IA o llamadas externas.

---

# 27. Manejo de fallos

## 27.1 Filosofía

Una falla en Knowledge no debe corromper la decisión de Review.

Ejemplo:

```text
User confirms finding
      ↓
Review decision committed
      ↓
Knowledge integration fails
      ↓
Review remains valid
      ↓
Knowledge event marked retryable
```

## 27.2 Retry

Crear estado o job retryable.

Conceptualmente:

```text
PENDING
PROCESSING
PROCESSED
FAILED_RETRYABLE
FAILED_FINAL
```

## 27.3 Dead-letter / admin visibility

Los fallos finales deben aparecer en:

```text
/admin/knowledge/integration-errors
```

o sección equivalente.

---

# 28. Admin Knowledge Console V1

Expandir `/admin/knowledge`.

## 28.1 Secciones

```text
Overview
Review Queue
Assertions
Observations
Evidence
Conflicts
Canonical Items
Canonical Resources
APU Versions
Sources
Events
Integration Errors
```

## 28.2 Filtros

- scope;
- company;
- project;
- confidence;
- status;
- type;
- date;
- source;
- region;
- unresolved only.

## 28.3 Acciones

- confirm;
- verify;
- reject;
- deprecate;
- merge alias;
- link canonical entity;
- request promotion;
- promote a GLOBAL;
- inspect provenance.

---

# 29. Review Queue

## 29.1 Items

La cola debe priorizar:

1. assertions de alta utilidad;
2. conflictos;
3. valores con alta repetición;
4. knowledge candidates sin canonical mapping;
5. promotion candidates;
6. integration errors.

## 29.2 Priority score

P0 puede usar lógica determinística:

```text
priority =
impact
+ numberOfSupportingObservations
+ freshness
+ scopeRelevance
+ conflictWeight
```

---

# 30. Conflict detection V1

No implementar anomaly detection completo.

Sí detectar conflictos simples.

Ejemplos:

```text
same canonical resource
same region
same unit
similar date
materially different price
```

o:

```text
same canonical item
same context
different yield
```

Estado:

```text
OPEN
RESOLVED
ACCEPTED_VARIANCE
DEPRECATED_SOURCE
```

---

# 31. Data model — cambios conceptuales

Codex debe inspeccionar `prisma/schema.prisma` antes de modificar.

Posibles adiciones:

## 31.1 KnowledgeReviewEvidenceLink

```prisma
model KnowledgeReviewEvidenceLink {
  id                  String   @id @default(cuid())
  knowledgeEvidenceId String
  reviewEvidenceId    String
  reviewFindingId     String?
  relationType        String
  createdByUserId     String?
  createdAt           DateTime @default(now())

  @@unique([knowledgeEvidenceId, reviewEvidenceId, relationType])
  @@index([reviewEvidenceId])
  @@index([reviewFindingId])
}
```

## 31.2 KnowledgeAssertion lifecycle fields

Si no existen:

```text
status
scope
confirmedAt
confirmedByUserId
verifiedAt
verifiedByUserId
deprecatedAt
deprecatedByUserId
promotionStatus
```

## 31.3 IntegrationJob

Opcional si no existe infraestructura de jobs:

```text
KnowledgeIntegrationJob
- id
- eventId
- entityType
- entityId
- status
- attempts
- lastError
- nextRetryAt
- createdAt
- updatedAt
```

Preferir infraestructura existente si ya hay jobs/checkpoints.

---

# 32. Migración y backfill

## 32.1 No hacer backfill destructivo

Los datos históricos deben transformarse como:

```text
candidate / observed
```

no como `VERIFIED`.

## 32.2 Backfill recomendado

### Partidas

```text
existing items → CanonicalItem candidates
```

### Recursos

```text
existing resources → CanonicalResource candidates
```

### APU

```text
existing APU → KnowledgeApuVersion
scope = COMPANY or PROJECT
source = MIGRATION
```

### Precios

```text
existing prices → PriceObservation
confidence = imported / historical
```

## 32.3 Re-ejecutable

Todo script de backfill debe:

- ser idempotente;
- soportar dry-run;
- reportar conteos;
- generar errores por fila;
- no cambiar source data.

---

# 33. Feature flags

Agregar rollout explícito.

Flags recomendadas:

```text
knowledge_events_v0
knowledge_review_learning
knowledge_evidence_links
knowledge_observations_from_review
knowledge_assertions_v1
knowledge_retrieval_v1
knowledge_review_enrichment
knowledge_admin_review_queue
knowledge_company_promotion
knowledge_global_promotion
```

## 33.1 Rollout

```text
0% → internal
5% → selected testers
25% → beta cohort
100% → enabled
```

Si el proyecto no dispone de plataforma de feature flags, usar mecanismo simple y centralizado existente, no agregar un SaaS sin necesidad.

---

# 34. Observabilidad

Eventos mínimos:

```text
knowledge.event.received
knowledge.event.processed
knowledge.event.failed

knowledge.review_learning.started
knowledge.review_learning.completed
knowledge.review_learning.failed

knowledge.evidence.linked
knowledge.observation.created
knowledge.observation.skipped

knowledge.assertion.created
knowledge.assertion.state_changed

knowledge.retrieval.request
knowledge.retrieval.result
knowledge.retrieval.empty

knowledge.scope.denied
knowledge.promotion.requested
knowledge.promotion.completed
```

Campos:

```text
requestId
userId
companyId
projectId
reviewRunId?
findingId?
knowledgeEntityType?
knowledgeEntityId?
scope
durationMs
resultCount?
errorCode?
```

Evitar enviar contenido técnico sensible completo a logs.

---

# 35. Métricas

## 35.1 Product metrics

- % de findings confirmados que generan Knowledge;
- % de findings corregidos con before/after válido;
- tasa de observaciones creadas;
- tasa de assertions confirmadas;
- tasa de assertions verificadas;
- reutilización de Knowledge en revisiones posteriores;
- reducción de falsos positivos;
- incremento de matching confidence;
- cantidad de proyectos aportando knowledge.

## 35.2 Quality metrics

```text
precision of canonical matching
evidence coverage
provenance completeness
tenant isolation failures = 0
duplicate observation rate
invalid promotion rate = 0
```

## 35.3 Data moat metric

Medir:

```text
validated observations with provenance
```

no solo número total de filas.

---

# 36. UX — MC Revisión Inteligente

Agregar indicadores cuando un hallazgo use Knowledge.

Ejemplo:

```text
[Basado en documento]
[Comparado con conocimiento del proyecto]
```

Detalle expandible:

```text
Conocimiento relacionado
- APU similar: ...
- Rendimiento observado: ...
- Fuente: ...
- Fecha: ...
- Scope: Proyecto
- Confidence: ...
```

Nunca ocultar la evidencia primaria del review.

---

# 37. UX — Corrección confirmada

Cuando el usuario marque `CORRECTED`:

1. validar versión posterior;
2. calcular delta;
3. mostrar resumen;
4. confirmar decisión;
5. registrar Knowledge en background/after commit;
6. mostrar estado:

```text
Corrección registrada.
Esta decisión podrá contribuir al conocimiento del proyecto.
```

No decir:

```text
La IA aprendió automáticamente.
```

---

# 38. Reglas por tipo de finding

## 38.1 UNIT_MISMATCH

Al confirmar/corregir:

- event;
- item link;
- unit assertion;
- before/after si aplica.

## 38.2 QUANTITY_MISMATCH

Guardar observación del caso, pero no crear una regla global sobre “cantidad correcta”.

## 38.3 YIELD_MISMATCH

Crear `YieldObservation` cuando exista evidencia suficiente.

## 38.4 PRICE_MISMATCH

Crear `PriceObservation` únicamente si:

- recurso;
- unidad;
- moneda;
- fecha;
- fuente;

son identificables.

## 38.5 APU_INCOMPLETE

Crear snapshot APU + assertion sobre composición únicamente con validación humana.

## 38.6 SPECIFICATION_CONFLICT

Registrar assertion contextual, sin convertir texto libre automáticamente en regla global.

---

# 39. Reglas de confidence

Separar:

```text
extractionConfidence
matchingConfidence
humanValidationConfidence
knowledgeConfidence
```

No reutilizar un solo campo para todos.

Ejemplo conceptual:

```ts
type KnowledgeConfidence = {
  extraction?: number;
  matching?: number;
  humanValidated: boolean;
  evidenceQuality: "LOW" | "MEDIUM" | "HIGH";
  final: "LOW" | "MEDIUM" | "HIGH";
};
```

---

# 40. Provenance completeness

Una observación creada desde Review debe tener como mínimo:

```text
source
evidence
project
company
actor
timestamp
reviewFinding
```

Según tipo:

```text
documentVersion
page/sheet/cell
budgetVersion
canonical entity
region
supplier
```

---

# 41. Privacy

## 41.1 Default

Datos creados desde un proyecto:

```text
PRIVATE TO PROJECT
```

## 41.2 Company reuse

Solo dentro de la misma empresa cuando policy lo permita.

## 41.3 Cross-company

No disponible por default.

## 41.4 Global datasets

Requieren:

- permiso;
- anonimización cuando corresponda;
- revisión;
- provenance permitido;
- ausencia de datos confidenciales.

---

# 42. Auditoría

Toda transición debe crear audit trail.

Ejemplo:

```text
Assertion OBSERVED → CONFIRMED
who
when
why
source resolution
previous state
new state
```

No depender únicamente de `updatedAt`.

---

# 43. Performance

Retrieval P0 debe funcionar sin vector DB.

Objetivos iniciales orientativos:

```text
p95 structured retrieval < 500 ms
p95 review enrichment < 1 s
```

En datasets pequeños/medianos.

Codex debe medir antes de introducir infraestructura compleja.

Índices sugeridos dependen del schema real:

```text
companyId
projectId
scope
canonicalItemId
canonicalResourceId
observedAt
status
regionId
```

---

# 44. Cache

Cache únicamente resultados seguros por scope.

Key conceptual:

```text
knowledge:v1:{companyId}:{projectId}:{queryHash}:{filtersHash}
```

Nunca usar una cache compartida que pueda mezclar tenants.

Invalidar cuando:

- nueva observation relevante;
- assertion cambia;
- canonical alias cambia;
- promotion cambia scope.

---

# 45. Implementación por fases

# Fase 0 — Repository Audit

Codex debe inspeccionar:

```text
prisma/schema.prisma
lib/knowledge/*
lib/review-intelligence/*
app/api/knowledge/*
app/api/imports/*
components/review-intelligence/*
app/admin/knowledge/*
tests relacionados
feature flag infrastructure
auth / membership / tenancy helpers
logging / analytics
job/checkpoint infrastructure
```

Entregable:

```text
docs/integration-review-knowledge-audit.md
```

Debe incluir:

- lo existente;
- diferencias respecto a este PRD;
- riesgos;
- archivos exactos a modificar;
- migraciones necesarias;
- decisión sobre tabla puente vs FK;
- estrategia de jobs/retry.

No escribir cambios masivos antes de completar esta auditoría.

---

# Fase 1 — Security hardening

Prioridad P0.

Tareas:

```text
[ ] Auditar todas las rutas /api/knowledge
[ ] Centralizar scope authorization
[ ] Validar company/project ownership
[ ] Añadir tests cross-tenant
[ ] Proteger writes GLOBAL
[ ] Revisar reads por scope
```

Exit criteria:

```text
cross-tenant write tests = 0 unauthorized successes
```

---

# Fase 2 — Evidence Bridge

Implementar:

```text
ReviewEvidence ↔ KnowledgeEvidence
```

Tareas:

```text
[ ] Crear relación / bridge
[ ] Añadir relationType
[ ] Añadir helpers
[ ] Añadir provenance traversal
[ ] Tests idempotentes
```

---

# Fase 3 — Learning Events

Completar eventos de Review.

Tareas:

```text
[ ] Resolution event mapping
[ ] Unit correction event
[ ] Item link event
[ ] Resource link event
[ ] Evidence confirmed event
[ ] Price/yield/APU change events
```

---

# Fase 4 — Observation Builders

Implementar:

```text
[ ] PriceObservation from Review
[ ] YieldObservation from Review
[ ] KnowledgeApuVersion from Review
[ ] Skip reasons
[ ] Idempotency
[ ] Provenance completeness
```

Default:

```text
scope = PROJECT
```

---

# Fase 5 — KnowledgeAssertion lifecycle

Implementar:

```text
[ ] service layer
[ ] transitions
[ ] permissions
[ ] audit
[ ] conflict state
[ ] rejection
[ ] deprecation
[ ] admin actions
```

---

# Fase 6 — Retrieval V1

Expandir `lib/knowledge/retrieval.ts`.

Tareas:

```text
[ ] CanonicalItem
[ ] CanonicalResource
[ ] APU versions
[ ] Price observations
[ ] Yield observations
[ ] Assertions
[ ] provenance summaries
[ ] filters
[ ] scope precedence
[ ] ranking
```

---

# Fase 7 — Review Enrichment

Integrar Knowledge en Review.

Feature flagged.

Tareas:

```text
[ ] pre-review retrieval
[ ] candidate enrichment
[ ] matching signals
[ ] UI provenance
[ ] metrics
```

No cambiar resultados críticos sin conservar baseline.

---

# Fase 8 — Admin Review Queue

Implementar:

```text
[ ] assertions queue
[ ] conflicts
[ ] observations
[ ] evidence explorer
[ ] promotion candidates
[ ] integration errors
```

---

# Fase 9 — Backfill

Implementar scripts:

```text
[ ] dry-run
[ ] items
[ ] resources
[ ] APUs
[ ] prices
[ ] provenance
[ ] summary report
```

---

# Fase 10 — Observability + Rollout

Tareas:

```text
[ ] feature flags
[ ] logs
[ ] metrics
[ ] dashboards if existing stack supports them
[ ] cohort rollout
```

---

# 46. Orden recomendado de implementación

```text
P0
1. Security / tenancy
2. Evidence Bridge
3. Review events
4. Observation builders
5. Idempotency + retry

P1
6. Assertion lifecycle
7. Retrieval V1
8. Review enrichment
9. Admin review queue

P2
10. Backfill
11. Promotion workflow
12. Conflict heuristics
13. Khipu consumption
```

---

# 47. Acceptance Criteria

## AC-01 Tenant isolation

Un usuario de Company A no puede crear, modificar o leer conocimiento privado de Company B.

## AC-02 Review event completeness

Cada resolución relevante genera un evento idempotente.

## AC-03 Evidence linkage

Un Knowledge object creado desde Review puede rastrearse hasta su `ReviewEvidence`.

## AC-04 Price observation

Un hallazgo de precio confirmado y suficientemente estructurado genera una `PriceObservation` en scope `PROJECT`.

## AC-05 Yield observation

Un hallazgo de rendimiento confirmado genera `YieldObservation` cuando existe evidencia válida.

## AC-06 APU version

Una corrección de APU confirmada puede crear `KnowledgeApuVersion`.

## AC-07 No automatic global

Ningún flujo Review puede crear una entidad `GLOBAL` sin autorización explícita.

## AC-08 Assertion lifecycle

Assertions soportan:

```text
OBSERVED
CONFIRMED
VERIFIED
CANONICAL
REJECTED
DEPRECATED
```

según el diseño final del schema.

## AC-09 Retrieval

Retrieval puede devolver:

- items;
- resources;
- APU;
- prices;
- yields;
- provenance.

## AC-10 Scope precedence

Para proyecto, los resultados priorizan conocimiento del proyecto antes de Company/Global.

## AC-11 Review enrichment

MC Revisión Inteligente puede consultar Knowledge sin acceso directo a tablas.

## AC-12 Evidence visible

Toda recomendación basada en Knowledge muestra provenance utilizable.

## AC-13 No budget mutation

La integración nunca cambia automáticamente el presupuesto.

## AC-14 Idempotency

Reintentar una decisión de Review no duplica observaciones/assertions.

## AC-15 Retry

Una falla de Knowledge no revierte una decisión humana ya guardada en Review.

## AC-16 Admin queue

Un admin autorizado puede revisar assertions pendientes.

## AC-17 Promotion

Promoción a GLOBAL requiere permisos elevados y acción explícita.

## AC-18 Observability

Existen logs/eventos para procesamiento, fallos, retrieval y promotions.

## AC-19 Backfill safe

El backfill es idempotente y soporta dry-run.

## AC-20 Build quality

Pasan:

```text
TypeScript
lint
tests Knowledge
tests Review
tests de integración
build de producción
```

---

# 48. Casos de prueba críticos

## Caso 1 — Rendimiento confirmado

```text
PDF: rendimiento 0.80
APU: rendimiento 1.00
Review: detecta diferencia
Usuario: confirma
```

Esperado:

```text
Review decision saved
KnowledgeEvent created
KnowledgeEvidence linked
YieldObservation created PROJECT
Assertion OBSERVED/CONFIRMED según policy
No budget mutation
```

## Caso 2 — Falso positivo

```text
Review finding
Usuario: FALSE_POSITIVE
```

Esperado:

```text
event created
no observation
no assertion
finding remains auditable
```

## Caso 3 — Precio sin fecha

```text
XLSX: cement price
no date
```

Esperado:

```text
event may be recorded
observation skipped or created with explicit source-date policy
skip reason visible
no invented date
```

## Caso 4 — Cross tenant attack

User A sends:

```text
companyId = Company B
```

Esperado:

```text
403
no row created
security event logged
```

## Caso 5 — Retry

Knowledge processing fails after Review decision.

Esperado:

```text
Review decision persists
integration marked retryable
second execution creates no duplicates
```

## Caso 6 — Corrected finding

Usuario marca `CORRECTED` sin nueva versión.

Esperado:

```text
reject action
require corrected budget version
```

Con nueva versión:

```text
before/after persisted
observation/APU snapshot allowed
```

---

# 49. Testing strategy

## Unit

- mappers;
- scope resolver;
- confidence resolver;
- observation builders;
- assertion transitions;
- idempotency key generation.

## Integration

- Review → Knowledge;
- Evidence bridge;
- database transaction;
- retry.

## Security

- cross tenant;
- user scope;
- company scope;
- global mutation.

## Retrieval

- exact;
- alias;
- scope precedence;
- filters;
- empty result;
- provenance.

## E2E

```text
upload/import
→ run review
→ confirm finding
→ inspect knowledge
→ query retrieval
→ run next review
```

---

# 50. Definition of Done

La integración avanzada se considera lista cuando:

1. Knowledge está protegido contra escrituras cross-tenant.
2. ReviewEvidence puede enlazarse con KnowledgeEvidence.
3. Decisiones confirmadas pueden producir observaciones válidas.
4. Correcciones before/after se conservan.
5. Price/Yield/APU se crean de forma idempotente.
6. Assertions tienen lifecycle operativo.
7. `/admin/knowledge` dispone de review queue utilizable.
8. Retrieval devuelve conocimiento compuesto con provenance.
9. MC Revisión Inteligente consume Retrieval detrás de feature flag.
10. Knowledge nunca modifica automáticamente un presupuesto.
11. No existe promoción automática a GLOBAL.
12. Logs y métricas permiten diagnosticar fallos.
13. Tests de tenancy pasan.
14. Tests de integración pasan.
15. Build completo pasa.
16. Se documentan deudas y funcionalidades dejadas fuera.

---

# 51. Riesgos

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Contaminación de Knowledge | Alta | Human review + observations != truth |
| Fuga cross-tenant | Crítica | Central scope guard + security tests |
| Duplicación por retries | Alta | Idempotency keys + unique constraints |
| Datos sin provenance | Alta | Required provenance completeness |
| Promoción incorrecta a Global | Crítica | Explicit admin workflow |
| Review más lento | Media | Feature flag + structured retrieval + metrics |
| Exceso de schema changes | Media | Audit first + incremental migrations |
| Lógica dispersa | Alta | Knowledge Learning Bridge |
| Dependencia de IA | Media | Deterministic builders/ranking first |
| Backfill incorrecto | Alta | Dry-run + observed status only |

---

# 52. Architecture Decision Matrix

| Decisión | Opción elegida | Alternativa descartada | Razón |
|---|---|---|---|
| Review + Knowledge | Módulos separados con bridge | Fusionarlos | Mantiene responsabilidades claras |
| Aprendizaje | Controlado | Automático | Evita contaminar Knowledge |
| Scope inicial | PROJECT | GLOBAL | Privacidad por defecto |
| Retrieval P0 | Estructurado | Vector DB obligatorio | Menor complejidad |
| Mutation | Human-approved | Auto apply | Seguridad técnica |
| Promotion | Manual | Auto | Gobernanza |
| Evidence | Linked provenance | Copy aislado | Trazabilidad |
| Retry | Async/retryable | Todo en transacción de UI | Resiliencia |
| Ranking | Determinístico | LLM ranking only | Reproducibilidad |
| Khipu access | Retrieval API | Prisma directo | Policy central |

---

# 53. Evolution Strategy

## V1

```text
Review → Knowledge events
Review → observations
Assertions
Retrieval structured
Admin review
```

## V1.5

```text
conflict detection
company reuse
promotion candidates
Khipu integration
```

## V2

```text
semantic search
hybrid retrieval
regional benchmarks
outlier detection
knowledge graph relationships
```

## V3

```text
controlled cross-company intelligence
benchmark datasets
regional/localization packs
predictive quality signals
```

---

# 54. Archivos actuales que Codex debe revisar

Identificados en los diagnósticos:

```text
prisma/schema.prisma

lib/knowledge/events.ts
lib/knowledge/observations.ts
lib/knowledge/provenance.ts
lib/knowledge/scope.ts
lib/knowledge/canonical-items.ts
lib/knowledge/canonical-resources.ts
lib/knowledge/apu.ts
lib/knowledge/retrieval.ts
lib/knowledge/integrations.ts

lib/review-intelligence/findings.ts

app/api/knowledge/price-observations/route.ts
app/api/knowledge/yield-observations/route.ts
app/api/knowledge/sources/route.ts
app/api/knowledge/sources/evidence/route.ts

app/api/imports/s10/import/route.ts
app/api/imports/mcp/import/route.ts

app/admin/knowledge/page.tsx

components/review-intelligence/review-intelligence-page.tsx

docs/review-intelligence-operations.md
docs/mc-knowledge-operations.md
docs/mc-knowledge-audit.md

prisma/migrations/20260907100000_add_mc_knowledge_v0/migration.sql
```

Codex debe confirmar cada ruta antes de usarla.

---

# 55. Entregables de implementación

## Documentación

```text
docs/integration-review-knowledge-audit.md
docs/integration-review-knowledge-architecture.md
docs/integration-review-knowledge-events.md
docs/integration-review-knowledge-security.md
docs/integration-review-knowledge-rollout.md
```

## Código

```text
Knowledge Learning Bridge
Evidence linking
Observation builders
Assertion lifecycle
Retrieval V1
Review enrichment
Admin review queue
Security hardening
Feature flags
Observability
```

## Tests

```text
unit
integration
security
retrieval
e2e
```

---

# 56. Backlog Codex

## P0

```text
[ ] Audit repo
[ ] Fix Knowledge tenancy guards
[ ] Add cross-tenant tests
[ ] Design ReviewEvidence ↔ KnowledgeEvidence bridge
[ ] Implement evidence bridge
[ ] Complete Review event taxonomy
[ ] Implement learning signal mapper
[ ] Implement PriceObservation builder
[ ] Implement YieldObservation builder
[ ] Implement APU snapshot builder
[ ] Add idempotency guarantees
[ ] Add retry-safe integration
```

## P1

```text
[ ] Implement KnowledgeAssertion lifecycle
[ ] Expand Retrieval
[ ] Add provenance summaries
[ ] Add Review enrichment
[ ] Add Admin Review Queue
[ ] Add conflict list
[ ] Add feature flags
[ ] Add observability
```

## P2

```text
[ ] Backfill
[ ] Company promotion
[ ] Global promotion
[ ] Khipu integration
[ ] Basic conflict heuristics
[ ] Advanced ranking
```

---

# 57. Prompt maestro para Codex

Copiar desde aquí:

---

## PROMPT CODEX

Implementa la integración avanzada entre **MC Revisión Inteligente** y **MC Knowledge Perú** siguiendo `PRD_Integracion_Avanzada_MC_Revision_Inteligente_MC_Knowledge_Peru.md`.

### Regla 1 — Audita antes de cambiar código

Antes de implementar:

1. inspecciona el repositorio relevante;
2. confirma las rutas, modelos y servicios existentes;
3. revisa `prisma/schema.prisma`;
4. revisa `lib/knowledge/*`;
5. revisa `lib/review-intelligence/*`;
6. revisa rutas `/api/knowledge`;
7. revisa autenticación, company membership y project authorization;
8. revisa infraestructura existente de jobs, feature flags, logging y tests;
9. compara lo existente con el PRD;
10. crea `docs/integration-review-knowledge-audit.md`.

No asumas que una ruta o modelo del PRD tiene exactamente el mismo nombre en el repositorio.

### Regla 2 — Seguridad primero

Antes de añadir nuevos flujos de escritura:

- corrige cualquier bypass de company/project scope;
- centraliza authorization;
- agrega tests cross-tenant;
- protege scope GLOBAL.

No continúes a observation builders si las rutas base permiten escribir en company/project ajenos.

### Regla 3 — Mantén módulos separados

No fusiones MC Revisión Inteligente con MC Knowledge.

Implementa un bridge explícito:

```text
Review
→ Knowledge Learning Bridge
→ Knowledge
```

Reutiliza servicios existentes.

Evita acceso Prisma directo desde componentes UI.

### Regla 4 — No automatizar decisiones críticas

Mantener siempre:

```text
humanReviewRequired = true
automaticBudgetMutation = false
```

La integración no debe modificar automáticamente el presupuesto.

Una observación no es automáticamente conocimiento confirmado.

Nunca promociones automáticamente a GLOBAL.

### Regla 5 — Scope seguro

Las observaciones originadas desde Review deben usar por defecto:

```text
scope = PROJECT
```

Nunca confíes en `companyId`, `projectId` o `scope` enviados por el cliente sin validar ownership mediante sesión/membership.

### Regla 6 — Implementa incrementalmente

Orden:

1. repository audit;
2. tenancy/security;
3. evidence bridge;
4. Review learning events;
5. observation builders;
6. idempotency/retry;
7. assertion lifecycle;
8. retrieval;
9. Review enrichment;
10. admin review queue;
11. observability/flags;
12. backfill.

Después de cada fase:

- TypeScript;
- lint;
- tests relevantes.

No hagas un cambio masivo de una sola vez.

### Regla 7 — Evidence y provenance obligatorios

Toda observación derivada de Review debe poder rastrearse a:

```text
ReviewFinding
ReviewEvidence
source document/version
project
company
user/actor
timestamp
```

Cuando esté disponible:

```text
page / sheet / cell
budget version
canonical item/resource
region
supplier
```

### Regla 8 — Idempotencia

Retries no deben duplicar:

- KnowledgeEvent;
- KnowledgeEvidence;
- PriceObservation;
- YieldObservation;
- KnowledgeApuVersion;
- KnowledgeAssertion.

Usa keys determinísticas y constraints cuando sea apropiado.

### Regla 9 — Failure isolation

Si guardar una decisión de Review funciona pero Knowledge falla:

- conserva la decisión;
- registra el fallo;
- permite retry;
- no dupliques datos al reintentar.

### Regla 10 — Retrieval

Expande retrieval gradualmente para:

- canonical items;
- canonical resources;
- APU versions;
- price observations;
- yield observations;
- assertions;
- provenance.

Prioriza:

```text
PROJECT → COMPANY → GLOBAL
```

Implementa ranking determinístico antes de agregar embeddings.

### Regla 11 — UI

En Review, cuando Knowledge influya en un resultado:

- muestra el origen;
- muestra scope;
- muestra fecha;
- muestra confidence;
- permite navegar a evidencia.

No reemplaces la evidencia documental primaria por una recomendación de Knowledge.

### Regla 12 — Admin

Amplía `/admin/knowledge` para incorporar:

- review queue;
- assertions;
- observations;
- evidence/provenance;
- conflicts;
- promotion candidates;
- integration errors.

Respeta permisos.

### Regla 13 — Migraciones

Cualquier cambio Prisma debe:

- usar migración nueva;
- no editar migraciones aplicadas;
- incluir índices necesarios;
- preservar datos.

Backfills deben ser:

- idempotentes;
- re-ejecutables;
- con dry-run;
- sin marcar datos históricos como VERIFIED automáticamente.

### Regla 14 — Verificación final

Al finalizar:

1. ejecuta tests unitarios de Knowledge;
2. ejecuta tests de Review;
3. ejecuta tests de integración;
4. ejecuta security tests;
5. ejecuta TypeScript strict;
6. ejecuta lint;
7. ejecuta build completo;
8. reporta archivos creados/modificados;
9. reporta migraciones;
10. reporta feature flags;
11. reporta deuda técnica;
12. reporta cualquier requisito del PRD no implementado.

No declares “completado” si no ejecutaste las verificaciones correspondientes.

---

# 58. Resultado estratégico esperado

Al completar este PRD, la arquitectura debe evolucionar desde:

```text
Review
  ↓
Decision
  ↓
KnowledgeEvent
```

hacia:

```text
Documents + Budget + APU
          ↓
MC Revisión Inteligente
          ↓
Evidence + Findings
          ↓
Human Decisions
          ↓
Knowledge Learning Bridge
          ↓
Observations + APU Versions + Assertions
          ↓
Curated MC Knowledge Perú
          ↓
Retrieval
      ┌───┴───────┐
      ↓           ↓
MC Revisión      Khipu
Inteligente
```

La ventaja no será únicamente detectar una inconsistencia una vez.

La ventaja será que una corrección validada, con contexto, evidencia y permisos adecuados, pueda convertirse en conocimiento reutilizable para futuras revisiones sin perder trazabilidad ni control profesional.

---

# 59. North Star

La North Star de esta integración es:

> **Cada decisión técnica validada debe poder generar conocimiento estructurado, privado por defecto, trazable hasta su fuente y reutilizable únicamente dentro del alcance autorizado.**

Y la restricción principal:

> **La plataforma puede aprender de la actividad del ingeniero, pero nunca sustituir silenciosamente su juicio ni convertir datos privados en conocimiento global sin control explícito.**

---

# Fin del documento
