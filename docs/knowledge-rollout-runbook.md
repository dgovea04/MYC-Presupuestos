# MC Knowledge — rollout y rollback operativo

## Flags server-side

Todas las capacidades permanecen apagadas salvo configuración explícita:

```ini
MC_KNOWLEDGE_REVIEW_LEARNING_BRIDGE=false
MC_KNOWLEDGE_REVIEW_ENRICHMENT=false
MC_KNOWLEDGE_ADMIN_REVIEW_QUEUE=false
MC_KNOWLEDGE_BACKFILL=false
```

Activar progresivamente por entorno y observar los eventos JSON `knowledge_operation`. Cada registro incluye `stage`, `outcome`, `correlationId`, tenant, decisión/finding cuando aplica, error y retry count.

## Rollout

1. Ejecutar `node ./node_modules/tsx/dist/cli.mjs scripts/backfill-knowledge.ts --dry-run --company=<id>` y revisar `candidates`, `created`, `skipped` y `errors`.
2. Activar enrichment para un entorno controlado y comprobar latencia/fallback.
3. Activar learning bridge para un company/project piloto.
4. Ejecutar backfill con `MC_KNOWLEDGE_BACKFILL=true`; repetir el mismo comando es seguro por claves determinísticas.
5. Habilitar admin queue tras verificar aislamiento y auditoría.

El bridge conserva la decisión de Review aunque Knowledge falle; el job queda disponible para retry. Nunca se modifica automáticamente el presupuesto ni se promueve GLOBAL sin acción admin + MFA.

## Rollback

Desactivar primero `MC_KNOWLEDGE_REVIEW_LEARNING_BRIDGE`, `MC_KNOWLEDGE_REVIEW_ENRICHMENT` y `MC_KNOWLEDGE_ADMIN_REVIEW_QUEUE`; si aplica, desactivar `MC_KNOWLEDGE_BACKFILL`. No borrar datos, eventos ni migraciones. Los jobs existentes se conservan para diagnóstico/replay posterior con la misma idempotency key.

## Backfill

`backfill-knowledge.ts` cubre partidas, recursos, precios observados y APUs existentes. Acepta `--dry-run`, `--company`, `--project` y `--correlation-id`; escribe exclusivamente `OBSERVED`, no cambia la fuente y reporta errores por fila. Las reejecuciones consultan las claves antes de incrementar `created`, por lo que el reporte distingue correctamente `created` y `skipped`.
