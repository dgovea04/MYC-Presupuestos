# Task 5 — Informe de replay/dry-run PostgreSQL

## Estado

Completado en `main`. La corrección de Fix round 1 permite descubrir la integración cuando se invoca explícitamente, aunque `DATABASE_URL` no esté presente durante la evaluación inicial de `vitest.config.ts`. La base local está migrada y PostgreSQL respondió correctamente.

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
  - Conserva la integración cuando el archivo se solicita explícitamente con Vitest.
- `README.md`
  - Documenta el comando explícito, flags, alcance y limpieza.

## TDD y verificación

- RED inicial: `npm.cmd test -- scripts/backfill-knowledge.integration.test.ts` terminó en `No test files found` porque el archivo estaba excluido.
- GREEN PostgreSQL real: `1` archivo, `2` tests pasaron.
  - Dry-run sin cambios de conteo.
  - Primera corrida: `items=4`, `resources=1`, `apus=3`, `prices=1`, `sources=2`, `evidence=10`.
  - Replay: contadores `created=0` y conteos persistidos sin duplicados.
  - No-match/ambiguous reportados; conflicto `apuId/versionNumber` aislado sin abortar filas independientes.
  - Provenance consultada directamente por `evidenceId` en PostgreSQL.
- El test ordinario no requiere PostgreSQL cuando `DATABASE_URL` no se exporta.
- `git diff --check`: verificado sin errores antes del commit.

## Comando verificado

```powershell
$env:DATABASE_URL="postgresql://postgres:TU_PASSWORD@localhost:5432/myc_presupuestos?schema=public"
$env:MC_KNOWLEDGE_BACKFILL="true"
npm.cmd test -- scripts/backfill-knowledge.integration.test.ts
```

## Commit

`fix: enable postgres backfill integration test`

## Concerns

- El directorio preexistente `presupuesto-ejemplo/pdf escaneado/` permaneció intacto y no se incluyó.
