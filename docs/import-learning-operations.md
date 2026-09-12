# Operación del aprendizaje controlado desde importaciones

## Activación gradual

El puente está apagado por defecto. Para activar el puente completo use:

```text
MC_KNOWLEDGE_IMPORT_LEARNING_BRIDGE=true
```

Para un piloto por empresa o proyecto, sin activar el resto de tenants:

```text
MC_KNOWLEDGE_IMPORT_LEARNING_BRIDGE_COMPANIES=company-id-1,company-id-2
MC_KNOWLEDGE_IMPORT_LEARNING_BRIDGE_PROJECTS=project-id-1
```

Las listas se evalúan además del flag global. Los valores se comparan después de quitar espacios.

## Flujo y garantías

Cada importación S10, MCP, RW7, PDF, DB y Delphin reutiliza su extracción normalizada y genera registros `PROJECT` únicamente cuando el flag está habilitado:

1. `KnowledgeSource` idempotente por formato/importación.
2. `KnowledgeEvidence` idempotente por importación, dominio y registro original.
3. Observaciones de precio/rendimiento o `KnowledgeAssertion` para partidas, recursos y APU.
4. Coincidencias ambiguas, unidades incompatibles y entidades nuevas quedan `REVIEW_REQUIRED`.

La persistencia del presupuesto no depende de Knowledge. Si la escritura global de Knowledge falla, se crea un `KnowledgeIntegrationJob` de tipo `IMPORT_LEARNING`, se reintenta con el worker y se conserva el batch original. Cada job tiene un máximo de cinco intentos y puede terminar en `DEAD_LETTER`.

## Replay y dry-run

El replay se realiza ejecutando el worker con `KNOWLEDGE_WORKER_JOB_ID` o `KNOWLEDGE_WORKER_BATCH_SIZE`. Las claves incluyen importación, dominio y `originalRecordId`; repetir un batch no duplica fuente, evidencia ni observaciones.

No existe promoción automática. Un dry-run debe ejecutarse con el flag apagado o con una empresa/proyecto fuera de las listas de piloto; el extractor puede probarse de forma aislada sin llamar al adaptador de persistencia.

## Revisión y promoción

Las transiciones válidas son `OBSERVED/REVIEW_REQUIRED → CONFIRMED → VERIFIED`; `VERIFIED` requiere confirmaciones en tres proyectos distintos por defecto, configurable con `MC_KNOWLEDGE_MIN_VERIFICATION_PROJECTS`. La promoción `COMPANY` es explícita y conserva el tenant; la promoción `GLOBAL` requiere capability administrativa, superadministrador y MFA cuando la política lo exige.

Una observación `OBSERVED` no debe presentarse como dato confirmado en consumers. `REJECTED` y `DEPRECATED` conservan su historial y no se eliminan.

## Rollback y dead letters

Para detener el puente, retire el flag global y las listas piloto. Esto no modifica datos ya registrados ni presupuestos. Revise los jobs `RETRYABLE_FAILED` y `DEAD_LETTER` desde la bandeja; antes de reintentar corrija la causa y use la acción Retry. Los errores de datos por fila se reportan como `failed` y no descartan filas independientes; los conflictos de resolución continúan en `conflicts` y los casos omitidos en `skipped`. Los errores de infraestructura se propagan para que el job entre en `RETRYABLE_FAILED` o `DEAD_LETTER`.

## Aplicación segura en staging

Las migraciones de esta entrega deben aplicarse en este orden, que es también el orden lexicográfico de Prisma:

1. `20260911100000_add_import_learning_jobs`
2. `20260911101000_add_review_required_knowledge_status`

La primera agrega `jobType`, `payload JSONB`, vuelve opcionales `findingId` y `decisionId` para permitir jobs de importación y crea un índice operativo. La segunda agrega `REVIEW_REQUIRED` al enum `KnowledgeStatus`. Ambas son compatibles hacia adelante y no modifican presupuestos ni eliminan datos.

### 1. Prechecks

Ejecutar todo contra una copia o entorno de staging, nunca contra producción:

```bash
# Confirmar que DATABASE_URL apunta a staging
node ./node_modules/prisma/build/index.js migrate status
node ./node_modules/prisma/build/index.js validate --schema prisma/schema.prisma
```

Antes de aplicar:

- Confirmar que la última migración de Knowledge anterior aplicada sea como mínimo `20260909180000_add_assertion_conflicts_and_lifecycle_audit`.
- Crear un backup/snapshot de la base de staging y conservar el identificador junto con el despliegue.
- Verificar que la versión de PostgreSQL de staging soporte `ALTER TYPE ... ADD VALUE IF NOT EXISTS`.
- Confirmar que no exista una migración parcial registrada en `_prisma_migrations` para ninguno de los dos nombres.
- Mantener `MC_KNOWLEDGE_IMPORT_LEARNING_BRIDGE` apagado y las allowlists vacías durante la migración.
- Programar la aplicación en una ventana de baja escritura: `ALTER TABLE` y `CREATE INDEX` pueden tomar locks breves sobre `knowledge_integration_jobs`.

