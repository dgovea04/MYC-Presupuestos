# MC Review Intelligence + MC Knowledge Perú: hardening de integración

## Objetivo

Cerrar los pendientes de integración identificados en el diagnóstico contra el PRD, priorizando seguridad multi-tenant, provenance auditable, resolución canónica de recursos, rollout controlado y verificación reproducible contra PostgreSQL.

El alcance cubre autorización Knowledge, backfill histórico, mapping APU, feature flags, pruebas de replay/dry-run, lint/build y una prueba end-to-end de Review → bridge → Knowledge → retry. La observabilidad persistente queda fuera del cambio estructural; se conservarán y verificarán los eventos estructurados existentes.

## Estado actual relevante

- La integración principal vive en `lib/knowledge` y las rutas `app/api/knowledge`, `app/api/admin/knowledge` y `app/api/review-findings`.
- `lib/knowledge/api-access.ts` ya contiene autorización parcial.
- `scripts/backfill-knowledge.ts` crea entidades históricas, pero no completa la provenance de migración y actualmente usa IDs operativos al crear filas de recursos APU.
- `lib/knowledge/feature-flags.ts` tiene flags de bridge, enrichment, admin queue y backfill, pero falta el flag operacional de retrieval.
- Existen pruebas unitarias y de rutas; falta una prueba real de replay/dry-run con PostgreSQL local.

## Diseño aprobado

### 1. Frontera única de autorización

`lib/knowledge/api-access.ts` será la frontera pública para lecturas y escrituras Knowledge:

- `assertKnowledgeReadAccess`: valida sesión/actor, tenant, scope y pertenencia al proyecto o compañía.
- `assertKnowledgeWriteAccess`: aplica las mismas validaciones y además el rol/capacidad mínima para mutaciones.
- La API aceptará el contexto de actor, compañía/proyecto, tipo e ID de entidad cuando corresponda y rol mínimo.
- Las rutas de Knowledge, retrieval y cola administrativa usarán esta frontera antes de leer o mutar datos.
- `assertKnowledgeEntityAccess` podrá conservarse como helper de compatibilidad, pero no será llamado directamente desde rutas una vez migradas.
- El acceso GLOBAL continuará restringido a la capacidad administrativa existente, MFA y superadmin cuando aplique.

Las denegaciones conservarán respuestas HTTP consistentes y no filtrarán si una entidad existe fuera del tenant.

### 2. Provenance de migración

El backfill creará o reutilizará de forma idempotente una `KnowledgeSource` de tipo `MIGRATION` por tenant y corrida lógica. La fuente registrará actor de migración, script, correlación y metadata del origen.

Cada dominio migrado deberá poder navegar desde la entidad Knowledge hacia evidencia del registro original mediante `KnowledgeEvidence` y sus enlaces existentes. Los registros incluirán `sourceId`, tipo de origen, identificador original, proyecto/compañía y timestamp de observación cuando el modelo lo soporte.

La operación será segura para replay: source, evidence y entidades usarán claves idempotentes estables. El backfill seguirá creando datos históricos como `OBSERVED`; no promoverá assertions ni modificará automáticamente presupuestos.

### 3. Mapping APU a recursos canónicos

La resolución usará el índice canónico existente, normalizando descripción y unidad y considerando aliases. Solo un match inequívoco producirá la relación `KnowledgeApuResource` → `CanonicalResource`.

El `Resource.id` operativo no se usará como sustituto de `canonicalResourceId`. Cuando el esquema tenga un campo de referencia de origen, se conservará allí; si no existe, la evidencia de migración llevará el identificador original. Sin match o con ambigüedad, la fila quedará reportada como `skipped`/conflicto con razón explícita y sin relación inventada.

### 4. Flag de retrieval y rollout

Se añadirá `knowledge_retrieval_v1` al registro tipado de flags. La evaluación aceptará el contexto company/project y respetará overrides existentes. Se aplicará en:

- endpoint de retrieval;
- endpoints Knowledge que expongan datos recuperables;
- endpoint de admin queue;
- cualquier API compartida que active retrieval V1.

Con el flag apagado, la API responderá de forma controlada y auditable, sin consultar el índice. Las mutaciones administrativas no se habilitarán por accidente al activar retrieval.

### 5. Pruebas PostgreSQL y verificación

Se añadirá una suite de integración opt-in o condicionada por `DATABASE_URL` para ejecutar el backfill real contra PostgreSQL local. Cubrirá:

1. primera ejecución con entidades y provenance creadas;
2. segunda ejecución/replay con `created = 0` y sin duplicados;
3. dry-run sin mutaciones;
4. entidades ya existentes y conflictos de versión;
5. mapping canónico inequívoco, ambiguo y ausente;
6. error aislado por fila y reporte de errores sin perder las demás filas.

Las pruebas unitarias seguirán validando las decisiones puras de autorización, mapping, flags y claves idempotentes. La prueba E2E verificará Review → bridge → Knowledge → retry usando la configuración de entorno existente.

### 6. Calidad del proyecto

Tras implementar por etapas se ejecutarán suite completa, typecheck, lint y build. El error preexistente de `components/imports/pdf-importer-page-content.tsx` se corregirá reemplazando el valor no determinista durante render por un mecanismo estable compatible con el flujo existente, con regresión cubierta si corresponde.

## Flujo de datos

```text
actor/request
    ↓
Knowledge access boundary
    ↓
flag evaluation (company/project)
    ↓
Knowledge API / backfill / bridge
    ↓
canonical entity + source + evidence + observation/version
    ↓
retrieval/admin/review enrichment
```

## Manejo de errores

- Autorización: rechazo temprano, código HTTP consistente, sin exposición cross-tenant.
- Flag apagado: respuesta explícita de feature disabled y evento estructurado.
- Provenance: una fila sin evidencia válida no se tratará como completamente migrada; se reportará como error/skipped.
- Mapping: ambigüedad y ausencia serán resultados distintos y auditables.
- Replay: conflictos de unicidad se resolverán por upsert/claves idempotentes, no por duplicación.
- Error por fila: se acumulará en el reporte y no abortará filas independientes, salvo fallo transaccional de infraestructura.

## No incluido

- Persistencia nueva de métricas, dashboards de observabilidad o exportación externa.
- Rediseño de la UI administrativa.
- Cambios de fórmula, cálculo financiero o mutación automática de presupuestos.
- Migración de arquitectura fuera de `lib/knowledge`, sus APIs, backfill, Prisma y pruebas relacionadas.

## Criterios de aceptación

- Todas las rutas en alcance pasan por autorización Knowledge centralizada.
- El backfill deja provenance navegable con `KnowledgeSource` MIGRATION y replay idempotente.
- Ninguna fila APU usa un `Resource.id` operativo como `canonicalResourceId`.
- Retrieval V1 y admin queue respetan el flag por tenant/contexto.
- La suite PostgreSQL demuestra dry-run, replay, conflictos, skips y errores por fila.
- Suite, typecheck, lint y build tienen resultados documentados; cualquier bloqueo ambiental queda explícito.
- El flujo E2E Review → bridge → Knowledge → retry queda ejecutado o documentado con causa reproducible si el entorno no lo permite.
