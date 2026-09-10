# Task 5 — Informe de replay/dry-run PostgreSQL

## Estado

BLOCKED para la corrida persistente contra la base local. `DATABASE_URL` está configurada y PostgreSQL responde, pero la base no tiene las tablas de provenance añadidas por Task 2 (`knowledge_canonical_item_provenance` y `knowledge_canonical_resource_provenance`). No se aplicaron migraciones ni se modificó ningún dato fuera de los fixtures de prueba.

## Cambios

- `scripts/backfill-knowledge.ts`
  - Exporta `runKnowledgeBackfill(options): Promise<KnowledgeBackfillReport>` con filtros de compañía/proyecto, `dryRun` y `correlationId`.
  - Conserva el CLI, incluyendo `--company`, `--project`, `--dry-run`, `--correlation-id` y el gate `MC_KNOWLEDGE_BACKFILL=true`.
  - El CLI desconecta Prisma sólo en su entrypoint; importar la API desde Vitest no cierra la conexión.
  - El selector APU usa sólo campos existentes en `ApuResource` y las partidas validan el `budget.projectId` seleccionado.
- `scripts/backfill-knowledge.integration.test.ts`
  - Usa `describe.skipIf(!process.env.DATABASE_URL)` y Prisma real.
  - Cubre dry-run sin cambios de conteo, creación/replay, provenance consultable, estados `OBSERVED`, no-match/ambiguous, conflicto de versión y aislamiento de errores por fila.
  - Crea y limpia fixtures tenant-scoped con IDs aleatorios.
- `vitest.config.ts`
  - Excluye la integración de la suite ordinaria cuando `DATABASE_URL` no está exportada en la shell.
- `README.md`
  - Documenta el comando explícito, flags, alcance y limpieza.

## TDD y verificación

- RED inicial: la prueba falló porque `runKnowledgeBackfill` no existía; además el primer intento reveló que las tablas de provenance no existen en la base local.
- Verificación PostgreSQL ejecutada:
  - 1 prueba pasó: dry-run real, sin mutaciones, reportando no-match/ambiguous.
  - 1 prueba quedó bloqueada/falló en persistencia por el esquema ausente; el error exacto fue `The table public.knowledge_canonical_item_provenance does not exist in the current database`.
  - La misma corrida confirmó que el conflicto natural `apuId/versionNumber` se reporta por fila y no aborta las otras APUs.
- El test ordinario no requiere PostgreSQL cuando `DATABASE_URL` no se exporta.
- `git diff --check`: verificado sin errores antes del commit.

## Ejecución pendiente

Después de aplicar las migraciones existentes en una base local de prueba, ejecutar:

```powershell
$env:DATABASE_URL="postgresql://postgres:TU_PASSWORD@localhost:5432/myc_presupuestos?schema=public"
$env:MC_KNOWLEDGE_BACKFILL="true"
npm.cmd test -- scripts/backfill-knowledge.integration.test.ts
```

## Commit

`test: verify knowledge backfill replay against postgres`

## Concerns

- La integración persistente no puede declararse verde hasta que la base local tenga aplicadas las migraciones de Task 2 y provenance posteriores.
- El directorio preexistente `presupuesto-ejemplo/pdf escaneado/` permaneció intacto y no se incluyó.