Comprobaciones SQL recomendadas, en modo lectura:

```sql
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'knowledge_integration_jobs'
  AND column_name IN ('findingId', 'decisionId', 'jobType', 'payload')
ORDER BY column_name;

SELECT EXISTS (
  SELECT 1
  FROM pg_type
  WHERE typname = 'KnowledgeStatus'
) AS knowledge_status_exists;

SELECT indexname
FROM pg_indexes
WHERE tablename = 'knowledge_integration_jobs';
```

### 2. Aplicación

Usar `migrate deploy`, no `migrate dev`, `db push` ni `migrate reset`:

```bash
node ./node_modules/prisma/build/index.js migrate deploy
npm run prisma:generate
npm run typecheck
npm run lint
```

El comando debe ejecutarse con el mismo artefacto y `prisma/schema.prisma` que se desplegarán. No ejecutar manualmente solo una parte del SQL ni marcar una migración como aplicada si falló: primero revisar `_prisma_migrations`, logs de PostgreSQL y el estado de las columnas/índices.

### 3. Verificación posterior

Después de `migrate deploy`, verificar:

```sql
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'knowledge_integration_jobs'
  AND column_name IN ('findingId', 'decisionId', 'jobType', 'payload');

SELECT enumlabel
FROM pg_enum
WHERE enumtypid = '"KnowledgeStatus"'::regtype
ORDER BY enumsortorder;

SELECT indexname
FROM pg_indexes
WHERE tablename = 'knowledge_integration_jobs'
  AND indexname = 'knowledge_integration_jobs_jobType_status_nextRetryAt_idx';
```

Los resultados esperados son:

- `findingId` y `decisionId` permiten `NULL`.
- `jobType` es `NOT NULL` y su default es `REVIEW_LEARNING`.
- `payload` es `JSONB` nullable.
- El enum contiene `REVIEW_REQUIRED`.
- Existe el índice `knowledge_integration_jobs_jobType_status_nextRetryAt_idx`.
- Los jobs existentes conservan `jobType = 'REVIEW_LEARNING'`; no deben perderse ni cambiar de estado.

Después de verificar el esquema, desplegar la aplicación compatible, comprobar que el worker inicia y consultar la bandeja administrativa. Activar el puente únicamente para una empresa/proyecto piloto y observar primero `created`, `skipped`, `conflicts`, `RETRYABLE_FAILED` y `DEAD_LETTER`.

### 4. Fallo y rollback

No hay un rollback SQL destructivo recomendado:

- Los valores de un enum PostgreSQL no deben eliminarse en caliente.
- Eliminar `payload` o volver a hacer obligatorios `findingId`/`decisionId` puede destruir o invalidar jobs `IMPORT_LEARNING` ya creados.
- El índice se puede eliminar de forma aislada si causa presión operativa, pero solo después de confirmar impacto y sin marcar la migración como revertida.
- Ante un fallo, detener el rollout, mantener el flag apagado, conservar la base en el estado migrado y corregir mediante una nueva migración forward-compatible.
- Restaurar un snapshot completo solo corresponde a un incidente grave y coordinado; no usarlo como rollback rutinario porque puede perder datos creados después del snapshot.

Una reversión de aplicación suele ser segura porque las columnas nuevas son aditivas y los jobs antiguos reciben el default `REVIEW_LEARNING`; sin embargo, el binario anterior no debe procesar ni borrar jobs con `findingId`/`decisionId` nulos. Si ya se activó el puente, conservar la aplicación nueva hasta drenar o aislar esos jobs.

### 5. Riesgos y observabilidad

Las operaciones de Knowledge emiten métricas agregadas en memoria para diagnóstico inmediato y, cuando existe `idempotencyKey`, también persisten un evento idempotente en `knowledge_metric_events`. La persistencia incluye etapa, resultado, tenant, duración, reintentos, código de error y metadata agregada como `created`, `skipped`, `conflicts` y `failed`. La escritura es best-effort: una indisponibilidad de la tabla métrica no interrumpe una importación, revisión o promoción.

Para consultar métricas por periodo o tenant, usar la tabla `knowledge_metric_events` agrupando por `metric`, `companyId`, `projectId` y `createdAt`. No registrar valores de presupuestos completos ni payloads sensibles en `metadata`.

- `ALTER TYPE` puede requerir una transacción compatible con la versión de PostgreSQL; probarlo en una copia de staging equivalente antes de producción.
- `CREATE INDEX` usa la forma transaccional normal de Prisma; aplicarlo en baja actividad y vigilar locks/latencia.
- `payload` conserva el batch reintentable completo; vigilar tamaño de filas y crecimiento de la tabla.
- Revisar `_prisma_migrations`, logs del worker y las métricas `knowledge.retry.*` después del despliegue.
- No activar promoción automática: `REVIEW_REQUIRED`, `COMPANY` y `GLOBAL` siguen sujetos a revisión y autorización humana.
