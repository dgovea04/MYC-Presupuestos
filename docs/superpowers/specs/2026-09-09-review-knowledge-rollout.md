# Especificación de rollout y operación

## Flags

Todas comienzan desactivadas y se evalúan server-side:

- `knowledge.reviewLearningBridge`: procesa decisiones hacia Knowledge.
- `knowledge.reviewEnrichment`: añade señales de retrieval a Review sin alterar baseline.
- `knowledge.adminReviewQueue`: muestra cola y acciones administrativas.
- `knowledge.backfill`: permite scripts de backfill con dry-run obligatorio antes de aplicar.

## Observabilidad

Registrar eventos estructurados con correlationId, companyId, projectId, findingId, decisionId, idempotencyKey, stage, outcome, duration, errorCode y retry count. Métricas mínimas: bridge success/failure, retryable failures, duplicate replays, observations skipped, provenance failures, retrieval latency, scope distribution y promotion attempts.

## Retry

Estados: `PENDING`, `PROCESSING`, `SUCCEEDED`, `RETRYABLE_FAILED`, `DEAD_LETTER`, `CANCELLED`. Backoff determinístico, límite de intentos configurable y visibilidad en admin. Reprocesar usa la misma key y nunca crea duplicados.

## Backfill

Cada script acepta `--dry-run`, filtros de company/project y produce resumen de candidatos, creados, omitidos y errores. Reejecución segura por hashes/keys. Los datos históricos entran como `OBSERVED`; nunca como `VERIFIED` automáticamente.

## Rollback

Desactivar flags antes de rollback de aplicación. No borrar migraciones ni enum values. Los datos de auditoría, evidencia y decisiones se conservan. Un fallo de Knowledge no bloquea Review.
